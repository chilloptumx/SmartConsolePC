import { Router } from 'express';
import { prisma } from '../services/database.js';

const router = Router();

function safeJsonParse(input: any) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'object') return input;
  if (typeof input !== 'string') return input;
  const s = input.trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function normalizeUserString(u?: string | null) {
  if (!u) return null;
  const full = String(u).trim();
  if (!full) return null;
  const short = full.includes('\\') ? full.split('\\').pop() || full : full;
  return {
    full,
    short,
    fullLower: full.toLowerCase(),
    shortLower: short.toLowerCase(),
  };
}

function extractUserInfo(resultData: any): { currentUser?: string; lastUser?: string } {
  const data = resultData && typeof resultData === 'object' ? resultData : {};

  const currentRaw = (data as any).currentUser ?? (data as any).current_user;
  const lastRaw = (data as any).lastUser ?? (data as any).last_user;

  const currentParsed = safeJsonParse(currentRaw) ?? currentRaw;
  const lastParsed = safeJsonParse(lastRaw) ?? lastRaw;

  let currentUser: string | undefined;
  if (Array.isArray(currentParsed)) {
    const active = currentParsed.find((r) => String((r as any)?.State ?? (r as any)?.state ?? '').toLowerCase() === 'active');
    const row = active ?? currentParsed[0];
    const u = (row as any)?.Username ?? (row as any)?.username ?? (row as any)?.User ?? (row as any)?.user;
    if (u) currentUser = String(u);
  } else if (currentParsed && typeof currentParsed === 'object') {
    const u = (currentParsed as any)?.Username ?? (currentParsed as any)?.username;
    if (u) currentUser = String(u);
  } else if (typeof currentParsed === 'string') {
    const s = currentParsed.trim();
    if (s && s.toLowerCase() !== 'unknown') currentUser = s;
  }

  let lastUser: string | undefined;
  if (lastParsed && typeof lastParsed === 'object' && !Array.isArray(lastParsed)) {
    const u = (lastParsed as any)?.LastUser ?? (lastParsed as any)?.lastUser ?? (lastParsed as any)?.last_user;
    if (u) lastUser = String(u);
  } else if (typeof lastParsed === 'string') {
    const s = lastParsed.trim();
    if (s) lastUser = s;
  }

  // Normalize obvious placeholders
  if (lastUser && String(lastUser).toLowerCase() === 'unknown') lastUser = undefined;

  return { currentUser, lastUser };
}

// List distinct "collected objects" (checkType + checkName) ever recorded.
// - If `machineId` is provided: objects collected for that machine (used by PC Viewer filters)
// - If `scope=all`: objects collected across all machines (used by Dashboard column picker)
router.get('/collected-objects', async (req, res) => {
  const { machineId, checkType, scope } = req.query;

  const where: any = {};
  const isAll = scope === 'all';

  if (!isAll) {
    if (!machineId || Array.isArray(machineId)) {
      return res.status(400).json({ error: 'machineId is required (or pass scope=all)' });
    }
    where.machineId = machineId;
  }
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

// Fetch latest check result per machine for a selected set of collected objects.
// This powers the dynamic Dashboard columns without pulling the entire history.
router.post('/latest-results', async (req, res) => {
  const body = (req.body ?? {}) as any;
  const machineIds = Array.isArray(body.machineIds) ? body.machineIds : [];
  const objects = Array.isArray(body.objects) ? body.objects : [];
  const sinceRaw = typeof body.since === 'string' ? body.since.trim() : '';
  const sinceParsed = sinceRaw ? new Date(sinceRaw) : null;
  const since = sinceParsed && !Number.isNaN(sinceParsed.getTime()) ? sinceParsed : null;

  if (machineIds.length === 0) return res.json({ results: [] });
  if (objects.length === 0) return res.json({ results: [] });

  if (machineIds.length > 200) {
    return res.status(400).json({ error: 'machineIds is too large' });
  }
  if (objects.length > 100) {
    return res.status(400).json({ error: 'objects is too large' });
  }

  const or = objects
    .map((o: any) => ({
      checkType: o.checkType,
      checkName: o.checkName,
    }))
    .filter((o: any) => typeof o.checkType === 'string' && typeof o.checkName === 'string');

  if (or.length === 0) return res.json({ results: [] });

  const rows = await prisma.checkResult.findMany({
    where: {
      machineId: { in: machineIds },
      OR: or,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: [
      { machineId: 'asc' },
      // IMPORTANT: do NOT order by checkType/checkName before createdAt.
      // `checkType` is a Postgres enum (ordered by enum definition), which can cluster results by type.
      // That clustering + the `take` limit can cause some requested objects to be missing entirely.
      { createdAt: 'desc' },
      { checkType: 'asc' },
      { checkName: 'asc' },
    ],
    // Upper bound to prevent huge payloads; we only need "latest" per (machine, object).
    // Use a slightly larger multiplier since ordering is now time-first, but keep a hard cap.
    take: Math.min(10000, machineIds.length * or.length * 25),
    select: {
      id: true,
      machineId: true,
      checkType: true,
      checkName: true,
      status: true,
      resultData: true,
      message: true,
      duration: true,
      createdAt: true,
    },
  });

  const seen = new Set<string>();
  const latest: any[] = [];
  for (const r of rows) {
    const key = `${r.machineId}::${r.checkType}::${r.checkName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(r);
    if (latest.length >= machineIds.length * or.length) break;
  }

  res.json({ results: latest });
});

// List distinct users seen in USER_INFO results (based on latest USER_INFO per machine).
// Used by Data Viewer "Current User" filter.
router.get('/users', async (req, res) => {
  const { mode = 'current' } = req.query as any;

  // Pull latest USER_INFO row per machine
  const rows = await prisma.checkResult.findMany({
    where: { checkType: 'USER_INFO' },
    orderBy: [{ machineId: 'asc' }, { createdAt: 'desc' }],
    take: 20000,
    select: { machineId: true, createdAt: true, resultData: true },
  });

  const latestByMachine = new Map<string, any>();
  for (const r of rows) {
    if (!latestByMachine.has(r.machineId)) latestByMachine.set(r.machineId, r);
  }

  const out = new Set<string>();
  for (const r of latestByMachine.values()) {
    const info = extractUserInfo(r.resultData);
    if (mode === 'last' || mode === 'both') {
      const n = normalizeUserString(info.lastUser);
      if (n) out.add(n.full);
    }
    if (mode === 'current' || mode === 'both') {
      const n = normalizeUserString(info.currentUser);
      if (n) out.add(n.full);
    }
  }

  res.json(Array.from(out).sort((a, b) => a.localeCompare(b)));
});

// Get check results with filtering and pagination
router.get('/results', async (req, res) => {
  const {
    machineId,
    checkType,
    status,
    loggedInUser,
    loggedInUserMode = 'current',
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

  // Filter by current logged-in user (based on latest USER_INFO per machine).
  if (loggedInUser && !Array.isArray(loggedInUser)) {
    const wanted = normalizeUserString(String(loggedInUser));
    if (wanted) {
      const rows = await prisma.checkResult.findMany({
        where: { checkType: 'USER_INFO' },
        orderBy: [{ machineId: 'asc' }, { createdAt: 'desc' }],
        take: 20000,
        select: { machineId: true, createdAt: true, resultData: true },
      });

      const latestByMachine = new Map<string, any>();
      for (const r of rows) {
        if (!latestByMachine.has(r.machineId)) latestByMachine.set(r.machineId, r);
      }

      const matchingMachineIds: string[] = [];
      for (const r of latestByMachine.values()) {
        const info = extractUserInfo(r.resultData);
        const current = normalizeUserString(info.currentUser);
        const last = normalizeUserString(info.lastUser);

        const match = (n: any) =>
          !!n &&
          (n.fullLower === wanted.fullLower ||
            n.shortLower === wanted.fullLower ||
            n.fullLower === wanted.shortLower ||
            n.shortLower === wanted.shortLower);

        const mode = String(loggedInUserMode || 'current').toLowerCase();
        const ok =
          mode === 'last'
            ? match(last)
            : mode === 'either' || mode === 'both'
              ? match(current) || match(last)
              : match(current); // current (default)

        if (ok) matchingMachineIds.push(r.machineId);
      }

      // Intersect with any existing machineId filter
      let existing: string[] | null = null;
      if (typeof where.machineId === 'string') existing = [where.machineId];
      if (where.machineId && typeof where.machineId === 'object' && Array.isArray(where.machineId.in)) existing = where.machineId.in;

      const finalIds = existing ? matchingMachineIds.filter((id) => existing!.includes(id)) : matchingMachineIds;
      where.machineId = { in: finalIds };
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
          location: { select: { name: true } },
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
      machine: { include: { location: { select: { name: true } } } },
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
      machine: { include: { location: { select: { name: true } } } },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10000, // Limit exports
  });

  // Convert to CSV
  const headers = ['Timestamp', 'Machine', 'Location', 'IP Address', 'Check Type', 'Check Name', 'Status', 'Duration (ms)', 'Message'];
  const rows = results.map((r) => [
    new Date(r.createdAt).toISOString(),
    `${r.machine.hostname} (${(r.machine as any).location?.name || 'Undefined'})`,
    (r.machine as any).location?.name || 'Undefined',
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

