import { Router } from 'express';
import { prisma } from '../services/database.js';
import { triggerCheck } from '../services/job-scheduler.js';
import { logger } from '../services/logger.js';
import { logAuditEvent } from '../services/audit.js';

const router = Router();

// Get all machines
router.get('/', async (req, res) => {
  const machines = await prisma.machine.findMany({
    orderBy: { hostname: 'asc' },
  });
  res.json(machines);
});

// Get single machine
router.get('/:id', async (req, res) => {
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: {
      checkResults: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!machine) {
    return res.status(404).json({ error: 'Machine not found' });
  }

  res.json(machine);
});

// Add new machine
router.post('/', async (req, res) => {
  const { hostname, ipAddress, pcModel } = req.body;

  if (!hostname || !ipAddress) {
    return res.status(400).json({ error: 'Hostname and IP address required' });
  }

  try {
    const machine = await prisma.machine.create({
      data: {
        hostname,
        ipAddress,
        pcModel,
        status: 'UNKNOWN',
      },
    });

    logger.info(`Added new machine: ${hostname}`);
    await logAuditEvent({
      eventType: 'MACHINE_CREATED',
      message: `Machine created: ${hostname}`,
      machineId: machine.id,
      entityType: 'Machine',
      entityId: machine.id,
      metadata: { hostname, ipAddress, pcModel },
    });
    res.status(201).json(machine);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Machine with this hostname already exists' });
    }
    throw error;
  }
});

// Update machine
router.put('/:id', async (req, res) => {
  const { hostname, ipAddress, pcModel } = req.body;

  const machine = await prisma.machine.update({
    where: { id: req.params.id },
    data: {
      ...(hostname && { hostname }),
      ...(ipAddress && { ipAddress }),
      ...(pcModel && { pcModel }),
    },
  });

  await logAuditEvent({
    eventType: 'MACHINE_UPDATED',
    message: `Machine updated: ${machine.hostname}`,
    machineId: machine.id,
    entityType: 'Machine',
    entityId: machine.id,
    metadata: { hostname, ipAddress, pcModel },
  });
  res.json(machine);
});

// Delete machine
router.delete('/:id', async (req, res) => {
  const machine = await prisma.machine.findUnique({ where: { id: req.params.id } });
  await prisma.machine.delete({
    where: { id: req.params.id },
  });

  logger.info(`Deleted machine: ${req.params.id}`);
  await logAuditEvent({
    eventType: 'MACHINE_DELETED',
    message: `Machine deleted: ${machine?.hostname ?? req.params.id}`,
    machineId: req.params.id,
    entityType: 'Machine',
    entityId: req.params.id,
    metadata: { hostname: machine?.hostname, ipAddress: machine?.ipAddress },
  });
  res.json({ success: true });
});

// Get machine status
router.get('/:id/status', async (req, res) => {
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
  });

  if (!machine) {
    return res.status(404).json({ error: 'Machine not found' });
  }

  const recentResults = await prisma.checkResult.findMany({
    where: { machineId: req.params.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  res.json({
    machine,
    recentResults,
  });
});

// Trigger manual check
router.post('/:id/check', async (req, res) => {
  const { checkType } = req.body;

  if (!checkType) {
    return res.status(400).json({ error: 'Check type required' });
  }

  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
  });

  if (!machine) {
    return res.status(404).json({ error: 'Machine not found' });
  }

  await triggerCheck(machine.id, checkType);
  await logAuditEvent({
    eventType: 'CHECK_QUEUED',
    message: `Queued ${checkType} for ${machine.hostname}`,
    machineId: machine.id,
    entityType: 'Machine',
    entityId: machine.id,
    metadata: { checkType },
  });
  
  res.json({ success: true, message: `${checkType} check queued for ${machine.hostname}` });
});

export default router;

