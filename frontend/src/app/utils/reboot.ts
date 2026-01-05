export type RebootThresholds = {
  warnDays: number;
  criticalDays: number;
};

export const REBOOT_THRESHOLDS_STORAGE_KEY = 'ui.rebootThresholds';

export const DEFAULT_REBOOT_THRESHOLDS: RebootThresholds = {
  // Reasonable defaults; user can change in Dashboard settings.
  warnDays: 14,
  criticalDays: 30,
};

export function normalizeRebootThresholds(input: Partial<RebootThresholds> | null | undefined): RebootThresholds {
  const warnRaw = Number((input as any)?.warnDays);
  const criticalRaw = Number((input as any)?.criticalDays);

  const warnDays = Number.isFinite(warnRaw) ? Math.max(0, warnRaw) : DEFAULT_REBOOT_THRESHOLDS.warnDays;
  const criticalDays = Number.isFinite(criticalRaw) ? Math.max(0, criticalRaw) : DEFAULT_REBOOT_THRESHOLDS.criticalDays;

  // Ensure ordering: warn <= critical
  if (warnDays > criticalDays) return { warnDays: criticalDays, criticalDays: warnDays };
  return { warnDays, criticalDays };
}

export function loadRebootThresholds(): RebootThresholds {
  try {
    const raw = localStorage.getItem(REBOOT_THRESHOLDS_STORAGE_KEY);
    if (!raw) return DEFAULT_REBOOT_THRESHOLDS;
    const parsed = JSON.parse(raw);
    return normalizeRebootThresholds(parsed);
  } catch {
    return DEFAULT_REBOOT_THRESHOLDS;
  }
}

export function saveRebootThresholds(t: RebootThresholds) {
  try {
    localStorage.setItem(REBOOT_THRESHOLDS_STORAGE_KEY, JSON.stringify(normalizeRebootThresholds(t)));
  } catch {
    // ignore
  }
}

export function parseUptimeInfo(resultData: any): { uptimeDays: number | null; lastBootTime: string | null } {
  if (!resultData || typeof resultData !== 'object' || Array.isArray(resultData)) {
    return { uptimeDays: null, lastBootTime: null };
  }

  const uptimeRaw = (resultData as any).UptimeDays ?? (resultData as any).uptimeDays;
  const lastBootRaw = (resultData as any).LastBootTime ?? (resultData as any).lastBootTime ?? (resultData as any).lastBoot;

  const uptimeDays = Number.isFinite(Number(uptimeRaw)) ? Number(uptimeRaw) : null;
  const lastBootTime = typeof lastBootRaw === 'string' && lastBootRaw.trim() ? lastBootRaw.trim() : null;

  return { uptimeDays, lastBootTime };
}

export type UptimeSeverity = 'ok' | 'warning' | 'critical';

export function getUptimeSeverity(uptimeDays: number | null, t: RebootThresholds): UptimeSeverity | null {
  // Allow disabling highlighting (both set to 0).
  if ((t?.warnDays ?? 0) <= 0 && (t?.criticalDays ?? 0) <= 0) return null;
  if (!Number.isFinite(uptimeDays as number) || uptimeDays === null) return null;
  if (uptimeDays >= t.criticalDays) return 'critical';
  if (uptimeDays >= t.warnDays) return 'warning';
  return 'ok';
}

export function formatLastBootTimeForDisplay(lastBootTime: string | null): string | null {
  if (!lastBootTime) return null;
  const d = new Date(lastBootTime);
  if (Number.isNaN(d.getTime())) return lastBootTime;
  return d.toLocaleString();
}


