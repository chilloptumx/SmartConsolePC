import Bull from 'bull';
import { config } from '../config.js';
import { logger } from './logger.js';
import { prisma } from './database.js';
import {
  pingMachine,
  getRegistryValue,
  getFileInfo,
  getCurrentUser,
  getLastUser,
  getSystemInfo,
  executePowerShell,
  ConnectionOptions,
  PowerShellResult,
} from './powershell-executor.js';
import { normalizeRegistryPathForStorage, normalizeValueName } from './registry-path.js';
import { logAuditEvent } from './audit.js';
import { evaluateFileCheckResult, evaluateRegistryCheckResult, parseResultData } from './check-evaluators.js';

function computePcModelFromSystemInfo(data: any): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const manufacturer = (data.Manufacturer ?? data.manufacturer ?? '').toString().trim();
  const model = (data.Model ?? data.model ?? '').toString().trim();
  const combined = `${manufacturer} ${model}`.trim();
  return combined || undefined;
}

// Create Bull queues
export const checkQueue = new Bull('health-checks', config.redisUrl, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Job processor function
async function processJob(job: Bull.Job) {
  const { jobType, machineId, checkConfig, scheduledJobId, machines } = job.data;
  
  // Handle scheduled jobs (have machines array) vs manual checks (have machineId)
  if (scheduledJobId && machines && machines.length > 0) {
    // This is a scheduled job - process each machine
    logger.info(`Processing scheduled job ${scheduledJobId} (${jobType}) for ${machines.length} machines`);
    await logAuditEvent({
      eventType: 'SCHEDULED_JOB_PROCESSING',
      message: `Scheduled job processing: ${scheduledJobId} (${jobType})`,
      entityType: 'ScheduledJob',
      entityId: scheduledJobId,
      metadata: { jobType, machines },
    });
    
    for (const targetMachineId of machines) {
      try {
        await processSingleMachine(targetMachineId, jobType, checkConfig);
      } catch (error: any) {
        logger.error({ machineId: targetMachineId, error }, `Failed to process machine in scheduled job`);
        await logAuditEvent({
          eventType: 'JOB_FAILED',
          level: 'ERROR',
          message: `Job failed: ${jobType} for machine ${targetMachineId}`,
          machineId: targetMachineId,
          entityType: 'ScheduledJob',
          entityId: scheduledJobId,
          metadata: { jobType, error: error?.message ?? String(error) },
        });
      }
    }
    return { success: true, processedMachines: machines.length };
  } else if (machineId) {
    // This is a manual check
    logger.info(`Processing manual ${jobType} check for machine ${machineId}`);
    await logAuditEvent({
      eventType: 'JOB_STARTED',
      message: `Job started: ${jobType} for machine ${machineId}`,
      machineId,
      metadata: { jobType },
    });
    return await processSingleMachine(machineId, jobType, checkConfig);
  } else {
    throw new Error('Invalid job data: missing machineId or machines array');
  }
}

// Process a single machine check
async function processSingleMachine(machineId: string, jobType: string, checkConfig?: any) {
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
  });

  if (!machine) {
    throw new Error(`Machine ${machineId} not found`);
  }

  const connection: ConnectionOptions = {
    hostname: machine.hostname,
    ipAddress: machine.ipAddress,
    useSSH: true, // Use SSH - works in prod from Linux container to Windows
  };

  let result;
  let checkName = jobType;
  let newPcModel: string | undefined;

  try {
    await logAuditEvent({
      eventType: 'CHECK_EXECUTION_STARTED',
      message: `Executing ${jobType} on ${machine.hostname}`,
      machineId: machine.id,
      metadata: { jobType },
    });
    switch (jobType) {
      case 'PING':
        result = await pingMachine(connection);
        checkName = 'Ping Test';
        break;

      case 'REGISTRY_CHECK':
        // If no specific registry check was provided, run ALL active registry checks.
        if (!checkConfig?.registryPath && !checkConfig?.registryCheckId) {
          const registryChecks = await prisma.registryCheck.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
          });

          if (registryChecks.length === 0) {
            throw new Error('No active registry checks configured');
          }

          let anyFailed = false;
          let anyWarning = false;

          for (const rc of registryChecks) {
            const normalizedPath = normalizeRegistryPathForStorage(rc.registryPath);
            const normalizedValueName = normalizeValueName(rc.valueName);

            const r = await getRegistryValue(connection, normalizedPath, normalizedValueName);
            const evaluated = evaluateRegistryCheckResult(
              { registryPath: normalizedPath, valueName: normalizedValueName ?? null, expectedValue: rc.expectedValue ?? null },
              r
            );
            if (evaluated.status === 'FAILED') anyFailed = true;
            if (evaluated.status === 'WARNING') anyWarning = true;

            await prisma.checkResult.create({
              data: {
                machineId: machine.id,
                checkType: jobType as any,
                checkName: rc.name || 'Registry Check',
                status: evaluated.status,
                resultData: evaluated.data,
                message: evaluated.message,
                duration: r.duration,
              },
            });
          }

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: anyFailed ? 'ERROR' : anyWarning ? 'WARNING' : 'ONLINE',
              lastSeen: new Date(),
            },
          });

          logger.info(`Completed REGISTRY_CHECK checks (${registryChecks.length}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: registryChecks.length };
        }

        // Allow single registry check execution by id (preferred by AdHocScan)
        if (checkConfig?.registryCheckId && !checkConfig?.registryPath) {
          const rc = await prisma.registryCheck.findUnique({ where: { id: checkConfig.registryCheckId } });
          if (!rc) throw new Error(`Registry check not found: ${checkConfig.registryCheckId}`);
          checkConfig = {
            ...checkConfig,
            name: rc.name,
            registryPath: rc.registryPath,
            valueName: rc.valueName,
            expectedValue: rc.expectedValue,
          };
        }

        // Single registry check execution
        result = await getRegistryValue(
          connection,
          normalizeRegistryPathForStorage(checkConfig.registryPath),
          normalizeValueName(checkConfig.valueName)
        );
        {
          const normalizedPath = normalizeRegistryPathForStorage(checkConfig.registryPath);
          const normalizedValueName = normalizeValueName(checkConfig.valueName);
          const evaluated = evaluateRegistryCheckResult(
            {
              registryPath: normalizedPath,
              valueName: normalizedValueName ?? null,
              expectedValue: checkConfig.expectedValue ?? null,
            },
            result
          );
          checkName = checkConfig.name || 'Registry Check';

          await prisma.checkResult.create({
            data: {
              machineId: machine.id,
              checkType: jobType as any,
              checkName,
              status: evaluated.status,
              resultData: evaluated.data,
              message: evaluated.message,
              duration: result.duration,
            },
          });

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: evaluated.status === 'FAILED' ? 'ERROR' : evaluated.status === 'WARNING' ? 'WARNING' : 'ONLINE',
              lastSeen: new Date(),
            },
          });

          logger.info(`Completed REGISTRY_CHECK check (${checkName}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: 1 };
        }

      case 'FILE_CHECK':
        // If no specific file check was provided, run ALL active file checks.
        // This makes scheduled FILE_CHECK jobs and manual triggers actually useful.
        if (!checkConfig?.filePath && !checkConfig?.fileCheckId) {
          const fileChecks = await prisma.fileCheck.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
          });

          if (fileChecks.length === 0) {
            throw new Error('No active file checks configured');
          }

          let anyFailed = false;
          let anyWarning = false;

          for (const fc of fileChecks) {
            const r = await getFileInfo(connection, fc.filePath);
            const evaluated = evaluateFileCheckResult({ filePath: fc.filePath, checkExists: fc.checkExists }, r);
            if (evaluated.status === 'FAILED') anyFailed = true;
            if (evaluated.status === 'WARNING') anyWarning = true;

            await prisma.checkResult.create({
              data: {
                machineId: machine.id,
                checkType: jobType,
                checkName: fc.name || 'File Check',
                status: evaluated.status,
                resultData: evaluated.data,
                message: evaluated.message,
                duration: r.duration,
              },
            });
          }

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: anyFailed ? 'ERROR' : anyWarning ? 'WARNING' : 'ONLINE',
              lastSeen: new Date(),
            },
          });

          logger.info(`Completed FILE_CHECK checks (${fileChecks.length}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: fileChecks.length };
        }

        // Allow single file check execution by id (preferred by AdHocScan)
        if (checkConfig?.fileCheckId && !checkConfig?.filePath) {
          const fc = await prisma.fileCheck.findUnique({ where: { id: checkConfig.fileCheckId } });
          if (!fc) throw new Error(`File check not found: ${checkConfig.fileCheckId}`);
          checkConfig = {
            ...checkConfig,
            name: fc.name,
            filePath: fc.filePath,
            checkExists: fc.checkExists,
          };
        }

        result = await getFileInfo(connection, checkConfig.filePath);
        {
          const evaluated = evaluateFileCheckResult(
            { filePath: checkConfig.filePath, checkExists: checkConfig.checkExists },
            result
          );
          checkName = checkConfig.name || 'File Check';

          await prisma.checkResult.create({
            data: {
              machineId: machine.id,
              checkType: jobType as any,
              checkName,
              status: evaluated.status,
              resultData: evaluated.data,
              message: evaluated.message,
              duration: result.duration,
            },
          });

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: evaluated.status === 'FAILED' ? 'ERROR' : evaluated.status === 'WARNING' ? 'WARNING' : 'ONLINE',
              lastSeen: new Date(),
            },
          });

          logger.info(`Completed FILE_CHECK check (${checkName}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: 1 };
        }

      case 'USER_INFO':
        // Allow single configured user check execution by id (preferred by AdHocScan)
        if (checkConfig?.userCheckId) {
          const uc = await prisma.userCheck.findUnique({ where: { id: checkConfig.userCheckId } });
          if (!uc) throw new Error(`User check not found: ${checkConfig.userCheckId}`);

          let userResult: PowerShellResult;
          if (uc.checkType === 'CURRENT_AND_LAST') {
            const currentUser = await getCurrentUser(connection);
            const lastUser = await getLastUser(connection);
            userResult = {
              success: currentUser.success && lastUser.success,
              output: JSON.stringify({
                currentUser: currentUser.output,
                lastUser: lastUser.output,
              }),
              duration: currentUser.duration + lastUser.duration,
            };
          } else if (uc.checkType === 'CURRENT_ONLY') {
            const currentUser = await getCurrentUser(connection);
            userResult = {
              success: currentUser.success,
              output: JSON.stringify({ currentUser: currentUser.output }),
              duration: currentUser.duration,
            };
          } else if (uc.checkType === 'LAST_ONLY') {
            const lastUser = await getLastUser(connection);
            userResult = {
              success: lastUser.success,
              output: JSON.stringify({ lastUser: lastUser.output }),
              duration: lastUser.duration,
            };
          } else if (uc.checkType === 'CUSTOM' && uc.customScript) {
            userResult = await executePowerShell(uc.customScript, connection);
          } else {
            // Default to CURRENT_AND_LAST
            const currentUser = await getCurrentUser(connection);
            const lastUser = await getLastUser(connection);
            userResult = {
              success: currentUser.success && lastUser.success,
              output: JSON.stringify({
                currentUser: currentUser.output,
                lastUser: lastUser.output,
              }),
              duration: currentUser.duration + lastUser.duration,
            };
          }

          await prisma.checkResult.create({
            data: {
              machineId: machine.id,
              checkType: jobType,
              checkName: uc.name,
              status: userResult.success ? 'SUCCESS' : 'FAILED',
              resultData: parseResultData(userResult.output),
              message: userResult.error,
              duration: userResult.duration,
            },
          });

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: userResult.success ? 'ONLINE' : 'ERROR',
              lastSeen: new Date(),
            },
          });

          logger.info(`Completed USER_INFO check (${uc.name}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: 1 };
        }

        // If no specific check config, run all active user checks
        if (!checkConfig) {
          const userChecks = await prisma.userCheck.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
          });

          if (userChecks.length === 0) {
            throw new Error('No active user checks configured');
          }

          let anyFailed = false;

          for (const uc of userChecks) {
            let userResult: PowerShellResult;
            
            if (uc.checkType === 'CURRENT_AND_LAST') {
              const currentUser = await getCurrentUser(connection);
              const lastUser = await getLastUser(connection);
              userResult = {
                success: currentUser.success && lastUser.success,
                output: JSON.stringify({
                  currentUser: currentUser.output,
                  lastUser: lastUser.output,
                }),
                duration: currentUser.duration + lastUser.duration,
              };
            } else if (uc.checkType === 'CURRENT_ONLY') {
              const currentUser = await getCurrentUser(connection);
              userResult = {
                success: currentUser.success,
                output: JSON.stringify({ currentUser: currentUser.output }),
                duration: currentUser.duration,
              };
            } else if (uc.checkType === 'LAST_ONLY') {
              const lastUser = await getLastUser(connection);
              userResult = {
                success: lastUser.success,
                output: JSON.stringify({ lastUser: lastUser.output }),
                duration: lastUser.duration,
              };
            } else if (uc.checkType === 'CUSTOM' && uc.customScript) {
              userResult = await executePowerShell(uc.customScript, connection);
            } else {
              // Default to CURRENT_AND_LAST
              const currentUser = await getCurrentUser(connection);
              const lastUser = await getLastUser(connection);
              userResult = {
                success: currentUser.success && lastUser.success,
                output: JSON.stringify({
                  currentUser: currentUser.output,
                  lastUser: lastUser.output,
                }),
                duration: currentUser.duration + lastUser.duration,
              };
            }

            if (!userResult.success) anyFailed = true;

            await prisma.checkResult.create({
              data: {
                machineId: machine.id,
                checkType: jobType,
                checkName: uc.name,
                status: userResult.success ? 'SUCCESS' : 'FAILED',
                resultData: parseResultData(userResult.output),
                message: userResult.error,
                duration: userResult.duration,
              },
            });
          }

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: anyFailed ? 'ERROR' : 'ONLINE',
              lastSeen: new Date(),
            },
          });

          logger.info(`Completed USER_INFO checks (${userChecks.length}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: userChecks.length };
        }

        // Single check with config (backward compatibility)
        const currentUser = await getCurrentUser(connection);
        const lastUser = await getLastUser(connection);
        result = {
          success: currentUser.success && lastUser.success,
          output: JSON.stringify({
            currentUser: currentUser.output,
            lastUser: lastUser.output,
          }),
          duration: currentUser.duration + lastUser.duration,
        };
        checkName = 'User Information';
        break;

      case 'SYSTEM_INFO':
        // Allow single configured system check execution by id (preferred by AdHocScan)
        if (checkConfig?.systemCheckId) {
          const sc = await prisma.systemCheck.findUnique({ where: { id: checkConfig.systemCheckId } });
          if (!sc) throw new Error(`System check not found: ${checkConfig.systemCheckId}`);

          let sysResult: PowerShellResult;
          if (sc.checkType === 'SYSTEM_INFO') {
            sysResult = await getSystemInfo(connection);
            const sysData = parseResultData(sysResult.output);
            newPcModel = computePcModelFromSystemInfo(sysData);
          } else if (sc.checkType === 'CUSTOM' && sc.customScript) {
            sysResult = await executePowerShell(sc.customScript, connection);
          } else {
            // Default to SYSTEM_INFO
            sysResult = await getSystemInfo(connection);
            const sysData = parseResultData(sysResult.output);
            newPcModel = computePcModelFromSystemInfo(sysData);
          }

          await prisma.checkResult.create({
            data: {
              machineId: machine.id,
              checkType: jobType,
              checkName: sc.name,
              status: sysResult.success ? 'SUCCESS' : 'FAILED',
              resultData: parseResultData(sysResult.output),
              message: sysResult.error,
              duration: sysResult.duration,
            },
          });

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: sysResult.success ? 'ONLINE' : 'ERROR',
              lastSeen: new Date(),
              ...(newPcModel ? { pcModel: newPcModel } : {}),
            },
          });

          logger.info(`Completed SYSTEM_INFO check (${sc.name}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: 1 };
        }

        // If no specific check config, run all active system checks
        if (!checkConfig) {
          const systemChecks = await prisma.systemCheck.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
          });

          if (systemChecks.length === 0) {
            throw new Error('No active system checks configured');
          }

          let anyFailed = false;

          for (const sc of systemChecks) {
            let sysResult: PowerShellResult;
            
            if (sc.checkType === 'SYSTEM_INFO') {
              sysResult = await getSystemInfo(connection);
              const sysData = parseResultData(sysResult.output);
              newPcModel = computePcModelFromSystemInfo(sysData);
            } else if (sc.checkType === 'CUSTOM' && sc.customScript) {
              sysResult = await executePowerShell(sc.customScript, connection);
            } else {
              // Default to SYSTEM_INFO
              sysResult = await getSystemInfo(connection);
              const sysData = parseResultData(sysResult.output);
              newPcModel = computePcModelFromSystemInfo(sysData);
            }

            if (!sysResult.success) anyFailed = true;

            await prisma.checkResult.create({
              data: {
                machineId: machine.id,
                checkType: jobType,
                checkName: sc.name,
                status: sysResult.success ? 'SUCCESS' : 'FAILED',
                resultData: parseResultData(sysResult.output),
                message: sysResult.error,
                duration: sysResult.duration,
              },
            });
          }

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: anyFailed ? 'ERROR' : 'ONLINE',
              lastSeen: new Date(),
              ...(newPcModel && { pcModel: newPcModel }),
            },
          });

          logger.info(`Completed SYSTEM_INFO checks (${systemChecks.length}) for machine ${machine.hostname}`);
          return { success: true, machineId, jobType, checksRun: systemChecks.length };
        }

        // Single check with config (backward compatibility)
        result = await getSystemInfo(connection);
        checkName = 'System Information';
        newPcModel = computePcModelFromSystemInfo(parseResultData(result.output));
        break;

      case 'FULL_CHECK':
        // Run a full suite: ping + system + user + all registry checks + all file checks.
        // Store each result as its native checkType so the UI filters work as expected.
        {
          let anyFailed = false;
          let anyWarning = false;

          const ping = await pingMachine(connection);
          if (!ping.success) anyFailed = true;
          await prisma.checkResult.create({
            data: {
              machineId: machine.id,
              checkType: 'PING',
              checkName: 'Ping Test',
              status: ping.success ? 'SUCCESS' : 'FAILED',
              resultData: parseResultData(ping.output),
              message: ping.error,
              duration: ping.duration,
            },
          });

          const sysInfo = await getSystemInfo(connection);
          if (!sysInfo.success) anyFailed = true;
          const sysInfoData = parseResultData(sysInfo.output);
          const fullCheckPcModel = computePcModelFromSystemInfo(sysInfoData);
          await prisma.checkResult.create({
            data: {
              machineId: machine.id,
              checkType: 'SYSTEM_INFO',
              checkName: 'System Information',
              status: sysInfo.success ? 'SUCCESS' : 'FAILED',
              resultData: sysInfoData,
              message: sysInfo.error,
              duration: sysInfo.duration,
            },
          });

          const currentUser = await getCurrentUser(connection);
          const lastUser = await getLastUser(connection);
          const userSuccess = currentUser.success && lastUser.success;
          if (!userSuccess) anyFailed = true;
          await prisma.checkResult.create({
            data: {
              machineId: machine.id,
              checkType: 'USER_INFO',
              checkName: 'User Information',
              status: userSuccess ? 'SUCCESS' : 'FAILED',
              resultData: {
                currentUser: currentUser.output,
                lastUser: lastUser.output,
              } as any,
              message: currentUser.error || lastUser.error,
              duration: currentUser.duration + lastUser.duration,
            },
          });

          // Registry checks
          const registryChecks = await prisma.registryCheck.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
          });
          for (const rc of registryChecks) {
            const r = await getRegistryValue(
              connection,
              normalizeRegistryPathForStorage(rc.registryPath),
              normalizeValueName(rc.valueName)
            );
            const evaluated = evaluateRegistryCheckResult(
              {
                registryPath: normalizeRegistryPathForStorage(rc.registryPath),
                valueName: normalizeValueName(rc.valueName) ?? null,
                expectedValue: rc.expectedValue ?? null,
              },
              r
            );
            if (evaluated.status === 'FAILED') anyFailed = true;
            if (evaluated.status === 'WARNING') anyWarning = true;

            await prisma.checkResult.create({
              data: {
                machineId: machine.id,
                checkType: 'REGISTRY_CHECK',
                checkName: rc.name || 'Registry Check',
                status: evaluated.status,
                resultData: evaluated.data,
                message: evaluated.message,
                duration: r.duration,
              },
            });
          }

          // File checks
          const fileChecks = await prisma.fileCheck.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
          });
          for (const fc of fileChecks) {
            const r = await getFileInfo(connection, fc.filePath);
            const evaluated = evaluateFileCheckResult({ filePath: fc.filePath, checkExists: fc.checkExists }, r);
            if (evaluated.status === 'FAILED') anyFailed = true;
            if (evaluated.status === 'WARNING') anyWarning = true;
            await prisma.checkResult.create({
              data: {
                machineId: machine.id,
                checkType: 'FILE_CHECK',
                checkName: fc.name || 'File Check',
                status: evaluated.status,
                resultData: evaluated.data,
                message: evaluated.message,
                duration: r.duration,
              },
            });
          }

          await prisma.machine.update({
            where: { id: machine.id },
            data: {
              status: anyFailed ? 'ERROR' : anyWarning ? 'WARNING' : 'ONLINE',
              lastSeen: new Date(),
              ...(fullCheckPcModel ? { pcModel: fullCheckPcModel } : {}),
            },
          });

          logger.info(`Completed FULL_CHECK suite for machine ${machine.hostname}`);
          await logAuditEvent({
            eventType: 'CHECK_EXECUTION_COMPLETED',
            message: `Completed FULL_CHECK for ${machine.hostname}`,
            machineId: machine.id,
            metadata: { jobType: 'FULL_CHECK', registryChecks: registryChecks.length, fileChecks: fileChecks.length },
          });
          return { success: true, machineId, jobType, registryChecks: registryChecks.length, fileChecks: fileChecks.length };
        }

      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    // Store result in database
    await prisma.checkResult.create({
      data: {
        machineId: machine.id,
        checkType: jobType,
        checkName,
        status: result.success ? 'SUCCESS' : 'FAILED',
        resultData: parseResultData(result.output),
        message: result.error,
        duration: result.duration,
      },
    });

    // Update machine status and last seen
    await prisma.machine.update({
      where: { id: machine.id },
      data: {
        status: result.success ? 'ONLINE' : 'ERROR',
        lastSeen: new Date(),
        ...(newPcModel ? { pcModel: newPcModel } : {}),
      },
    });

    logger.info(`Completed ${jobType} check for machine ${machine.hostname}`);
    await logAuditEvent({
      eventType: result.success ? 'CHECK_EXECUTION_COMPLETED' : 'CHECK_EXECUTION_FAILED',
      level: result.success ? 'INFO' : 'ERROR',
      message: `${result.success ? 'Completed' : 'Failed'} ${jobType} for ${machine.hostname}`,
      machineId: machine.id,
      metadata: { jobType, success: result.success, error: result.error },
    });
    
    return { success: true, machineId, jobType };
  } catch (error: any) {
    logger.error({ machineId, jobType, error }, 'Failed to process check');
    await logAuditEvent({
      eventType: 'CHECK_EXECUTION_ERROR',
      level: 'ERROR',
      message: `Error executing ${jobType} for ${machine.hostname}`,
      machineId: machine.id,
      metadata: { jobType, error: error?.message ?? String(error) },
    });
    
    // Store failure in database
    await prisma.checkResult.create({
      data: {
        machineId,
        checkType: jobType as any,
        checkName: jobType,
        status: 'FAILED',
        resultData: {},
        message: error.message,
        duration: 0,
      },
    });

    throw error;
  }
}

// Initialize scheduler
export async function initJobScheduler() {
  logger.info('Initializing job scheduler');

  // Register job processor - handles ALL jobs in the queue
  checkQueue.process('*', 5, processJob);
  logger.info('Job processor registered for all job types with concurrency 5');

  // Add queue event handlers for debugging
  checkQueue.on('error', (error) => {
    logger.error({ error }, 'Queue error');
  });

  checkQueue.on('failed', (job, error) => {
    logger.error({ jobId: job.id, error }, 'Job failed');
  });

  checkQueue.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  checkQueue.on('active', (job) => {
    logger.info(`Job ${job.id} started processing`);
  });

  // Load all active scheduled jobs from database
  const scheduledJobs = await prisma.scheduledJob.findMany({
    where: { isActive: true },
    include: {
      targetMachines: {
        include: {
          machine: true,
        },
      },
    },
  });

  for (const job of scheduledJobs) {
    await scheduleJob(job.id);
  }

  logger.info(`Scheduled ${scheduledJobs.length} jobs`);
  logger.info('Queue processor is ready to process jobs');
}

/**
 * Schedule a job based on its cron expression
 */
export async function scheduleJob(jobId: string) {
  const job = await prisma.scheduledJob.findUnique({
    where: { id: jobId },
    include: {
      targetMachines: {
        include: {
          machine: true,
        },
      },
    },
  });

  if (!job || !job.isActive) {
    logger.warn(`Job ${jobId} not found or inactive`);
    return;
  }

  // Get target machines
  const machines = job.targetAll
    ? await prisma.machine.findMany()
    : job.targetMachines.map((jm) => jm.machine);

  // Schedule repeating job
  await checkQueue.add(
    `scheduled-${job.id}`,
    {
      scheduledJobId: job.id,
      jobType: job.jobType,
      machines: machines.map((m) => m.id),
    },
    {
      repeat: {
        cron: job.cronExpression,
      },
      jobId: `scheduled-${job.id}`,
    }
  );

  logger.info(`Scheduled job ${job.name} with cron: ${job.cronExpression}`);
}

/**
 * Remove scheduled job
 */
export async function unscheduleJob(jobId: string) {
  const repeatableJobs = await checkQueue.getRepeatableJobs();
  const job = repeatableJobs.find((j) => j.id === `scheduled-${jobId}`);

  if (job) {
    await checkQueue.removeRepeatableByKey(job.key);
    logger.info(`Unscheduled job ${jobId}`);
  }
}

/**
 * Manually trigger a check for a machine
 */
export async function triggerCheck(machineId: string, jobType: string, checkConfig?: any) {
  await checkQueue.add('manual-check', {
    jobType,
    machineId,
    checkConfig,
  });

  logger.info(`Manually triggered ${jobType} check for machine ${machineId}`);
}

