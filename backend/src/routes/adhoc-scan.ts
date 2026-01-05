import { Router } from 'express';
import { prisma } from '../services/database.js';
import { triggerCheck } from '../services/job-scheduler.js';
import { logAuditEvent } from '../services/audit.js';

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
  const userCheckIds = uniqStrings(body.userCheckIds);
  const systemCheckIds = uniqStrings(body.systemCheckIds);

  const machines = await prisma.machine.findMany({
    where: { id: { in: machineIds } },
    select: { id: true, hostname: true },
  });
  const foundIds = new Set(machines.map((m) => m.id));
  const missing = machineIds.filter((id) => !foundIds.has(id));
  if (missing.length) return res.status(404).json({ error: 'Some machines were not found', missingMachineIds: missing });

  const [registryChecks, fileChecks, userChecks, systemChecks] = await Promise.all([
    registryCheckIds.length
      ? prisma.registryCheck.findMany({ where: { id: { in: registryCheckIds } }, select: { id: true, name: true, isActive: true } })
      : Promise.resolve([]),
    fileCheckIds.length
      ? prisma.fileCheck.findMany({ where: { id: { in: fileCheckIds } }, select: { id: true, name: true, isActive: true } })
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

export default router;


