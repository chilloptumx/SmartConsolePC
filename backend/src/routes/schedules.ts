import { Router } from 'express';
import { prisma } from '../services/database.js';
import { scheduleJob, unscheduleJob, triggerCheck } from '../services/job-scheduler.js';
import { logger } from '../services/logger.js';
import { logAuditEvent } from '../services/audit.js';

const router = Router();

// Get all scheduled jobs
router.get('/jobs', async (req, res) => {
  const jobs = await prisma.scheduledJob.findMany({
    include: {
      targetMachines: {
        include: {
          machine: {
            select: {
              id: true,
              hostname: true,
              ipAddress: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(jobs);
});

// Get single job
router.get('/jobs/:id', async (req, res) => {
  const job = await prisma.scheduledJob.findUnique({
    where: { id: req.params.id },
    include: {
      targetMachines: {
        include: {
          machine: true,
        },
      },
    },
  });

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

// Create scheduled job
router.post('/jobs', async (req, res) => {
  const { name, jobType, cronExpression, targetAll, targetMachineIds } = req.body;

  if (!name || !jobType || !cronExpression) {
    return res.status(400).json({ error: 'Name, job type, and cron expression required' });
  }

  // Validate cron expression (basic validation)
  const cronParts = cronExpression.split(' ');
  if (cronParts.length < 5) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }

  const job = await prisma.scheduledJob.create({
    data: {
      name,
      jobType,
      cronExpression,
      targetAll: targetAll ?? true,
      targetMachines: !targetAll && targetMachineIds
        ? {
            create: targetMachineIds.map((machineId: string) => ({
              machineId,
            })),
          }
        : undefined,
    },
  });

  // Schedule the job in Bull
  await scheduleJob(job.id);

  logger.info(`Created scheduled job: ${name}`);
  await logAuditEvent({
    eventType: 'SCHEDULED_JOB_CREATED',
    message: `Scheduled job created: ${name}`,
    entityType: 'ScheduledJob',
    entityId: job.id,
    metadata: { id: job.id, name, jobType, cronExpression, targetAll: job.targetAll, isActive: job.isActive },
  });
  res.status(201).json(job);
});

// Update scheduled job
router.put('/jobs/:id', async (req, res) => {
  const { name, jobType, cronExpression, targetAll, targetMachineIds, isActive } = req.body;

  // If cron expression changed, need to reschedule
  const existingJob = await prisma.scheduledJob.findUnique({
    where: { id: req.params.id },
  });

  if (!existingJob) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Update job in database
  const job = await prisma.scheduledJob.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(jobType && { jobType }),
      ...(cronExpression && { cronExpression }),
      ...(targetAll !== undefined && { targetAll }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  // Update target machines if provided
  if (targetMachineIds !== undefined) {
    // Delete existing associations
    await prisma.jobMachine.deleteMany({
      where: { jobId: req.params.id },
    });

    // Create new associations
    if (!targetAll && targetMachineIds.length > 0) {
      await prisma.jobMachine.createMany({
        data: targetMachineIds.map((machineId: string) => ({
          jobId: req.params.id,
          machineId,
        })),
      });
    }
  }

  // Reschedule if cron or active status changed
  if (cronExpression || isActive !== undefined) {
    await unscheduleJob(req.params.id);
    if (job.isActive) {
      await scheduleJob(req.params.id);
    }
  }

  await logAuditEvent({
    eventType: 'SCHEDULED_JOB_UPDATED',
    message: `Scheduled job updated: ${job.name}`,
    entityType: 'ScheduledJob',
    entityId: job.id,
    metadata: { id: job.id, name, jobType, cronExpression, targetAll, isActive },
  });
  res.json(job);
});

// Delete scheduled job
router.delete('/jobs/:id', async (req, res) => {
  const existing = await prisma.scheduledJob.findUnique({ where: { id: req.params.id } });
  // Unschedule from Bull
  await unscheduleJob(req.params.id);

  // Delete from database
  await prisma.scheduledJob.delete({
    where: { id: req.params.id },
  });

  logger.info(`Deleted scheduled job: ${req.params.id}`);
  await logAuditEvent({
    eventType: 'SCHEDULED_JOB_DELETED',
    message: `Scheduled job deleted: ${existing?.name ?? req.params.id}`,
    entityType: 'ScheduledJob',
    entityId: req.params.id,
    metadata: { id: req.params.id, name: existing?.name, jobType: existing?.jobType, cronExpression: existing?.cronExpression },
  });
  res.json({ success: true });
});

// Manually run a scheduled job now
router.post('/jobs/:id/run-now', async (req, res) => {
  const job = await prisma.scheduledJob.findUnique({
    where: { id: req.params.id },
    include: {
      targetMachines: {
        include: {
          machine: true,
        },
      },
    },
  });

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Get target machines
  const machines = job.targetAll
    ? await prisma.machine.findMany()
    : job.targetMachines.map((jm) => jm.machine);

  // Queue checks for all target machines
  for (const machine of machines) {
    await triggerCheck(machine.id, job.jobType);
  }

  // Update last run time
  await prisma.scheduledJob.update({
    where: { id: req.params.id },
    data: { lastRunAt: new Date() },
  });

  logger.info(`Manually triggered job: ${job.name}`);
  await logAuditEvent({
    eventType: 'SCHEDULED_JOB_RUN_NOW',
    message: `Scheduled job run-now: ${job.name} (${machines.length} machines)`,
    entityType: 'ScheduledJob',
    entityId: job.id,
    metadata: { id: job.id, name: job.name, jobType: job.jobType, machines: machines.map((m) => ({ id: m.id, hostname: m.hostname })) },
  });
  res.json({ success: true, message: `Queued ${machines.length} checks` });
});

export default router;

