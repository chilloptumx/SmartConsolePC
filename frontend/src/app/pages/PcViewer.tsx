import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { api } from '../services/api';
import { loadRebootThresholds, parseUptimeInfo, getUptimeSeverity } from '../utils/reboot';

type CheckResult = {
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

type CollectedObject = {
  checkType: string;
  checkName: string;
  total?: number;
  firstSeen?: string;
  lastSeen?: string;
};

function formatBytesSI(bytes: number, decimals = 1) {
  if (!Number.isFinite(bytes)) return '';
  const sign = bytes < 0 ? '-' : '';
  let n = Math.abs(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n = n / 1000;
    i += 1;
  }
  const d = i === 0 ? 0 : decimals;
  return `${sign}${n.toFixed(d)} ${units[i]}`;
}

function formatDateInput(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function parseDateInput(v: string) {
  // v is expected YYYY-MM-DD from <input type="date" />
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function summarizeNetworkAdapters(data: any) {
  const adaptersRaw = (data as any).Adapters ?? (data as any).adapters ?? (data as any).NetworkAdapters ?? (data as any).networkAdapters;
  const adapters = Array.isArray(adaptersRaw) ? adaptersRaw : null;
  if (!adapters) return null;
  if (adapters.length === 0) return 'no adapters';

  const pickIp = (ip: any) => {
    if (!ip) return null;
    const s = String(ip);
    const parts = s
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;
    const v4 = parts.find((p) => /^\d{1,3}(\.\d{1,3}){3}$/.test(p));
    return v4 ?? parts[0];
  };

  const items = adapters
    .map((a: any) => {
      const desc = String(a?.Description ?? a?.description ?? a?.Name ?? a?.name ?? '').trim();
      const ip = pickIp(a?.IPAddress ?? a?.ipAddress ?? a?.IP ?? a?.ip);
      if (!desc && !ip) return null;
      const label = desc || 'adapter';
      return ip ? `${label}: ${ip}` : label;
    })
    .filter(Boolean) as string[];

  if (items.length === 0) return `${adapters.length} adapters`;
  const shown = items.slice(0, 2);
  const more = items.length - shown.length;
  return more > 0 ? `${shown.join(' · ')} · +${more}` : shown.join(' · ');
}

function summarizeResult(r?: CheckResult) {
  if (!r) return '';
  if (r.message) return r.message;

  const data = r.resultData;
  if (data && typeof data === 'object') {
    const exists = data.exists ?? data.Exists;
    const value = data.value;
    const valueKind = data.valueKind ?? data.value_kind;
    const valueType = data.valueType ?? data.value_type;
    const isDirectory = data.isDirectory;
    const sizeBytes = data.sizeBytes;
    const createdTime = (data as any).createdTime ?? (data as any).creationTime ?? (data as any).created ?? (data as any).CreationTime;
    const modifiedTime = (data as any).modifiedTime ?? (data as any).lastWriteTime ?? (data as any).modified ?? (data as any).LastWriteTime;
    const reachable = (data as any).reachable ?? (data as any).Reachable;

    const shortDate = (iso: any) => {
      if (!iso) return '';
      const d = new Date(String(iso));
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString();
    };

    if (r.checkType === 'REGISTRY_CHECK') {
      if (exists === true && data.valueName) {
        const typeLabel = valueKind || (valueType ? String(valueType).split('.').pop() : undefined);
        return typeLabel ? `${String(value)} (${typeLabel})` : String(value);
      }
      if (exists === true) return 'found';
      if (exists === false) return 'missing';
    }

    if (r.checkType === 'FILE_CHECK') {
      if (exists === true) {
        const parts: string[] = [];
        if (typeof sizeBytes === 'number') parts.push(formatBytesSI(sizeBytes));
        else if (isDirectory === true) parts.push('dir');
        else parts.push('found');

        if (modifiedTime) parts.push(`mod ${shortDate(modifiedTime)}`);
        else if (createdTime) parts.push(`created ${shortDate(createdTime)}`);

        return parts.join(' · ');
      }
      if (exists === false) return 'missing';
    }

    if (r.checkType === 'SERVICE_CHECK') {
      const svcState = (data as any).state ?? (data as any).status ?? (data as any).State;
      const svcName = (data as any).name ?? (data as any).Name;
      const matchedBy = (data as any).matchedBy ?? (data as any).MatchedBy;
      if (exists === false) return 'missing';
      const parts: string[] = [];
      if (svcName) parts.push(String(svcName));
      if (svcState) parts.push(String(svcState));
      if (matchedBy) parts.push(`by=${String(matchedBy)}`);
      return parts.length ? parts.join(' · ') : 'service';
    }

    if (r.checkType === 'PING') {
      // Per user request: keep PING summary simple: success/failed (+ time).
      const ok =
        r.status === 'SUCCESS' ||
        reachable === true ||
        (data as any).success === true;

      const ms =
        (typeof (r as any).duration === 'number' && Number.isFinite((r as any).duration) && (r as any).duration >= 0)
          ? (r as any).duration
          : (typeof (data as any).responseTime === 'number' && Number.isFinite((data as any).responseTime))
            ? (data as any).responseTime
            : (typeof (data as any).avgResponseTime === 'number' && Number.isFinite((data as any).avgResponseTime))
              ? (data as any).avgResponseTime
              : null;

      return ms !== null ? `${ok ? 'success' : 'failed'} (${ms}ms)` : (ok ? 'success' : 'failed');
    }

    if (r.checkType === 'USER_INFO') {
      const parseMaybe = (v: any) => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'object') return v;
        if (typeof v !== 'string') return v;
        const s = v.trim();
        if (!s) return null;
        try {
          return JSON.parse(s);
        } catch {
          return v;
        }
      };

      const currentRaw = (data as any).currentUser ?? (data as any).current_user;
      const lastRaw = (data as any).lastUser ?? (data as any).last_user;
      const current = parseMaybe(currentRaw);
      const last = parseMaybe(lastRaw);

      let curUser: string | null = null;
      if (Array.isArray(current)) {
        const active = current.find((r: any) => String(r?.State ?? r?.state ?? '').toLowerCase() === 'active');
        const row = active ?? current[0];
        const u = row?.Username ?? row?.username;
        if (u) curUser = String(u);
      } else if (current && typeof current === 'object') {
        if (!(current as any).NoUserLoggedIn) {
          const u = (current as any).Username ?? (current as any).username;
          if (u) curUser = String(u);
        }
      } else if (typeof current === 'string') {
        const s = current.trim();
        if (s && s.toLowerCase() !== 'unknown') curUser = s;
      }

      let lastUser: string | null = null;
      if (last && typeof last === 'object' && !Array.isArray(last)) {
        const u = (last as any).LastUser ?? (last as any).lastUser ?? (last as any).last_user;
        if (u && String(u).toLowerCase() !== 'unknown') lastUser = String(u);
      } else if (typeof last === 'string') {
        const s = last.trim();
        if (s && s.toLowerCase() !== 'unknown') lastUser = s;
      }

      const parts: string[] = [];
      if (curUser) parts.push(`current=${curUser}`);
      if (lastUser) parts.push(`last=${lastUser}`);
      return parts.length ? parts.join(' · ') : 'no user';
    }

    if (r.checkType === 'SYSTEM_INFO') {
      // Local Administrators Members (stored as SYSTEM_INFO)
      const adminsGroup = (data as any).Group ?? (data as any).group;
      const adminsMembersRaw = (data as any).Members ?? (data as any).members;
      const adminsMembers = Array.isArray(adminsMembersRaw) ? adminsMembersRaw : null;
      if (adminsMembers) {
        const names = adminsMembers
          .map((m: any) => String(m?.Name ?? m?.name ?? '').trim())
          .filter(Boolean);
        const shown = names.slice(0, 3);
        const more = names.length - shown.length;
        const label = shown.join(', ');
        const head = `${names.length} members`;
        const groupLabel = adminsGroup ? ` (${adminsGroup})` : '';
        return `${head}${groupLabel}${label ? `: ${label}${more > 0 ? ` +${more}` : ''}` : ''}`;
      }

      // CPU Information (stored as SYSTEM_INFO)
      const cpuMaxMHz = Number((data as any).MaxClockSpeed ?? (data as any).maxClockSpeed);
      const cpuCurMHz = Number((data as any).CurrentClockSpeed ?? (data as any).currentClockSpeed);
      const cpuLoad = Number((data as any).LoadPercentage ?? (data as any).loadPercentage);
      const cpuCores = (data as any).NumberOfCores ?? (data as any).numberOfCores;
      const cpuLogical = (data as any).NumberOfLogicalProcessors ?? (data as any).numberOfLogicalProcessors;
      if (Number.isFinite(cpuMaxMHz) || Number.isFinite(cpuCurMHz) || Number.isFinite(cpuLoad) || cpuCores !== undefined) {
        const mhzToGhz = (mhz: number) => `${Number((mhz / 1000).toFixed(2))}GHz`;
        const parts: string[] = [];
        if (Number.isFinite(cpuCurMHz)) parts.push(`cur ${mhzToGhz(cpuCurMHz)}`);
        if (Number.isFinite(cpuMaxMHz)) parts.push(`max ${mhzToGhz(cpuMaxMHz)}`);
        if (Number.isFinite(cpuLoad)) parts.push(`load ${Math.round(cpuLoad)}%`);
        if (cpuCores !== undefined || cpuLogical !== undefined) parts.push(`${cpuCores ?? '?'}c/${cpuLogical ?? '?'}t`);
        return parts.length ? parts.join(' · ') : 'cpu';
      }

      // Disk Space Check (C: Drive) (stored as SYSTEM_INFO)
      const drive = (data as any).Drive ?? (data as any).drive;
      const freeGB = Number((data as any).FreeSpaceGB ?? (data as any).freeSpaceGB);
      const totalGB = Number((data as any).TotalSpaceGB ?? (data as any).totalSpaceGB);
      const percentFree = Number((data as any).PercentFree ?? (data as any).percentFree);
      if (drive || Number.isFinite(freeGB) || Number.isFinite(totalGB) || Number.isFinite(percentFree)) {
        const d = drive ? String(drive) : 'disk';
        const free = Number.isFinite(freeGB) ? `${Number(freeGB.toFixed(2))}GB free` : '';
        const pct = Number.isFinite(percentFree) ? `(${Number(percentFree.toFixed(1))}%)` : '';
        const total = Number.isFinite(totalGB) ? `of ${Number(totalGB.toFixed(2))}GB` : '';
        const prefix = d.endsWith(':') ? d : `${d}:`;
        return [prefix, free, pct, total].filter(Boolean).join(' ');
      }

      const net = summarizeNetworkAdapters(data);
      if (net) return net;

      const computerName = data.ComputerName ?? data.computerName;
      const manufacturer = data.Manufacturer ?? data.manufacturer;
      const model = data.Model ?? data.model;
      const totalMemoryGB = data.TotalMemoryGB ?? data.totalMemoryGB;
      const osVersion = data.OSVersion ?? data.osVersion;
      const uptimeDays = data.UptimeDays ?? data.uptimeDays;
      const lastBootTime = data.LastBootTime ?? data.lastBootTime;
      
      const parts: string[] = [];
      if (computerName) parts.push(computerName);
      if (manufacturer || model) {
        const hw = [manufacturer, model].filter(Boolean).join(' ');
        if (hw) parts.push(hw);
      }
      if (totalMemoryGB !== undefined) parts.push(`${totalMemoryGB}GB`);
      if (osVersion) parts.push(osVersion);
      if (uptimeDays !== undefined) parts.push(`${uptimeDays}d uptime`);
      if (lastBootTime) parts.push(`boot ${shortDate(lastBootTime)}`);
      
      return parts.length > 0 ? parts.join(' · ') : 'system';
    }

    // Generic fallback: compact object
    const keys = Object.keys(data);
    return keys.length ? `${keys.length} fields` : '';
  }

  return typeof data === 'string' ? data : '';
}

export function PcViewer({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchParams] = useSearchParams();
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(formatDateInput(startOfMonth(new Date())));
  const [dateTo, setDateTo] = useState<string>(formatDateInput(endOfMonth(new Date())));
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [selectedCell, setSelectedCell] = useState<CheckResult | null>(null);

  const [objects, setObjects] = useState<CollectedObject[]>([]);
  const [objectsLoading, setObjectsLoading] = useState<boolean>(false);
  const [searchRegistry, setSearchRegistry] = useState<string>('');
  const [searchFile, setSearchFile] = useState<string>('');
  const [searchService, setSearchService] = useState<string>('');
  const [searchUser, setSearchUser] = useState<string>('');
  const [searchSystem, setSearchSystem] = useState<string>('');
  const [selectedObjectKeys, setSelectedObjectKeys] = useState<Record<string, boolean>>({});
  const rebootThresholds = useMemo(() => loadRebootThresholds(), []);

  const makeRowKey = (checkType: string, checkName: string) => `${checkType}::${checkName}`;

  const rangeStart = useMemo(() => parseDateInput(dateFrom), [dateFrom]);
  const rangeEnd = useMemo(() => parseDateInput(dateTo), [dateTo]);

  const days = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    const start = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    if (start.getTime() > end.getTime()) return [];
    // Hard cap to keep the grid and PDF export usable.
    const span = differenceInCalendarDays(end, start) + 1;
    if (span > 92) return [];
    return eachDayOfInterval({ start, end });
  }, [rangeStart, rangeEnd]);

  // Allow linking to a specific machine from the Dashboard, e.g. /data-viewer?tab=pc-history&machineId=...
  useEffect(() => {
    const machineIdFromUrl = searchParams.get('machineId');
    if (machineIdFromUrl && machineIdFromUrl !== selectedMachineId) {
      setSelectedMachineId(machineIdFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getMachines();
        setMachines(data);
        // Prefer URL-selected machineId (deep link from Dashboard).
        // IMPORTANT: use a functional update so we don't overwrite a machineId that was
        // set by the URL effect (avoids stale-closure bugs that pick the first machine).
        const urlMachineId = searchParams.get('machineId');
        setSelectedMachineId((prev) => {
          if (prev) return prev;
          if (urlMachineId && data.some((m) => m?.id === urlMachineId)) return urlMachineId;
          return data.length > 0 ? data[0].id : '';
        });
      } catch (e) {
        toast.error('Failed to load machines');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadObjects = async () => {
    if (!selectedMachineId) return;
    setObjectsLoading(true);
    try {
      const list = await api.getCollectedObjects(selectedMachineId);
      setObjects(list);

      // Default: select only objects that have ever produced results for this machine.
      // (Configured-but-never-run objects may be included by the API; keep the default grid usable.)
      const next: Record<string, boolean> = {};
      for (const o of list) {
        const total = Number((o as any)?.total ?? 0);
        const hasData = Number.isFinite(total) ? total > 0 : Boolean((o as any)?.lastSeen);
        next[makeRowKey(o.checkType, o.checkName)] = hasData;
      }
      setSelectedObjectKeys(next);
    } catch (e) {
      toast.error('Failed to load collected objects for this machine');
      setObjects([]);
      setSelectedObjectKeys({});
    } finally {
      setObjectsLoading(false);
    }
  };

  const loadRange = async () => {
    if (!selectedMachineId) return;
    if (!rangeStart || !rangeEnd) {
      toast.error('Please select a valid date range');
      return;
    }
    const start = startOfDay(rangeStart);
    const end = endOfDay(rangeEnd);
    if (start.getTime() > end.getTime()) {
      toast.error('Start date must be before end date');
      return;
    }
    const span = differenceInCalendarDays(startOfDay(rangeEnd), startOfDay(rangeStart)) + 1;
    if (span > 92) {
      toast.error('Date range is too large. Please select 92 days or fewer.');
      return;
    }
    setLoading(true);
    try {
      const resp = await api.getResults({
        machineId: selectedMachineId,
        dateFrom: start.toISOString(),
        dateTo: end.toISOString(),
        limit: 10000,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      const list = Array.isArray(resp) ? resp : resp.results || [];
      setResults(list);
    } catch (e) {
      toast.error('Failed to load historical results');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachineId]);

  useEffect(() => {
    loadRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachineId, dateFrom, dateTo]);

  const getSelectedMachine = () => machines.find((m) => m.id === selectedMachineId);
  const getMachineLocationName = (m: any) => (m?.location?.name ? String(m.location.name) : 'Undefined');

  // PcViewer object selection UI: match AdHocScan/Dashboard option selector style
  const filterObjects = (list: CollectedObject[], q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((o) => {
      const name = String(o?.checkName ?? '').toLowerCase();
      const type = String(o?.checkType ?? '').toLowerCase();
      return name.includes(needle) || type.includes(needle);
    });
  };

  const toggleAllObjects = (list: CollectedObject[], on: boolean) => {
    setSelectedObjectKeys((prev) => {
      const next = { ...prev };
      for (const o of list) next[makeRowKey(o.checkType, o.checkName)] = on;
      return next;
    });
  };

  const registryObjects = useMemo(() => objects.filter((o) => o.checkType === 'REGISTRY_CHECK'), [objects]);
  const fileObjects = useMemo(() => objects.filter((o) => o.checkType === 'FILE_CHECK'), [objects]);
  const serviceObjects = useMemo(() => objects.filter((o) => o.checkType === 'SERVICE_CHECK'), [objects]);
  const userObjects = useMemo(() => objects.filter((o) => o.checkType === 'USER_INFO'), [objects]);
  // Per user request: group Ping under "System checks"
  const systemObjects = useMemo(
    () => objects.filter((o) => o.checkType === 'SYSTEM_INFO' || o.checkType === 'PING'),
    [objects]
  );

  const filteredRegistryObjects = useMemo(() => filterObjects(registryObjects, searchRegistry), [registryObjects, searchRegistry]);
  const filteredFileObjects = useMemo(() => filterObjects(fileObjects, searchFile), [fileObjects, searchFile]);
  const filteredServiceObjects = useMemo(() => filterObjects(serviceObjects, searchService), [serviceObjects, searchService]);
  const filteredUserObjects = useMemo(() => filterObjects(userObjects, searchUser), [userObjects, searchUser]);
  const filteredSystemObjects = useMemo(() => filterObjects(systemObjects, searchSystem), [systemObjects, searchSystem]);

  const selectedCount = useMemo(() => Object.values(selectedObjectKeys).filter(Boolean).length, [selectedObjectKeys]);
  const totalCount = objects.length;

  const exportDisplayedCsv = () => {
    try {
      const machine = getSelectedMachine();
      const loc = getMachineLocationName(machine);
      const rows: any[] = [];

      for (const row of pivot) {
        for (const d of days) {
          const dayKey = format(d, 'yyyy-MM-dd');
          const r = row.byDay.get(dayKey);
          if (!r) continue;
          rows.push({
            machineId: selectedMachineId,
            machine: machine?.hostname ? `${machine.hostname} (${loc})` : '',
            location: loc,
            objectName: row.checkName,
            checkType: row.checkType,
            day: dayKey,
            createdAt: r.createdAt,
            status: r.status,
            message: r.message ?? '',
            durationMs: r.duration ?? '',
            summary: summarizeResult(r),
            resultData: JSON.stringify(r.resultData ?? {}),
          });
        }
      }

      const headers = Object.keys(rows[0] ?? {
        machineId: '',
        machine: '',
        objectName: '',
        checkType: '',
        day: '',
        createdAt: '',
        status: '',
        message: '',
        durationMs: '',
        summary: '',
        resultData: '',
      });

      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pc-history-${machine?.hostname || selectedMachineId}-${loc}-${dateFrom}_to_${dateTo}.csv`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('CSV exported');
    } catch (e) {
      toast.error('Failed to export CSV');
    }
  };

  const buildDisplayedRows = () => {
    const machine = getSelectedMachine();
    const loc = getMachineLocationName(machine);
    const out: Array<{
      machineId: string;
      machine: string;
      location: string;
      objectName: string;
      checkType: string;
      day: string;
      createdAt: string;
      status: string;
      message: string;
      durationMs: number | '';
      summary: string;
      resultData: any;
    }> = [];

    for (const row of pivot) {
      for (const d of days) {
        const dayKey = format(d, 'yyyy-MM-dd');
        const r = row.byDay.get(dayKey);
        if (!r) continue;
        out.push({
          machineId: selectedMachineId,
          machine: machine?.hostname ? `${machine.hostname} (${loc})` : '',
          location: loc,
          objectName: row.checkName,
          checkType: row.checkType,
          day: dayKey,
          createdAt: r.createdAt,
          status: r.status,
          message: (r.message ?? '').toString(),
          durationMs: (r.duration ?? '') as any,
          summary: summarizeResult(r),
          resultData: r.resultData ?? {},
        });
      }
    }

    return { machine, rows: out };
  };

  const downloadTextFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const exportMarkdown = () => {
    try {
      const { machine, rows } = buildDisplayedRows();
      if (!machine) {
        toast.error('Select a machine first');
        return;
      }
      const loc = getMachineLocationName(machine);
      if (days.length === 0) {
        toast.error('Select a valid date range first');
        return;
      }

      const lines: string[] = [];
      lines.push(`# PC Viewer: ${machine.hostname} (${loc})`);
      lines.push('');
      lines.push(`- **Machine**: ${machine.hostname} (${loc})`);
      lines.push(`- **Location**: ${loc}`);
      lines.push(`- **Machine ID**: ${selectedMachineId}`);
      lines.push(`- **Date range**: ${dateFrom} to ${dateTo}`);
      lines.push(`- **Generated**: ${new Date().toLocaleString()}`);
      lines.push(`- **Objects selected**: ${selectedCount}/${objects.length}`);
      lines.push('');

      lines.push('## Results (one row per object per day)');
      lines.push('');
      lines.push('| Day | Object | Type | Status | Summary | Message | Created At | Duration (ms) |');
      lines.push('|---|---|---|---|---|---|---|---|');
      for (const r of rows) {
        const msg = (r.message || '').replace(/\r?\n/g, ' ').trim();
        const summary = (r.summary || '').replace(/\r?\n/g, ' ').trim();
        lines.push(
          `| ${r.day} | ${r.objectName} | ${r.checkType} | ${r.status} | ${summary} | ${msg} | ${r.createdAt} | ${r.durationMs} |`
        );
      }
      lines.push('');

      lines.push('## Raw ResultData (JSON)');
      lines.push('');
      for (const r of rows) {
        lines.push(`### ${r.day} · ${r.objectName} (${r.checkType}) · ${r.status}`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(r.resultData ?? {}, null, 2));
        lines.push('```');
        lines.push('');
      }

      const filename = `pc-history-${machine.hostname}-${loc}-${dateFrom}_to_${dateTo}.md`;
      downloadTextFile(filename, lines.join('\n'), 'text/markdown;charset=utf-8');
      toast.success('MD exported');
    } catch (e) {
      toast.error('Failed to export MD');
    }
  };

  const exportHtml = () => {
    try {
      const { machine, rows } = buildDisplayedRows();
      if (!machine) {
        toast.error('Select a machine first');
        return;
      }
      const loc = getMachineLocationName(machine);
      if (days.length === 0) {
        toast.error('Select a valid date range first');
        return;
      }

      const title = `PC Viewer: ${machine.hostname} (${loc})`;
      const head = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #0f172a; }
    h1 { margin: 0 0 8px; }
    .meta { color: #334155; margin-bottom: 16px; }
    .meta dt { font-weight: 600; }
    .meta dd { margin: 0 0 6px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; font-size: 12px; }
    th { background: #0f172a; color: #fff; position: sticky; top: 0; }
    .wrap { overflow-x: auto; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 11px; }
    .ok { background: #dcfce7; color: #166534; }
    .warn { background: #fef9c3; color: #854d0e; }
    .fail { background: #fee2e2; color: #991b1b; }
    details pre { white-space: pre-wrap; word-break: break-word; background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <dl class="meta">
    <dt>Machine</dt><dd>${escapeHtml(machine.hostname)} (${escapeHtml(loc)})</dd>
    <dt>Location</dt><dd>${escapeHtml(loc)}</dd>
    <dt>Machine ID</dt><dd>${escapeHtml(selectedMachineId)}</dd>
    <dt>Date range</dt><dd>${escapeHtml(`${dateFrom} to ${dateTo}`)}</dd>
    <dt>Generated</dt><dd>${escapeHtml(new Date().toLocaleString())}</dd>
    <dt>Objects selected</dt><dd>${escapeHtml(`${selectedCount}/${objects.length}`)}</dd>
  </dl>
  <h2>Results</h2>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th>Day</th>
          <th>Object</th>
          <th>Type</th>
          <th>Status</th>
          <th>Summary</th>
          <th>Message</th>
          <th>Created At</th>
          <th>Duration (ms)</th>
          <th>Raw JSON</th>
        </tr>
      </thead>
      <tbody>
`;

      const rowsHtml = rows
        .map((r) => {
          const statusClass = r.status === 'FAILED' ? 'fail' : r.status === 'WARNING' ? 'warn' : 'ok';
          return `
        <tr>
          <td>${escapeHtml(r.day)}</td>
          <td>${escapeHtml(r.objectName)}</td>
          <td>${escapeHtml(r.checkType)}</td>
          <td><span class="badge ${statusClass}">${escapeHtml(r.status)}</span></td>
          <td>${escapeHtml(r.summary || '')}</td>
          <td>${escapeHtml(r.message || '')}</td>
          <td>${escapeHtml(r.createdAt)}</td>
          <td>${escapeHtml(String(r.durationMs ?? ''))}</td>
          <td>
            <details>
              <summary>View</summary>
              <pre>${escapeHtml(JSON.stringify(r.resultData ?? {}, null, 2))}</pre>
            </details>
          </td>
        </tr>`;
        })
        .join('\n');

      const tail = `
      </tbody>
    </table>
  </div>
</body>
</html>
`;

      const html = head + rowsHtml + tail;
      const filename = `pc-history-${machine.hostname}-${loc}-${dateFrom}_to_${dateTo}.html`;
      downloadTextFile(filename, html, 'text/html;charset=utf-8');
      toast.success('HTML exported');
    } catch (e) {
      toast.error('Failed to export HTML');
    }
  };

  const pivot = useMemo(() => {
    const byRow = new Map<string, { checkType: string; checkName: string; byDay: Map<string, CheckResult> }>();

    for (const r of results) {
      const rowKey = makeRowKey(r.checkType, r.checkName);
      const created = new Date(r.createdAt);
      const dayKey = format(created, 'yyyy-MM-dd'); // local calendar date

      let row = byRow.get(rowKey);
      if (!row) {
        row = { checkType: r.checkType, checkName: r.checkName, byDay: new Map() };
        byRow.set(rowKey, row);
      }

      const existing = row.byDay.get(dayKey);
      if (!existing || new Date(existing.createdAt).getTime() < created.getTime()) {
        row.byDay.set(dayKey, r);
      }
    }

    const selectedKeys = new Set(Object.entries(selectedObjectKeys).filter(([, v]) => v).map(([k]) => k));

    // Prefer rendering all collected objects (even if no data in the selected month), filtered by checkboxes.
    // Fallback to "just what exists in this month" if object list hasn't loaded yet.
    const baseObjects = objects.length > 0 ? objects : Array.from(byRow.values()).map((r) => ({ checkType: r.checkType, checkName: r.checkName }));

    const rows = baseObjects
      .filter((o) => selectedKeys.size === 0 ? false : selectedKeys.has(makeRowKey(o.checkType, o.checkName)))
      .map((o) => {
        const key = makeRowKey(o.checkType, o.checkName);
        const row = byRow.get(key);
        return row || { checkType: o.checkType, checkName: o.checkName, byDay: new Map<string, CheckResult>() };
      })
      .sort((a, b) => {
        const at = `${a.checkType}:${a.checkName}`.toLowerCase();
        const bt = `${b.checkType}:${b.checkName}`.toLowerCase();
        return at.localeCompare(bt);
      });

    return rows;
  }, [results, objects, selectedObjectKeys]);

  const isNotFoundResult = (r?: CheckResult) => {
    if (!r) return false;
    if (r.checkType !== 'REGISTRY_CHECK' && r.checkType !== 'FILE_CHECK' && r.checkType !== 'SERVICE_CHECK') return false;
    let data: any = r.resultData;
    if (typeof data === 'string') {
      const s = data.trim();
      if (s) {
        try {
          data = JSON.parse(s);
        } catch {
          // ignore
        }
      }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const exists = (data as any).exists ?? (data as any).Exists;
    return exists === false;
  };

  const cellClass = (r?: CheckResult) => {
    if (!r) return 'bg-slate-950';
    if (r.checkType === 'SYSTEM_INFO') {
      const { uptimeDays } = parseUptimeInfo(r.resultData);
      const sev = getUptimeSeverity(uptimeDays, rebootThresholds);
      if (sev === 'critical') return 'bg-red-500/10 text-red-200 border-red-500 ring-2 ring-red-500 ring-inset';
      if (sev === 'warning') return 'bg-amber-500/10 text-amber-200 border-amber-500 ring-2 ring-amber-500 ring-inset';
    }
    if (isNotFoundResult(r)) return 'bg-red-500/10 text-red-200 border-red-500 ring-2 ring-red-500 ring-inset';
    if (r.status === 'FAILED') return 'bg-red-500/10 text-red-200 border-red-500/20';
    if (r.status === 'WARNING') return 'bg-amber-500/10 text-amber-200 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20';
  };

  return (
    <div className={embedded ? '' : 'p-8'}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">PC History</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={exportDisplayedCsv}
            disabled={!selectedMachineId || loading}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={exportMarkdown}
            disabled={!selectedMachineId || loading || days.length === 0}
          >
            Export MD
          </Button>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={exportHtml}
            disabled={!selectedMachineId || loading || days.length === 0}
          >
            Export HTML
          </Button>
          <Button onClick={loadRange} className="bg-cyan-600 hover:bg-cyan-700" disabled={!selectedMachineId || loading}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-300 text-sm">Machine</Label>
            <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue placeholder="Select a machine" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.hostname} ({m.location?.name || 'Undefined'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 text-sm">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-950 border-slate-800"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-sm">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-950 border-slate-800"
            />
          </div>
        </div>
      </Card>

      <Card className="bg-slate-900 border-slate-800 p-6 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-slate-200">Filter Objects</h2>
            <p className="text-sm text-slate-400 mt-1">
              Select which collected objects to include in the historical grid.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Selected <span className="text-slate-300">{selectedCount}</span> / <span className="text-slate-300">{totalCount}</span>
            </p>
          </div>
        </div>

        {objectsLoading ? (
          <div className="mt-4 text-sm text-slate-400">Loading objects…</div>
        ) : totalCount === 0 ? (
          <div className="mt-4 text-sm text-slate-400">No collected objects found for this machine yet.</div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Registry */}
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">Registry checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(registryObjects, true)}
                    disabled={registryObjects.length === 0}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(registryObjects, false)}
                    disabled={registryObjects.length === 0}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchRegistry}
                onChange={(e) => setSearchRegistry(e.target.value)}
                placeholder="Search registry checks…"
                className="mt-3 bg-slate-900 border-slate-800"
              />
              <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                {registryObjects.length === 0 ? (
                  <div className="text-sm text-slate-500">No registry objects collected yet.</div>
                ) : (
                  filteredRegistryObjects.map((o) => {
                    const key = makeRowKey(o.checkType, o.checkName);
                    return (
                      <label key={key} className="flex items-start gap-3">
                        <Checkbox
                          checked={!!selectedObjectKeys[key]}
                          onCheckedChange={(checked) => setSelectedObjectKeys((prev) => ({ ...prev, [key]: checked as boolean }))}
                        />
                        <div className="min-w-0">
                          <div className="text-slate-300 text-sm truncate" title={`${o.checkType} · ${o.checkName}`}>
                            {o.checkName}
                          </div>
                          <div className="text-slate-500 text-xs font-mono truncate">{o.checkType}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* File */}
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">File checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(fileObjects, true)}
                    disabled={fileObjects.length === 0}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(fileObjects, false)}
                    disabled={fileObjects.length === 0}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchFile}
                onChange={(e) => setSearchFile(e.target.value)}
                placeholder="Search file checks…"
                className="mt-3 bg-slate-900 border-slate-800"
              />
              <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                {fileObjects.length === 0 ? (
                  <div className="text-sm text-slate-500">No file objects collected yet.</div>
                ) : (
                  filteredFileObjects.map((o) => {
                    const key = makeRowKey(o.checkType, o.checkName);
                    return (
                      <label key={key} className="flex items-start gap-3">
                        <Checkbox
                          checked={!!selectedObjectKeys[key]}
                          onCheckedChange={(checked) => setSelectedObjectKeys((prev) => ({ ...prev, [key]: checked as boolean }))}
                        />
                        <div className="min-w-0">
                          <div className="text-slate-300 text-sm truncate" title={`${o.checkType} · ${o.checkName}`}>
                            {o.checkName}
                          </div>
                          <div className="text-slate-500 text-xs font-mono truncate">{o.checkType}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Service */}
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">Service checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(serviceObjects, true)}
                    disabled={serviceObjects.length === 0}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(serviceObjects, false)}
                    disabled={serviceObjects.length === 0}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchService}
                onChange={(e) => setSearchService(e.target.value)}
                placeholder="Search service checks…"
                className="mt-3 bg-slate-900 border-slate-800"
              />
              <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                {serviceObjects.length === 0 ? (
                  <div className="text-sm text-slate-500">No service objects collected yet.</div>
                ) : (
                  filteredServiceObjects.map((o) => {
                    const key = makeRowKey(o.checkType, o.checkName);
                    return (
                      <label key={key} className="flex items-start gap-3">
                        <Checkbox
                          checked={!!selectedObjectKeys[key]}
                          onCheckedChange={(checked) => setSelectedObjectKeys((prev) => ({ ...prev, [key]: checked as boolean }))}
                        />
                        <div className="min-w-0">
                          <div className="text-slate-300 text-sm truncate" title={`${o.checkType} · ${o.checkName}`}>
                            {o.checkName}
                          </div>
                          <div className="text-slate-500 text-xs font-mono truncate">{o.checkType}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* User */}
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">User checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(userObjects, true)}
                    disabled={userObjects.length === 0}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(userObjects, false)}
                    disabled={userObjects.length === 0}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search user checks…"
                className="mt-3 bg-slate-900 border-slate-800"
              />
              <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                {userObjects.length === 0 ? (
                  <div className="text-sm text-slate-500">No user objects collected yet.</div>
                ) : (
                  filteredUserObjects.map((o) => {
                    const key = makeRowKey(o.checkType, o.checkName);
                    return (
                      <label key={key} className="flex items-start gap-3">
                        <Checkbox
                          checked={!!selectedObjectKeys[key]}
                          onCheckedChange={(checked) => setSelectedObjectKeys((prev) => ({ ...prev, [key]: checked as boolean }))}
                        />
                        <div className="min-w-0">
                          <div className="text-slate-300 text-sm truncate" title={`${o.checkType} · ${o.checkName}`}>
                            {o.checkName}
                          </div>
                          <div className="text-slate-500 text-xs font-mono truncate">{o.checkType}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* System */}
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">System checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(systemObjects, true)}
                    disabled={systemObjects.length === 0}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAllObjects(systemObjects, false)}
                    disabled={systemObjects.length === 0}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchSystem}
                onChange={(e) => setSearchSystem(e.target.value)}
                placeholder="Search system checks…"
                className="mt-3 bg-slate-900 border-slate-800"
              />
              <div className="mt-3 max-h-56 overflow-auto pr-1 space-y-2">
                {systemObjects.length === 0 ? (
                  <div className="text-sm text-slate-500">No system objects collected yet.</div>
                ) : (
                  filteredSystemObjects.map((o) => {
                    const key = makeRowKey(o.checkType, o.checkName);
                    return (
                      <label key={key} className="flex items-start gap-3">
                        <Checkbox
                          checked={!!selectedObjectKeys[key]}
                          onCheckedChange={(checked) => setSelectedObjectKeys((prev) => ({ ...prev, [key]: checked as boolean }))}
                        />
                        <div className="min-w-0">
                          <div className="text-slate-300 text-sm truncate" title={`${o.checkType} · ${o.checkName}`}>
                            {o.checkName}
                          </div>
                          <div className="text-slate-500 text-xs font-mono truncate">{o.checkType}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-slate-900 border-b border-slate-800 p-3 text-left text-sm font-medium text-slate-300 min-w-[320px]">
                  Collected Object
                </th>
                {days.map((d) => (
                  <th
                    key={d.toISOString()}
                    className="bg-slate-900 border-b border-slate-800 p-2 text-center text-xs font-medium text-slate-400 min-w-[52px]"
                    title={format(d, 'yyyy-MM-dd')}
                  >
                    {format(d, 'd')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={days.length + 1} className="p-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : pivot.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 1} className="p-8 text-center text-slate-400">
                    {objects.length > 0 && Object.values(selectedObjectKeys).some(Boolean) === false
                      ? 'No objects selected. Use the filter checkboxes above to choose what to display.'
                      : 'No results found for this machine/month yet. Run a check to populate data.'}
                  </td>
                </tr>
              ) : (
                pivot.map((row) => (
                  <tr key={makeRowKey(row.checkType, row.checkName)} className="border-b border-slate-800">
                    <td className="sticky left-0 z-10 bg-slate-900 border-b border-slate-800 p-3 align-top">
                      <div className="text-sm text-slate-200">{row.checkName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{row.checkType}</div>
                    </td>
                    {days.map((d) => {
                      const dayKey = format(d, 'yyyy-MM-dd');
                      const r = row.byDay.get(dayKey);
                      const text = summarizeResult(r);
                      return (
                        <td
                          key={`${makeRowKey(row.checkType, row.checkName)}::${dayKey}`}
                          className="border-b border-slate-800 p-2"
                        >
                          <button
                            type="button"
                            className={`w-full px-1.5 py-1 text-[11px] leading-tight text-left ${
                              isNotFoundResult(r) ? 'rounded-none border-2' : 'rounded border'
                            } ${cellClass(r)} ${r ? 'hover:brightness-110' : 'border-slate-800 text-slate-600'}`}
                            disabled={!r}
                            title={r ? `${r.status} • ${format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm')}` : ''}
                            onClick={() => r && setSelectedCell(r)}
                          >
                            {text || (r ? r.status : '')}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Result Details</DialogTitle>
          </DialogHeader>
          {selectedCell && (
            <div className="space-y-3">
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Check:</span> {selectedCell.checkName}{' '}
                <span className="text-slate-500">({selectedCell.checkType})</span>
              </div>
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Status:</span> {selectedCell.status}{' '}
                <span className="text-slate-500">•</span>{' '}
                <span className="text-slate-400 font-mono">{new Date(selectedCell.createdAt).toLocaleString()}</span>
              </div>
              {selectedCell.message && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-200">
                  {selectedCell.message}
                </div>
              )}
              <div>
                <Label className="text-slate-400">Result Data (JSON)</Label>
                <pre className="mt-2 p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono overflow-x-auto text-slate-300 max-h-96 overflow-y-auto">
                  {JSON.stringify(selectedCell.resultData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


