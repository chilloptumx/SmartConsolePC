import { prisma } from './database.js';

export type LocationDefinitionRow = {
  id: string;
  name: string;
  startIp: string | null;
  endIp: string | null;
  startIpInt: bigint | null;
  endIpInt: bigint | null;
};

export function ipv4ToBigInt(ip: string): bigint | null {
  if (!ip) return null;
  const s = ip.trim();
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => {
    if (!/^\d+$/.test(p)) return NaN;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return NaN;
    return n;
  });
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [a, b, c, d] = nums;
  return (BigInt(a) << 24n) | (BigInt(b) << 16n) | (BigInt(c) << 8n) | BigInt(d);
}

export function findMatchingLocationId(ip: string, locations: LocationDefinitionRow[]): string | null {
  const ipInt = ipv4ToBigInt(ip);
  if (ipInt === null) return null;
  for (const loc of locations) {
    if (loc.startIpInt === null || loc.endIpInt === null) continue;
    if (ipInt >= loc.startIpInt && ipInt <= loc.endIpInt) return loc.id;
  }
  return null;
}

export async function loadLocationsForMatching(): Promise<LocationDefinitionRow[]> {
  // Order by start then name so matching is deterministic if there are overlaps (though overlaps are rejected in CRUD).
  const locations = await prisma.locationDefinition.findMany({
    orderBy: [{ startIpInt: 'asc' }, { endIpInt: 'asc' }, { name: 'asc' }],
    where: {
      startIpInt: { not: null },
      endIpInt: { not: null },
    },
    select: {
      id: true,
      name: true,
      startIp: true,
      endIp: true,
      startIpInt: true,
      endIpInt: true,
    },
  });
  return locations as any;
}

export async function recomputeAllMachineLocations(): Promise<{ updated: number; total: number }> {
  const [machines, locations] = await Promise.all([
    prisma.machine.findMany({ select: { id: true, ipAddress: true, locationId: true } }),
    loadLocationsForMatching(),
  ]);

  let updated = 0;
  for (const m of machines) {
    const desired = findMatchingLocationId(m.ipAddress, locations);
    const current = m.locationId ?? null;
    if (desired !== current) {
      await prisma.machine.update({
        where: { id: m.id },
        data: { locationId: desired },
      });
      updated += 1;
    }
  }

  return { updated, total: machines.length };
}

export async function recomputeMachineLocation(machineId: string): Promise<void> {
  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { id: true, ipAddress: true, locationId: true } });
  if (!machine) return;
  const locations = await loadLocationsForMatching();
  const desired = findMatchingLocationId(machine.ipAddress, locations);
  const current = machine.locationId ?? null;
  if (desired !== current) {
    await prisma.machine.update({
      where: { id: machine.id },
      data: { locationId: desired },
    });
  }
}


