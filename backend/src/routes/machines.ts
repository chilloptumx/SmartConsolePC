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
    include: {
      location: { select: { id: true, name: true } },
    },
  });
  res.json(machines);
});

// ========== LOCATION DEFINITIONS ==========
// NOTE: Must be defined BEFORE `/:id` routes so `/locations` isn't captured as an id param.

router.get('/locations', async (req, res) => {
  const locations = await prisma.locationDefinition.findMany({
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json(locations);
});

router.post('/locations', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const created = await prisma.locationDefinition.create({
      data: {
        name: String(name),
        // Manual assignment mode: no IP range required.
        startIp: null,
        endIp: null,
        startIpInt: null,
        endIpInt: null,
      },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    await logAuditEvent({
      eventType: 'LOCATION_CREATED',
      message: `Location created: ${created.name}`,
      entityType: 'LocationDefinition',
      entityId: created.id,
      metadata: { ...created },
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Location name already exists' });
    }
    throw error;
  }
});

router.put('/locations/:id', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  const existing = await prisma.locationDefinition.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Location not found' });

  const updated = await prisma.locationDefinition.update({
    where: { id: req.params.id },
    data: { name: String(name) },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  await logAuditEvent({
    eventType: 'LOCATION_UPDATED',
    message: `Location updated: ${updated.name}`,
    entityType: 'LocationDefinition',
    entityId: updated.id,
    metadata: { before: { id: existing.id, name: existing.name }, after: updated },
  });

  res.json(updated);
});

router.delete('/locations/:id', async (req, res) => {
  const existing = await prisma.locationDefinition.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true },
  });
  if (!existing) return res.status(404).json({ error: 'Location not found' });

  await prisma.locationDefinition.delete({ where: { id: req.params.id } });

  logger.info(`Deleted location: ${req.params.id}`);
  await logAuditEvent({
    eventType: 'LOCATION_DELETED',
    message: `Location deleted: ${existing.name}`,
    entityType: 'LocationDefinition',
    entityId: existing.id,
    metadata: { ...existing },
  });
  res.json({ success: true });
});

// Get single machine
router.get('/:id', async (req, res) => {
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: {
      location: { select: { id: true, name: true } },
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
      include: {
        location: { select: { id: true, name: true } },
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
  const { hostname, ipAddress, pcModel, locationId } = req.body;

  const machine = await prisma.machine.update({
    where: { id: req.params.id },
    data: {
      ...(hostname && { hostname }),
      ...(ipAddress && { ipAddress }),
      ...(pcModel && { pcModel }),
      ...(locationId !== undefined && { locationId: locationId ? String(locationId) : null }),
    },
    include: { location: { select: { id: true, name: true } } },
  });

  await logAuditEvent({
    eventType: 'MACHINE_UPDATED',
    message: `Machine updated: ${machine.hostname}`,
    machineId: machine.id,
    entityType: 'Machine',
    entityId: machine.id,
    metadata: { hostname, ipAddress, pcModel, locationId: locationId ?? undefined },
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

