import { Router } from 'express';
import { prisma } from '../services/database.js';
import { triggerCheck } from '../services/job-scheduler.js';
import { logAuditEvent } from '../services/audit.js';
import crypto from 'crypto';
import {
  executePowerShell,
  getCurrentUser,
  getFileInfo,
  getLastUser,
  getRegistryValue,
  getServiceInfo,
  getSystemInfo,
  pingMachine,
  type ConnectionOptions,
  type PowerShellResult,
} from '../services/powershell-executor.js';
import { evaluateFileCheckResult, evaluateRegistryCheckResult, evaluateServiceCheckResult, parseResultData } from '../services/check-evaluators.js';

const router = Router();

type ExpectedObject = { machineId: string; checkType: string; checkName: string };

function uniqStrings(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalizeTargetHost(v: any): string {
  const s = typeof v === 'string' ? v.trim() : '';
  // Basic safety: keep it small and single-line. We intentionally allow hostnames, IPv4, host.docker.internal, etc.
  if (!s) return '';
  if (s.length > 255) return '';
  if (s.includes('\n') || s.includes('\r') || s.includes('\t')) return '';
  return s;
}

// Queue an on-demand scan comprised of specific configured checks.
// The UI polls `/api/data/latest-results` with `since=startedAt` to know when all expected objects have completed.
router.post('/run', async (req, res) => {
  const body = (req.body ?? {}) as any;

  const machineIds = uniqStrings(body.machineIds);
  if (machineIds.length === 0) return res.status(400).json({ error: 'machineIds is required' });
  if (machineIds.length > 200) return res.status(400).json({ error: 'machineIds is too large' });

  const builtIns = (body.builtIns ?? {}) as any;
  const includePing = Boolean(builtIns.ping);
  const includeUserInfo = Boolean(builtIns.userInfo);
  const includeSystemInfo = Boolean(builtIns.systemInfo);

  const registryCheckIds = uniqStrings(body.registryCheckIds);
  const fileCheckIds = uniqStrings(body.fileCheckIds);
  const serviceCheckIds = uniqStrings(body.serviceCheckIds);
  const userCheckIds = uniqStrings(body.userCheckIds);
  const systemCheckIds = uniqStrings(body.systemCheckIds);

  const machines = await prisma.machine.findMany({
    where: { id: { in: machineIds } },
    select: { id: true, hostname: true },
  });
  const foundIds = new Set(machines.map((m) => m.id));
  const missing = machineIds.filter((id) => !foundIds.has(id));
  if (missing.length) return res.status(404).json({ error: 'Some machines were not found', missingMachineIds: missing });

  const [registryChecks, fileChecks, serviceChecks, userChecks, systemChecks] = await Promise.all([
    registryCheckIds.length
      ? prisma.registryCheck.findMany({ where: { id: { in: registryCheckIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
    fileCheckIds.length
      ? prisma.fileCheck.findMany({ where: { id: { in: fileCheckIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
    serviceCheckIds.length
      ? (prisma as any).serviceCheck.findMany({ where: { id: { in: serviceCheckIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
    userCheckIds.length
      ? prisma.userCheck.findMany({ where: { id: { in: userCheckIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
    systemCheckIds.length
      ? prisma.systemCheck.findMany({ where: { id: { in: systemCheckIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
  ]);

  const startedAt = new Date();
  const expected: ExpectedObject[] = [];

  for (const machineId of machineIds) {
    if (includePing) {
      await triggerCheck(machineId, 'PING');
      expected.push({ machineId, checkType: 'PING', checkName: 'Ping Test' });
    }
    if (includeUserInfo) {
      // Passing a config object triggers the built-in "User Information" execution path.
      await triggerCheck(machineId, 'USER_INFO', { builtin: true });
      expected.push({ machineId, checkType: 'USER_INFO', checkName: 'User Information' });
    }
    if (includeSystemInfo) {
      // Passing a config object triggers the built-in "System Information" execution path.
      await triggerCheck(machineId, 'SYSTEM_INFO', { builtin: true });
      expected.push({ machineId, checkType: 'SYSTEM_INFO', checkName: 'System Information' });
    }

    for (const rc of registryChecks) {
      await triggerCheck(machineId, 'REGISTRY_CHECK', { registryCheckId: rc.id });
      expected.push({ machineId, checkType: 'REGISTRY_CHECK', checkName: rc.name });
    }

    for (const fc of fileChecks) {
      await triggerCheck(machineId, 'FILE_CHECK', { fileCheckId: fc.id });
      expected.push({ machineId, checkType: 'FILE_CHECK', checkName: fc.name });
    }

    for (const svc of serviceChecks) {
      await triggerCheck(machineId, 'SERVICE_CHECK', { serviceCheckId: svc.id });
      expected.push({ machineId, checkType: 'SERVICE_CHECK', checkName: svc.name });
    }

    for (const uc of userChecks) {
      await triggerCheck(machineId, 'USER_INFO', { userCheckId: uc.id });
      expected.push({ machineId, checkType: 'USER_INFO', checkName: uc.name });
    }

    for (const sc of systemChecks) {
      await triggerCheck(machineId, 'SYSTEM_INFO', { systemCheckId: sc.id });
      expected.push({ machineId, checkType: 'SYSTEM_INFO', checkName: sc.name });
    }
  }

  await logAuditEvent({
    eventType: 'ADHOC_SCAN_QUEUED',
    message: `Queued ad-hoc scan (${expected.length} checks)`,
    entityType: 'AdHocScan',
    entityId: startedAt.toISOString(),
    metadata: {
      machineIds,
      builtIns: { ping: includePing, userInfo: includeUserInfo, systemInfo: includeSystemInfo },
      selected: {
        registryCheckIds,
        fileCheckIds,
        serviceCheckIds,
        userCheckIds,
        systemCheckIds,
      },
      expectedCount: expected.length,
      startedAt: startedAt.toISOString(),
    },
  });

  res.json({
    startedAt: startedAt.toISOString(),
    machineIds,
    expected,
    expectedCount: expected.length,
    note: 'Poll /api/data/latest-results with { machineIds, objects, since: startedAt } until all expected objects have results.',
  });
});

// Run an on-demand scan directly against a one-off target (hostname/IP) WITHOUT creating a Machine record.
// Results are returned immediately and are NOT persisted to the DB.
router.post('/run-direct', async (req, res) => {
  const body = (req.body ?? {}) as any;

  const targetHost = normalizeTargetHost(body.targetHost);
  if (!targetHost) return res.status(400).json({ error: 'targetHost is required' });

  const builtIns = (body.builtIns ?? {}) as any;
  const includePing = Boolean(builtIns.ping);
  const includeUserInfo = Boolean(builtIns.userInfo);
  const includeSystemInfo = Boolean(builtIns.systemInfo);

  const registryCheckIds = uniqStrings(body.registryCheckIds);
  const fileCheckIds = uniqStrings(body.fileCheckIds);
  const serviceCheckIds = uniqStrings(body.serviceCheckIds);
  const userCheckIds = uniqStrings(body.userCheckIds);
  const systemCheckIds = uniqStrings(body.systemCheckIds);

  if (registryCheckIds.length > 500) return res.status(400).json({ error: 'registryCheckIds is too large' });
  if (fileCheckIds.length > 500) return res.status(400).json({ error: 'fileCheckIds is too large' });
  if (serviceCheckIds.length > 500) return res.status(400).json({ error: 'serviceCheckIds is too large' });
  if (userCheckIds.length > 500) return res.status(400).json({ error: 'userCheckIds is too large' });
  if (systemCheckIds.length > 500) return res.status(400).json({ error: 'systemCheckIds is too large' });

  const [registryChecks, fileChecks, serviceChecks, userChecks, systemChecks] = await Promise.all([
    registryCheckIds.length
      ? prisma.registryCheck.findMany({
          where: { id: { in: registryCheckIds } },
          select: { id: true, name: true, isActive: true, registryPath: true, valueName: true, expectedValue: true },
        })
      : Promise.resolve([]),
    fileCheckIds.length
      ? prisma.fileCheck.findMany({
          where: { id: { in: fileCheckIds } },
          select: { id: true, name: true, isActive: true, filePath: true, checkExists: true },
        })
      : Promise.resolve([]),
    serviceCheckIds.length
      ? (prisma as any).serviceCheck.findMany({
          where: { id: { in: serviceCheckIds } },
          select: { id: true, name: true, isActive: true, serviceName: true, executablePath: true, expectedStatus: true },
        })
      : Promise.resolve([]),
    userCheckIds.length
      ? prisma.userCheck.findMany({
          where: { id: { in: userCheckIds } },
          select: { id: true, name: true, isActive: true, checkType: true, customScript: true },
        })
      : Promise.resolve([]),
    systemCheckIds.length
      ? prisma.systemCheck.findMany({
          where: { id: { in: systemCheckIds } },
          select: { id: true, name: true, isActive: true, checkType: true, customScript: true },
        })
      : Promise.resolve([]),
  ]);

  const startedAt = new Date();
  const targetId = `manual:${crypto.randomUUID()}`;
  const expected: ExpectedObject[] = [];

  const connection: ConnectionOptions = {
    hostname: targetHost,
    ipAddress: targetHost,
    useSSH: true,
  };

  type DirectResult = {
    id: string;
    machineId: string;
    checkType: string;
    checkName: string;
    status: string;
    resultData: any;
    message?: string | null;
    duration?: number | null;
    createdAt: string;
  };

  const results: DirectResult[] = [];
  const nowIso = () => new Date().toISOString();

  const pushResult = (r: Omit<DirectResult, 'id'>) => {
    results.push({ id: crypto.randomUUID(), ...r });
  };

  // Built-ins
  if (includePing) expected.push({ machineId: targetId, checkType: 'PING', checkName: 'Ping Test' });
  if (includeUserInfo) expected.push({ machineId: targetId, checkType: 'USER_INFO', checkName: 'User Information' });
  if (includeSystemInfo) expected.push({ machineId: targetId, checkType: 'SYSTEM_INFO', checkName: 'System Information' });

  for (const rc of registryChecks) expected.push({ machineId: targetId, checkType: 'REGISTRY_CHECK', checkName: rc.name });
  for (const fc of fileChecks) expected.push({ machineId: targetId, checkType: 'FILE_CHECK', checkName: fc.name });
  for (const svc of serviceChecks) expected.push({ machineId: targetId, checkType: 'SERVICE_CHECK', checkName: svc.name });
  for (const uc of userChecks) expected.push({ machineId: targetId, checkType: 'USER_INFO', checkName: uc.name });
  for (const sc of systemChecks) expected.push({ machineId: targetId, checkType: 'SYSTEM_INFO', checkName: sc.name });

  // Execute checks (sequential for predictable WinRM load; these calls are already network-bound)
  if (includePing) {
    const ps = await pingMachine(connection);
    pushResult({
      machineId: targetId,
      checkType: 'PING',
      checkName: 'Ping Test',
      status: ps.success ? 'SUCCESS' : 'FAILED',
      resultData: parseResultData(ps.output),
      message: ps.error ?? null,
      duration: ps.duration,
      createdAt: nowIso(),
    });
  }

  if (includeUserInfo) {
    const currentUser = await getCurrentUser(connection);
    const lastUser = await getLastUser(connection);
    const userResult: PowerShellResult = {
      success: currentUser.success && lastUser.success,
      output: JSON.stringify({ currentUser: currentUser.output, lastUser: lastUser.output }),
      duration: currentUser.duration + lastUser.duration,
      error: currentUser.error || lastUser.error,
    };
    pushResult({
      machineId: targetId,
      checkType: 'USER_INFO',
      checkName: 'User Information',
      status: userResult.success ? 'SUCCESS' : 'FAILED',
      resultData: parseResultData(userResult.output),
      message: userResult.error ?? null,
      duration: userResult.duration,
      createdAt: nowIso(),
    });
  }

  if (includeSystemInfo) {
    const ps = await getSystemInfo(connection);
    pushResult({
      machineId: targetId,
      checkType: 'SYSTEM_INFO',
      checkName: 'System Information',
      status: ps.success ? 'SUCCESS' : 'FAILED',
      resultData: parseResultData(ps.output),
      message: ps.error ?? null,
      duration: ps.duration,
      createdAt: nowIso(),
    });
  }

  for (const rc of registryChecks) {
    const ps = await getRegistryValue(connection, rc.registryPath, rc.valueName ?? undefined);
    const evaluated = evaluateRegistryCheckResult(
      { registryPath: rc.registryPath, valueName: rc.valueName, expectedValue: rc.expectedValue },
      ps
    );
    pushResult({
      machineId: targetId,
      checkType: 'REGISTRY_CHECK',
      checkName: rc.name,
      status: evaluated.status,
      resultData: evaluated.data,
      message: evaluated.message ?? null,
      duration: ps.duration,
      createdAt: nowIso(),
    });
  }

  for (const fc of fileChecks) {
    const ps = await getFileInfo(connection, fc.filePath);
    const evaluated = evaluateFileCheckResult({ filePath: fc.filePath, checkExists: fc.checkExists }, ps);
    pushResult({
      machineId: targetId,
      checkType: 'FILE_CHECK',
      checkName: fc.name,
      status: evaluated.status,
      resultData: evaluated.data,
      message: evaluated.message ?? null,
      duration: ps.duration,
      createdAt: nowIso(),
    });
  }

  for (const svc of serviceChecks) {
    const ps = await getServiceInfo(connection, { serviceName: svc.serviceName, executablePath: svc.executablePath });
    const evaluated = evaluateServiceCheckResult(
      { serviceName: svc.serviceName, executablePath: svc.executablePath, expectedStatus: svc.expectedStatus },
      ps
    );
    pushResult({
      machineId: targetId,
      checkType: 'SERVICE_CHECK',
      checkName: svc.name,
      status: evaluated.status,
      resultData: evaluated.data,
      message: evaluated.message ?? null,
      duration: ps.duration,
      createdAt: nowIso(),
    });
  }

  for (const uc of userChecks) {
    let ps: PowerShellResult;
    if (uc.checkType === 'CURRENT_AND_LAST') {
      const currentUser = await getCurrentUser(connection);
      const lastUser = await getLastUser(connection);
      ps = {
        success: currentUser.success && lastUser.success,
        output: JSON.stringify({ currentUser: currentUser.output, lastUser: lastUser.output }),
        duration: currentUser.duration + lastUser.duration,
        error: currentUser.error || lastUser.error,
      };
    } else if (uc.checkType === 'CURRENT_ONLY') {
      const currentUser = await getCurrentUser(connection);
      ps = {
        success: currentUser.success,
        output: JSON.stringify({ currentUser: currentUser.output }),
        duration: currentUser.duration,
        error: currentUser.error,
      };
    } else if (uc.checkType === 'LAST_ONLY') {
      const lastUser = await getLastUser(connection);
      ps = {
        success: lastUser.success,
        output: JSON.stringify({ lastUser: lastUser.output }),
        duration: lastUser.duration,
        error: lastUser.error,
      };
    } else if (uc.checkType === 'CUSTOM' && uc.customScript) {
      ps = await executePowerShell(uc.customScript, connection);
    } else {
      const currentUser = await getCurrentUser(connection);
      const lastUser = await getLastUser(connection);
      ps = {
        success: currentUser.success && lastUser.success,
        output: JSON.stringify({ currentUser: currentUser.output, lastUser: lastUser.output }),
        duration: currentUser.duration + lastUser.duration,
        error: currentUser.error || lastUser.error,
      };
    }

    pushResult({
      machineId: targetId,
      checkType: 'USER_INFO',
      checkName: uc.name,
      status: ps.success ? 'SUCCESS' : 'FAILED',
      resultData: parseResultData(ps.output),
      message: ps.error ?? null,
      duration: ps.duration,
      createdAt: nowIso(),
    });
  }

  for (const sc of systemChecks) {
    let ps: PowerShellResult;
    if (sc.checkType === 'SYSTEM_INFO') {
      ps = await getSystemInfo(connection);
    } else if (sc.checkType === 'CUSTOM' && sc.customScript) {
      ps = await executePowerShell(sc.customScript, connection);
    } else {
      ps = await getSystemInfo(connection);
    }

    pushResult({
      machineId: targetId,
      checkType: 'SYSTEM_INFO',
      checkName: sc.name,
      status: ps.success ? 'SUCCESS' : 'FAILED',
      resultData: parseResultData(ps.output),
      message: ps.error ?? null,
      duration: ps.duration,
      createdAt: nowIso(),
    });
  }

  await logAuditEvent({
    eventType: 'ADHOC_SCAN_DIRECT',
    message: `Completed direct ad-hoc scan (${expected.length} checks) for ${targetHost}`,
    entityType: 'AdHocScan',
    entityId: startedAt.toISOString(),
    metadata: {
      targetHost,
      targetId,
      builtIns: { ping: includePing, userInfo: includeUserInfo, systemInfo: includeSystemInfo },
      selected: { registryCheckIds, fileCheckIds, serviceCheckIds, userCheckIds, systemCheckIds },
      expectedCount: expected.length,
      startedAt: startedAt.toISOString(),
      persisted: false,
    },
  });

  return res.json({
    startedAt: startedAt.toISOString(),
    targetHost,
    targetId,
    expected,
    expectedCount: expected.length,
    results,
    note: 'Direct ad-hoc scan completed. Results are not persisted (manual target is not added to the system).',
  });
});

export default router;


