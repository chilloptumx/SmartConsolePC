import { Router } from 'express';
import { prisma } from '../services/database.js';

const router = Router();

// Combined Job Monitor feed:
// - Audit events (created by backend when actions occur)
// - Check results (already persisted; represent executed checks)
router.get('/events', async (req, res) => {
  const {
    machineId,
    source = 'all', // all | audit | check
    limit = '100',
    before, // ISO timestamp cursor
    search,
  } = req.query as any;

  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const rawBefore = (before ?? '').toString().trim();
  const parsedBefore = rawBefore ? new Date(rawBefore) : undefined;
  const beforeDate = parsedBefore && !Number.isNaN(parsedBefore.getTime()) ? parsedBefore : undefined;
  const q = (search ?? '').toString().trim().toLowerCase();

  const wantAudit = source === 'all' || source === 'audit';
  const wantCheck = source === 'all' || source === 'check';

  const rawMachineId = (machineId ?? '').toString().trim();
  const normalizedMachineId =
    rawMachineId && rawMachineId !== 'undefined' && rawMachineId !== 'null' ? rawMachineId : undefined;

  const whereCreatedAt = beforeDate ? { lt: beforeDate } : undefined;

  const auditPromise = wantAudit
    ? prisma.auditEvent.findMany({
        where: {
          ...(normalizedMachineId ? { machineId: normalizedMachineId } : {}),
          ...(whereCreatedAt ? { createdAt: whereCreatedAt } : {}),
        },
        include: {
          machine: { select: { id: true, hostname: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limitNum * 3,
      })
    : Promise.resolve([]);

  const checkPromise = wantCheck
    ? prisma.checkResult.findMany({
        where: {
          ...(normalizedMachineId ? { machineId: normalizedMachineId } : {}),
          ...(whereCreatedAt ? { createdAt: whereCreatedAt } : {}),
        },
        include: {
          machine: { select: { id: true, hostname: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limitNum * 3,
      })
    : Promise.resolve([]);

  const [auditRows, checkRows] = await Promise.all([auditPromise, checkPromise]);

  const events = [
    ...auditRows.map((e) => ({
      id: `audit:${e.id}`,
      source: 'AUDIT' as const,
      createdAt: e.createdAt,
      machineId: e.machineId ?? undefined,
      machineHostname: e.machine?.hostname,
      level: e.level,
      eventType: e.eventType,
      title: e.message,
      status: undefined,
      details: e.metadata,
    })),
    ...checkRows.map((r) => ({
      id: `check:${r.id}`,
      source: 'CHECK_RESULT' as const,
      createdAt: r.createdAt,
      machineId: r.machineId,
      machineHostname: r.machine?.hostname,
      level: undefined,
      eventType: r.checkType,
      title: `${r.checkName} - ${r.status}`,
      status: r.status,
      details: {
        checkType: r.checkType,
        checkName: r.checkName,
        message: r.message,
        duration: r.duration,
        resultData: r.resultData,
      },
    })),
  ]
    .filter((e) => {
      if (!q) return true;
      const hay = `${e.machineHostname ?? ''} ${e.eventType} ${e.title}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limitNum);

  const nextCursor = events.length ? events[events.length - 1].createdAt.toISOString() : null;

  res.json({
    results: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    nextCursor,
  });
});

export default router;


