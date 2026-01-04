import { Router } from 'express';
import { prisma } from '../services/database.js';

const router = Router();

// List distinct "collected objects" (checkType + checkName) ever recorded for a machine.
// This powers dynamic filters in Historical Reports without fetching all rows.
router.get('/collected-objects', async (req, res) => {
  const { machineId, checkType } = req.query;

  if (!machineId || Array.isArray(machineId)) {
    return res.status(400).json({ error: 'machineId is required' });
  }

  const where: any = { machineId };
  if (checkType) {
    where.checkType = Array.isArray(checkType) ? { in: checkType } : checkType;
  }

  const rows = await prisma.checkResult.groupBy({
    by: ['checkType', 'checkName'],
    where,
    _count: { _all: true },
    _min: { createdAt: true },
    _max: { createdAt: true },
    orderBy: [{ checkType: 'asc' }, { checkName: 'asc' }],
  });

  res.json(
    rows.map((r) => ({
      checkType: r.checkType,
      checkName: r.checkName,
      total: r._count._all,
      firstSeen: r._min.createdAt,
      lastSeen: r._max.createdAt,
    }))
  );
});

// Get check results with filtering and pagination
router.get('/results', async (req, res) => {
  const {
    machineId,
    checkType,
    status,
    dateFrom,
    dateTo,
    page = '1',
    limit = '50',
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: any = {};

  if (machineId) {
    if (Array.isArray(machineId)) {
      where.machineId = { in: machineId };
    } else {
      where.machineId = machineId;
    }
  }

  if (checkType) {
    if (Array.isArray(checkType)) {
      where.checkType = { in: checkType };
    } else {
      where.checkType = checkType;
    }
  }

  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status };
    } else {
      where.status = status;
    }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      where.createdAt.lte = new Date(dateTo as string);
    }
  }

  // Get total count
  const total = await prisma.checkResult.count({ where });

  // Get results
  const results = await prisma.checkResult.findMany({
    where,
    include: {
      machine: {
        select: {
          id: true,
          hostname: true,
          ipAddress: true,
          pcModel: true,
        },
      },
    },
    orderBy: {
      [sortBy as string]: sortOrder as 'asc' | 'desc',
    },
    skip,
    take: limitNum,
  });

  res.json({
    results,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

// Get single result detail
router.get('/results/:id', async (req, res) => {
  const result = await prisma.checkResult.findUnique({
    where: { id: req.params.id },
    include: {
      machine: true,
    },
  });

  if (!result) {
    return res.status(404).json({ error: 'Result not found' });
  }

  res.json(result);
});

// Export results as CSV
router.get('/results/export', async (req, res) => {
  const {
    machineId,
    checkType,
    status,
    dateFrom,
    dateTo,
  } = req.query;

  // Build where clause (same as above)
  const where: any = {};

  if (machineId) {
    if (Array.isArray(machineId)) {
      where.machineId = { in: machineId };
    } else {
      where.machineId = machineId;
    }
  }

  if (checkType) {
    if (Array.isArray(checkType)) {
      where.checkType = { in: checkType };
    } else {
      where.checkType = checkType;
    }
  }

  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status };
    } else {
      where.status = status;
    }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      where.createdAt.lte = new Date(dateTo as string);
    }
  }

  const results = await prisma.checkResult.findMany({
    where,
    include: {
      machine: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10000, // Limit exports
  });

  // Convert to CSV
  const headers = ['Timestamp', 'Machine', 'IP Address', 'Check Type', 'Check Name', 'Status', 'Duration (ms)', 'Message'];
  const rows = results.map((r) => [
    new Date(r.createdAt).toISOString(),
    r.machine.hostname,
    r.machine.ipAddress,
    r.checkType,
    r.checkName,
    r.status,
    r.duration?.toString() || '',
    r.message || '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="healthcheck-results-${Date.now()}.csv"`);
  res.send(csv);
});

// Get statistics/summary
router.get('/stats', async (req, res) => {
  const totalMachines = await prisma.machine.count();
  const onlineMachines = await prisma.machine.count({
    where: { status: 'ONLINE' },
  });
  const offlineMachines = await prisma.machine.count({
    where: { status: 'OFFLINE' },
  });

  const totalChecks = await prisma.checkResult.count();
  const recentChecks = await prisma.checkResult.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
  });

  const failedChecks = await prisma.checkResult.count({
    where: {
      status: 'FAILED',
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  res.json({
    machines: {
      total: totalMachines,
      online: onlineMachines,
      offline: offlineMachines,
    },
    checks: {
      total: totalChecks,
      last24Hours: recentChecks,
      failedLast24Hours: failedChecks,
    },
  });
});

export default router;

