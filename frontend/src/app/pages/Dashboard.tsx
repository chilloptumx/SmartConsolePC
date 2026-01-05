import { RefreshCw, Plus, TrendingUp, TrendingDown, Minus, Settings, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { api } from '../services/api';
import {
  loadRebootThresholds,
  saveRebootThresholds,
  normalizeRebootThresholds,
  parseUptimeInfo,
  getUptimeSeverity,
  formatLastBootTimeForDisplay,
  type RebootThresholds,
} from '../utils/reboot';

export function Dashboard() {
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [isCardConfigOpen, setIsCardConfigOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  type StatusFilter = 'all' | 'online' | 'offline' | 'warnings';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  // Track which columns to display in the machine status table
  const [displayColumns, setDisplayColumns] = useState({
    ipAddress: true,
    lastSeen: true,
    pcModel: true,
    uptime: false,
    lastReboot: false,
  });
  const [rebootThresholds, setRebootThresholds] = useState<RebootThresholds>(() => loadRebootThresholds());

  type CollectedObject = { checkType: string; checkName: string; total?: number; firstSeen?: string; lastSeen?: string };
  type LatestResult = {
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

  const makeObjectKey = (checkType: string, checkName: string) => `${checkType}::${checkName}`;
  const systemInfoKey = makeObjectKey('SYSTEM_INFO', 'System Information');
  const [availableObjects, setAvailableObjects] = useState<CollectedObject[]>([]);
  const [selectedObjectKeys, setSelectedObjectKeys] = useState<Record<string, boolean>>({});
  const [latestByMachineAndObject, setLatestByMachineAndObject] = useState<Record<string, LatestResult | undefined>>({});
  const [searchRegistry, setSearchRegistry] = useState('');
  const [searchFile, setSearchFile] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [searchSystem, setSearchSystem] = useState('');

  // Fetch data from API
  useEffect(() => {
    // Load persisted column settings
    try {
      const raw = localStorage.getItem('dashboard.machineTableColumns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.displayColumns && typeof parsed.displayColumns === 'object') {
            setDisplayColumns((prev) => ({ ...prev, ...parsed.displayColumns }));
          }
          if (parsed.selectedObjectKeys && typeof parsed.selectedObjectKeys === 'object') {
            setSelectedObjectKeys(parsed.selectedObjectKeys);
          }
          if (parsed.rebootThresholds && typeof parsed.rebootThresholds === 'object') {
            setRebootThresholds(normalizeRebootThresholds(parsed.rebootThresholds));
          }
        }
      }
    } catch {
      // ignore
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [machinesData] = await Promise.all([
        api.getMachines(),
      ]);
      
      setMachines(machinesData);

      // Load dynamic "collected objects" options for the dashboard column picker.
      // As you add new checks and they collect data, they will show up here automatically.
      try {
        const objs = await api.getCollectedObjectsAll();
        setAvailableObjects(objs);
      } catch {
        // non-fatal
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const summarizeLatest = (r?: LatestResult) => {
    if (!r) return '';
    if (r.message) return r.message;
    const data = r.resultData;
    if (data && typeof data === 'object') {
      const exists = (data as any).exists ?? (data as any).Exists;
      const value = (data as any).value;
      const valueKind = (data as any).valueKind ?? (data as any).value_kind;
      const valueType = (data as any).valueType ?? (data as any).value_type;
      const isDirectory = (data as any).isDirectory;
      const sizeBytes = (data as any).sizeBytes;
      const reachable = (data as any).reachable ?? (data as any).Reachable;

      const createdTime = (data as any).createdTime ?? (data as any).creationTime ?? (data as any).created ?? (data as any).CreationTime;
      const modifiedTime = (data as any).modifiedTime ?? (data as any).lastWriteTime ?? (data as any).modified ?? (data as any).LastWriteTime;
      const shortDate = (iso: any) => {
        if (!iso) return '';
        const d = new Date(String(iso));
        if (Number.isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString();
      };

      const formatBytesSI = (bytes: number, decimals = 1) => {
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
      };

      if (r.checkType === 'REGISTRY_CHECK') {
        if (exists === true && (data as any).valueName) {
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

        // CPU Information (seeded as a custom System Check but stored as SYSTEM_INFO results)
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

        // Disk Space Check (C: Drive) (seeded as a custom System Check but stored as SYSTEM_INFO results)
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

        // Support custom "SYSTEM_INFO" objects like Network Adapter Information (seeded as CUSTOM but stored as SYSTEM_INFO results).
        const adaptersRaw =
          (data as any).Adapters ?? (data as any).adapters ?? (data as any).NetworkAdapters ?? (data as any).networkAdapters;
        if (Array.isArray(adaptersRaw)) {
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

          if (adaptersRaw.length === 0) return 'no adapters';

          const items = adaptersRaw
            .map((a: any) => {
              const desc = String(a?.Description ?? a?.description ?? a?.Name ?? a?.name ?? '').trim();
              const ip = pickIp(a?.IPAddress ?? a?.ipAddress ?? a?.IP ?? a?.ip);
              if (!desc && !ip) return null;
              const label = desc || 'adapter';
              return ip ? `${label}: ${ip}` : label;
            })
            .filter(Boolean) as string[];

          if (items.length === 0) return `${adaptersRaw.length} adapters`;
          const shown = items.slice(0, 2);
          const more = items.length - shown.length;
          return more > 0 ? `${shown.join(' · ')} · +${more}` : shown.join(' · ');
        }

        const computerName = (data as any).ComputerName ?? (data as any).computerName;
        const manufacturer = (data as any).Manufacturer ?? (data as any).manufacturer;
        const model = (data as any).Model ?? (data as any).model;
        const totalMemoryGB = (data as any).TotalMemoryGB ?? (data as any).totalMemoryGB;
        const osVersion = (data as any).OSVersion ?? (data as any).osVersion ?? (data as any).OSCaption ?? (data as any).OS;
        const osArch = (data as any).OSArchitecture ?? (data as any).osArchitecture;
        const uptimeDays = (data as any).UptimeDays ?? (data as any).uptimeDays;
        const lastBootTime = (data as any).LastBootTime ?? (data as any).lastBootTime;

        const parts: string[] = [];
        if (computerName) parts.push(String(computerName));
        if (manufacturer || model) {
          const hw = [manufacturer, model].filter(Boolean).join(' ');
          if (hw) parts.push(hw);
        }
        if (totalMemoryGB !== undefined) parts.push(`${totalMemoryGB}GB RAM`);
        if (osVersion) parts.push(String(osVersion));
        if (osArch) parts.push(String(osArch));
        if (uptimeDays !== undefined) parts.push(`uptime ${uptimeDays}d`);
        if (lastBootTime) parts.push(`boot ${shortDate(lastBootTime)}`);

        return parts.length > 0 ? parts.join(' · ') : 'system info';
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

        if (curUser) return `current=${curUser}`;
        if (lastUser) return `last=${lastUser}`;
        return 'no user';
      }

      const keys = Object.keys(data);
      return keys.length ? `${keys.length} fields` : '';
    }
    return typeof data === 'string' ? data : '';
  };

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
      for (const o of list) next[makeObjectKey(o.checkType, o.checkName)] = on;
      return next;
    });
  };

  const registryObjects = useMemo(() => availableObjects.filter((o) => o.checkType === 'REGISTRY_CHECK'), [availableObjects]);
  const fileObjects = useMemo(() => availableObjects.filter((o) => o.checkType === 'FILE_CHECK'), [availableObjects]);
  const userObjects = useMemo(() => availableObjects.filter((o) => o.checkType === 'USER_INFO'), [availableObjects]);
  // Per user request: group Ping under "System checks" in the options UI.
  const systemObjects = useMemo(
    () => availableObjects.filter((o) => o.checkType === 'SYSTEM_INFO' || o.checkType === 'PING'),
    [availableObjects]
  );

  const filteredRegistryObjects = useMemo(() => filterObjects(registryObjects, searchRegistry), [registryObjects, searchRegistry]);
  const filteredFileObjects = useMemo(() => filterObjects(fileObjects, searchFile), [fileObjects, searchFile]);
  const filteredUserObjects = useMemo(() => filterObjects(userObjects, searchUser), [userObjects, searchUser]);
  const filteredSystemObjects = useMemo(() => filterObjects(systemObjects, searchSystem), [systemObjects, searchSystem]);

  const selectedDynamicCount = useMemo(
    () => Object.values(selectedObjectKeys).filter(Boolean).length,
    [selectedObjectKeys]
  );

  const isNotFoundResult = (r?: LatestResult) => {
    if (!r) return false;
    if (r.checkType !== 'REGISTRY_CHECK' && r.checkType !== 'FILE_CHECK') return false;
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
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const exists = (data as any).exists ?? (data as any).Exists;
      if (exists === false) return true;
    }

    // Fallback: older results (or some error paths) may not include `exists`,
    // but they still set a clear "not found" message.
    const msg = typeof r.message === 'string' ? r.message.trim().toLowerCase() : '';
    if (!msg) return false;

    // Canonical messages produced by the backend scheduler
    if (msg.includes('path/value not found')) return true;
    if (msg.includes('registry path/value not found')) return true;
    if (msg.includes('file/path not found')) return true;

    // Slightly broader (but still constrained to FILE_CHECK/REGISTRY_CHECK)
    if (msg.includes('not found') && (msg.includes('registry') || msg.includes('file') || msg.includes('path') || msg.includes('value'))) {
      return true;
    }

    return false;
  };

  const escapeCsv = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const escapeHtml = (v: any) => {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const downloadTextFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const getMachineTableExportData = () => {
    const objectKeys = Object.entries(selectedObjectKeys).filter(([, v]) => v).map(([k]) => k);
    const headers: string[] = ['Machine', 'Status'];
    if (displayColumns.ipAddress) headers.push('IP Address');
    if (displayColumns.lastSeen) headers.push('Last Seen');
    if (displayColumns.pcModel) headers.push('Model');
    if (displayColumns.uptime) headers.push('Uptime');
    if (displayColumns.lastReboot) headers.push('Last reboot');
    for (const key of objectKeys) {
      const [, checkName] = key.split('::');
      headers.push(checkName || key);
    }

    const rows: string[][] = filteredMachines.map((machine) => {
      const row: string[] = [];
      const loc = (machine as any).location?.name || 'Undefined';
      row.push(machine.hostname ? `${machine.hostname} (${loc})` : '');
      row.push(machine.status || 'UNKNOWN');
      if (displayColumns.ipAddress) row.push(machine.ipAddress || '');
      if (displayColumns.lastSeen) row.push(machine.lastSeen ? new Date(machine.lastSeen).toLocaleString() : '');
      if (displayColumns.pcModel) row.push(machine.pcModel || '');
      if (displayColumns.uptime || displayColumns.lastReboot) {
        const sys = latestByMachineAndObject[`${machine.id}::${systemInfoKey}`];
        const { uptimeDays, lastBootTime } = parseUptimeInfo(sys?.resultData);
        const uptimeLabel = uptimeDays === null ? '' : `${Number(uptimeDays.toFixed(2))}d`;
        const bootLabel = formatLastBootTimeForDisplay(lastBootTime) ?? '';
        if (displayColumns.uptime) row.push(uptimeLabel);
        if (displayColumns.lastReboot) row.push(bootLabel);
      }
      for (const key of objectKeys) {
        const r = latestByMachineAndObject[`${machine.id}::${key}`];
        const summary = summarizeLatest(r);
        row.push(summary || '');
      }
      return row;
    });

    return { headers, rows };
  };

  const exportMachineStatus = (format: 'csv' | 'html' | 'md') => {
    if (filteredMachines.length === 0) {
      toast.error('No machines to export');
      return;
    }

    const { headers, rows } = getMachineTableExportData();
    const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
    const base = `machine-status-${ts}`;

    if (format === 'csv') {
      const csv = [
        headers.map(escapeCsv).join(','),
        ...rows.map((r) => r.map(escapeCsv).join(',')),
      ].join('\r\n') + '\r\n';
      downloadTextFile(`${base}.csv`, csv, 'text/csv;charset=utf-8');
      toast.success('Exported CSV');
      return;
    }

    if (format === 'md') {
      const mdHeader = `| ${headers.map((h) => String(h).replace(/\|/g, '\\|')).join(' | ')} |`;
      const mdSep = `| ${headers.map(() => '---').join(' | ')} |`;
      const mdRows = rows.map((r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
      const md = [
        `<!-- Generated: ${new Date().toISOString()} -->`,
        '',
        mdHeader,
        mdSep,
        ...mdRows,
        '',
      ].join('\n');
      downloadTextFile(`${base}.md`, md, 'text/markdown;charset=utf-8');
      toast.success('Exported Markdown');
      return;
    }

    // html
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Machine Status Export</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 18px; }
      .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #f5f5f5; }
      tr:nth-child(even) td { background: #fafafa; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
    </style>
  </head>
  <body>
    <h1>Machine Status</h1>
    <div class="meta">Generated: ${escapeHtml(new Date().toISOString())}</div>
    <table>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr>${r
                .map((c) => `<td>${escapeHtml(c)}</td>`)
                .join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  </body>
</html>
`;
    downloadTextFile(`${base}.html`, html, 'text/html;charset=utf-8');
    toast.success('Exported HTML');
  };

  const refreshLatestObjectColumns = async (machineList: any[], selectedKeys: Record<string, boolean>) => {
    const selected = Object.entries(selectedKeys)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (machineList.length === 0 || selected.length === 0) {
      setLatestByMachineAndObject({});
      return;
    }

    const objects = selected.map((k) => {
      const [checkType, checkName] = k.split('::');
      return { checkType, checkName };
    });

    try {
      const { results } = await api.getLatestResultsForObjects({
        machineIds: machineList.map((m) => m.id),
        objects,
      });
      const map: Record<string, LatestResult> = {};
      for (const r of results || []) {
        const key = `${r.machineId}::${r.checkType}::${r.checkName}`;
        map[key] = r;
      }
      setLatestByMachineAndObject(map);
    } catch (e) {
      console.error('Failed to load latest results for dashboard columns', e);
      toast.error('Failed to load dashboard columns');
      setLatestByMachineAndObject({});
    }
  };

  const isOnlineMachine = (m: any) => m?.status === 'ONLINE' || m?.status === 'WARNING';
  const isOfflineMachine = (m: any) => m?.status === 'OFFLINE' || m?.status === 'UNKNOWN' || m?.status === 'ERROR';
  const isWarningMachine = (m: any) => m?.status === 'WARNING';

  const filteredMachines = useMemo(() => {
    switch (statusFilter) {
      case 'online':
        return machines.filter(isOnlineMachine);
      case 'offline':
        return machines.filter(isOfflineMachine);
      case 'warnings':
        return machines.filter(isWarningMachine);
      default:
        return machines;
    }
  }, [machines, statusFilter]);

  const setFilter = (next: StatusFilter) => {
    if (next === 'all') {
      setStatusFilter('all');
      return;
    }
    setStatusFilter((prev) => (prev === next ? 'all' : next));
  };

  const cardButtonClass = (active: boolean) =>
    `w-full text-left bg-slate-900 border border-slate-800 p-6 rounded-xl cursor-pointer select-none hover:bg-slate-800/30 active:scale-[0.99] ${
      active ? 'ring-2 ring-cyan-500 ring-inset' : ''
    }`;

  useEffect(() => {
    // Keep dashboard dynamic columns in sync with what is visible in the table.
    // If uptime/last reboot columns are enabled, also fetch the latest "System Information" object
    // (even if not selected as a dynamic column) so we can derive the values.
    const fetchKeys =
      displayColumns.uptime || displayColumns.lastReboot
        ? { ...selectedObjectKeys, [systemInfoKey]: true }
        : selectedObjectKeys;
    refreshLatestObjectColumns(filteredMachines, fetchKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMachines, selectedObjectKeys, displayColumns.uptime, displayColumns.lastReboot]);

  const stats = {
    total: machines.length,
    // Treat WARNING as still online/reachable; treat UNKNOWN + ERROR as needing attention/offline.
    // (There is currently no separate "Errors" summary card.)
    online: machines.filter(isOnlineMachine).length,
    offline: machines.filter(isOfflineMachine).length,
    warnings: machines.filter(isWarningMachine).length,
  };

  const badgeStatus = (status?: string) => {
    switch (status) {
      case 'ONLINE':
        return 'online';
      case 'OFFLINE':
        return 'offline';
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'failed';
      default:
        return 'offline';
    }
  };

  const [machineName, setMachineName] = useState('');
  const [machineIP, setMachineIP] = useState('');
  const [machineModel, setMachineModel] = useState('');

  const handleRunCheck = async () => {
    try {
      // Trigger checks for all machines
      for (const machine of machines) {
        await api.triggerCheck(machine.id, 'FULL_CHECK');
      }
      toast.success('Full check started for all machines');
      setTimeout(loadData, 2000); // Reload after 2 seconds
    } catch (error) {
      toast.error('Failed to start health check');
    }
  };

  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineName || !machineIP) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await api.createMachine({
        hostname: machineName,
        ipAddress: machineIP,
        pcModel: machineModel || undefined
      });
      toast.success(`Machine ${machineName} added successfully`);
      setIsAddMachineOpen(false);
      setMachineName('');
      setMachineIP('');
      setMachineModel('');
      loadData(); // Reload data
    } catch (error: any) {
      toast.error(error.message || 'Failed to add machine');
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleRunCheck} className="bg-cyan-600 hover:bg-cyan-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Run Check Now
          </Button>
          <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
                <Plus className="w-4 h-4 mr-2" />
                Add Machine
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-slate-100">Add Machine</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Add a new Windows 11 Pro machine to monitor.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddMachine}>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-slate-300">Machine Name *</Label>
                    <Input 
                      placeholder="e.g., wopr" 
                      className="bg-slate-950 border-slate-800 mt-1"
                      value={machineName}
                      onChange={(e) => setMachineName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">IP Address *</Label>
                    <Input 
                      placeholder="e.g., 192.168.6.32" 
                      className="bg-slate-950 border-slate-800 mt-1 font-mono"
                      value={machineIP}
                      onChange={(e) => setMachineIP(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">PC Model (optional)</Label>
                    <Input 
                      placeholder="e.g., Dell Optiplex HP 7000" 
                      className="bg-slate-950 border-slate-800 mt-1"
                      value={machineModel}
                      onChange={(e) => setMachineModel(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddMachineOpen(false)} className="border-slate-700">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                    Add Machine
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <button
          type="button"
          aria-pressed={statusFilter === 'all'}
          onClick={() => setFilter('all')}
          className={cardButtonClass(statusFilter === 'all')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Machines</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-semibold text-slate-200">{stats.total}</div>
          <div className="text-xs text-emerald-400 mt-2">+2 this week</div>
        </button>

        <button
          type="button"
          aria-pressed={statusFilter === 'online'}
          onClick={() => setFilter('online')}
          className={cardButtonClass(statusFilter === 'online')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Online</span>
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
          </div>
          <div className="text-3xl font-semibold text-emerald-400">{stats.online}</div>
          <div className="text-xs text-slate-400 mt-2">{Math.round((stats.online / stats.total) * 100)}% uptime</div>
        </button>

        <button
          type="button"
          aria-pressed={statusFilter === 'offline'}
          onClick={() => setFilter('offline')}
          className={cardButtonClass(statusFilter === 'offline')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Offline</span>
            <div className="w-2 h-2 bg-slate-400 rounded-full" />
          </div>
          <div className="text-3xl font-semibold text-slate-400">{stats.offline}</div>
          <div className="text-xs text-slate-500 mt-2">Needs attention</div>
        </button>

        <button
          type="button"
          aria-pressed={statusFilter === 'warnings'}
          onClick={() => setFilter('warnings')}
          className={cardButtonClass(statusFilter === 'warnings')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Warnings</span>
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          </div>
          <div className="text-3xl font-semibold text-amber-400">{stats.warnings}</div>
          <div className="text-xs text-amber-400 mt-2">High resource usage</div>
        </button>
      </div>

      <div className="space-y-4">
        {/* Machine Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Machine Status</h2>
              {statusFilter !== 'all' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded border border-slate-700 bg-slate-950 text-slate-300">
                    Filter: {statusFilter}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900 text-slate-300"
                    onClick={() => setFilter('all')}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Last check: 2 mins ago</span>
              <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-slate-700 bg-slate-950 hover:bg-slate-900">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle className="text-slate-100">Export Machine Status</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Exports the machine status table exactly as currently shown (including any selected collected-data columns).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <div className="text-xs text-slate-500">
                      Rows: <span className="text-slate-300">{filteredMachines.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        className="bg-cyan-600 hover:bg-cyan-700"
                        onClick={() => {
                          exportMachineStatus('csv');
                          setIsExportOpen(false);
                        }}
                      >
                        Export CSV
                      </Button>
                      <Button
                        variant="outline"
                        className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                        onClick={() => {
                          exportMachineStatus('html');
                          setIsExportOpen(false);
                        }}
                      >
                        Export HTML
                      </Button>
                      <Button
                        variant="outline"
                        className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                        onClick={() => {
                          exportMachineStatus('md');
                          setIsExportOpen(false);
                        }}
                      >
                        Export Markdown
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="border-slate-700" onClick={() => setIsExportOpen(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isCardConfigOpen} onOpenChange={setIsCardConfigOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-slate-800 text-slate-400 hover:text-slate-200">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-[980px]">
                  <DialogHeader>
                    <DialogTitle className="text-slate-100">Configure Machine Table Columns</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Choose which data to display in the machine status table. This list is dynamic and updates as new data is collected.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <Card className="bg-slate-900 border-slate-800 p-6 lg:col-span-1">
                        <div className="space-y-4">
                          <div className="rounded border border-slate-800 bg-slate-950 p-4">
                            <div className="text-sm font-medium text-slate-200 mb-3">Built-in columns</div>
                            <div className="space-y-2 text-sm">
                              <label className="flex items-center gap-2 text-slate-300">
                                <Checkbox
                                  checked={displayColumns.ipAddress}
                                  onCheckedChange={(checked) => setDisplayColumns((prev) => ({ ...prev, ipAddress: checked as boolean }))}
                                />
                                IP Address
                              </label>
                              <label className="flex items-center gap-2 text-slate-300">
                                <Checkbox
                                  checked={displayColumns.lastSeen}
                                  onCheckedChange={(checked) => setDisplayColumns((prev) => ({ ...prev, lastSeen: checked as boolean }))}
                                />
                                Last Seen
                              </label>
                              <label className="flex items-center gap-2 text-slate-300">
                                <Checkbox
                                  checked={displayColumns.pcModel}
                                  onCheckedChange={(checked) => setDisplayColumns((prev) => ({ ...prev, pcModel: checked as boolean }))}
                                />
                                Model
                              </label>
                              <label className="flex items-center gap-2 text-slate-300">
                                <Checkbox
                                  checked={displayColumns.uptime}
                                  onCheckedChange={(checked) => setDisplayColumns((prev) => ({ ...prev, uptime: checked as boolean }))}
                                />
                                Uptime (days)
                              </label>
                              <label className="flex items-center gap-2 text-slate-300">
                                <Checkbox
                                  checked={displayColumns.lastReboot}
                                  onCheckedChange={(checked) => setDisplayColumns((prev) => ({ ...prev, lastReboot: checked as boolean }))}
                                />
                                Last reboot
                              </label>
                            </div>
                          </div>

                          <div className="rounded border border-slate-800 bg-slate-950 p-4">
                            <div className="text-sm font-medium text-slate-200 mb-1">Reboot freshness thresholds</div>
                            <div className="text-xs text-slate-500 mb-3">
                              Machines with uptime above these thresholds will be highlighted (yellow/red).
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-slate-300 text-xs">Warning (days)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={rebootThresholds.warnDays}
                                  onChange={(e) =>
                                    setRebootThresholds((prev) =>
                                      normalizeRebootThresholds({ ...prev, warnDays: Number(e.target.value) })
                                    )
                                  }
                                  className="mt-1 bg-slate-900 border-slate-800"
                                />
                              </div>
                              <div>
                                <Label className="text-slate-300 text-xs">Critical (days)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={rebootThresholds.criticalDays}
                                  onChange={(e) =>
                                    setRebootThresholds((prev) =>
                                      normalizeRebootThresholds({ ...prev, criticalDays: Number(e.target.value) })
                                    )
                                  }
                                  className="mt-1 bg-slate-900 border-slate-800"
                                />
                              </div>
                            </div>
                            <div className="mt-3 text-xs text-slate-500">
                              Tip: set Warning=0 and Critical=0 to effectively disable highlighting.
                            </div>
                          </div>

                          <div className="text-xs text-slate-500">
                            Selected dynamic columns:{' '}
                            <span className="text-slate-300 font-mono">
                              {selectedDynamicCount}/{availableObjects.length}
                            </span>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-slate-900 border-slate-800 p-6 lg:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                                  const key = makeObjectKey(o.checkType, o.checkName);
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
                                  const key = makeObjectKey(o.checkType, o.checkName);
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
                                  const key = makeObjectKey(o.checkType, o.checkName);
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
                                  const key = makeObjectKey(o.checkType, o.checkName);
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
                      </Card>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={() => {
                        try {
                          localStorage.setItem(
                            'dashboard.machineTableColumns',
                            JSON.stringify({ displayColumns, selectedObjectKeys, rebootThresholds })
                          );
                        } catch {
                          // ignore
                        }
                        saveRebootThresholds(rebootThresholds);
                        setIsCardConfigOpen(false);
                        toast.success('Display settings saved');
                      }} 
                      className="bg-cyan-600 hover:bg-cyan-700"
                    >
                      Save Settings
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Machine</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                  {displayColumns.ipAddress && (
                    <th className="text-left p-4 text-sm font-medium text-slate-400">IP Address</th>
                  )}
                  {displayColumns.lastSeen && (
                    <th className="text-left p-4 text-sm font-medium text-slate-400">Last Seen</th>
                  )}
                  {displayColumns.pcModel && (
                    <th className="text-left p-4 text-sm font-medium text-slate-400">Model</th>
                  )}
                  {displayColumns.uptime && (
                    <th className="text-left p-4 text-sm font-medium text-slate-400">Uptime</th>
                  )}
                  {displayColumns.lastReboot && (
                    <th className="text-left p-4 text-sm font-medium text-slate-400">Last reboot</th>
                  )}
                  {Object.entries(selectedObjectKeys)
                    .filter(([, v]) => v)
                    .map(([key]) => {
                      const [checkType, checkName] = key.split('::');
                      const title = `${checkType} · ${checkName}`;
                      return (
                        <th key={key} className="text-left p-4 text-sm font-medium text-slate-400" title={title}>
                          <span className="block max-w-[220px] truncate">{checkName || checkType}</span>
                        </th>
                      );
                    })}
                  <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={999} className="p-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : filteredMachines.length === 0 ? (
                  <tr>
                    <td colSpan={999} className="p-8 text-center text-slate-400">
                      {machines.length === 0
                        ? 'No machines added yet. Click "Add Machine" to get started.'
                        : 'No machines match the selected status filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredMachines.map((machine) => (
                    <tr key={machine.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                      <td className="p-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            to={`/pc-viewer?machineId=${encodeURIComponent(machine.id)}`}
                            className="font-mono text-sm text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline truncate"
                            title="View PC viewer"
                          >
                            {machine.hostname}
                          </Link>
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded text-[11px] border ${
                              (machine as any).location?.name
                                ? 'bg-slate-800 text-slate-200 border-slate-700'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}
                            title="Location"
                          >
                            {(machine as any).location?.name || 'Undefined'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={badgeStatus(machine.status)} withDot>
                          {machine.status || 'UNKNOWN'}
                        </StatusBadge>
                      </td>
                      {displayColumns.ipAddress && (
                        <td className="p-4 font-mono text-sm text-slate-400">{machine.ipAddress || '-'}</td>
                      )}
                      {displayColumns.lastSeen && (
                        <td className="p-4 text-sm text-slate-400">
                          {machine.lastSeen ? new Date(machine.lastSeen).toLocaleString() : '-'}
                        </td>
                      )}
                      {displayColumns.pcModel && (
                        <td className="p-4 text-sm text-slate-300">
                          {machine.pcModel || '-'}
                        </td>
                      )}
                      {displayColumns.uptime || displayColumns.lastReboot ? (() => {
                        const sys = latestByMachineAndObject[`${machine.id}::${systemInfoKey}`];
                        const { uptimeDays, lastBootTime } = parseUptimeInfo(sys?.resultData);
                        const sev = getUptimeSeverity(uptimeDays, rebootThresholds);
                        const badge =
                          sev === 'critical'
                            ? 'bg-red-500/10 text-red-200'
                            : sev === 'warning'
                              ? 'bg-amber-500/10 text-amber-200'
                              : '';
                        const ring =
                          sev === 'critical'
                            ? 'inset 0 0 0 2px rgb(239 68 68)'
                            : sev === 'warning'
                              ? 'inset 0 0 0 2px rgb(245 158 11)'
                              : '';

                        const uptimeLabel =
                          uptimeDays === null ? null : `${Number(uptimeDays.toFixed(2))}d`;
                        const bootLabel = formatLastBootTimeForDisplay(lastBootTime);

                        return (
                          <>
                            {displayColumns.uptime ? (
                              <td className="p-4 text-sm text-slate-300">
                                {uptimeLabel ? (
                                  <span
                                    className={`inline-block px-2 py-1 ${badge}`}
                                    style={ring ? { boxShadow: ring } : undefined}
                                    title={bootLabel ? `Last reboot: ${bootLabel}` : 'Last reboot: unknown'}
                                  >
                                    {uptimeLabel}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                            ) : null}
                            {displayColumns.lastReboot ? (
                              <td className="p-4 text-sm text-slate-300">
                                {bootLabel ? (
                                  <span
                                    className={`inline-block max-w-full truncate px-2 py-1 ${badge}`}
                                    style={ring ? { boxShadow: ring } : undefined}
                                    title={uptimeLabel ? `Uptime: ${uptimeLabel}` : 'Uptime: unknown'}
                                  >
                                    {bootLabel}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                            ) : null}
                          </>
                        );
                      })() : null}
                      {Object.entries(selectedObjectKeys)
                        .filter(([, v]) => v)
                        .map(([key]) => {
                          const r = latestByMachineAndObject[`${machine.id}::${key}`];
                          const summary = summarizeLatest(r);
                          const notFound =
                            isNotFoundResult(r) ||
                            ((r?.checkType === 'REGISTRY_CHECK' || r?.checkType === 'FILE_CHECK') &&
                              typeof summary === 'string' &&
                              summary.toLowerCase().includes('not found'));
                          const uptimeInfo =
                            r?.checkType === 'SYSTEM_INFO' ? parseUptimeInfo(r?.resultData) : { uptimeDays: null, lastBootTime: null };
                          const uptimeSev =
                            r?.checkType === 'SYSTEM_INFO'
                              ? getUptimeSeverity(uptimeInfo.uptimeDays, rebootThresholds)
                              : null;
                          const uptimeBadge =
                            uptimeSev === 'critical'
                              ? 'bg-red-500/10 text-red-200'
                              : uptimeSev === 'warning'
                                ? 'bg-amber-500/10 text-amber-200'
                                : '';
                          const uptimeRing =
                            uptimeSev === 'critical'
                              ? 'inset 0 0 0 2px rgb(239 68 68)'
                              : uptimeSev === 'warning'
                                ? 'inset 0 0 0 2px rgb(245 158 11)'
                                : '';
                          return (
                            <td
                              key={key}
                              className="p-4 text-sm text-slate-300"
                            >
                              <div className="max-w-[260px] truncate" title={summary || ''}>
                                {notFound && summary ? (
                                  <span
                                    className="inline-block max-w-full truncate px-2 py-1 rounded-none bg-red-500/10 text-red-200"
                                    style={{ boxShadow: 'inset 0 0 0 2px rgb(239 68 68)' }}
                                  >
                                    {summary}
                                  </span>
                                ) : uptimeBadge && summary ? (
                                  <span
                                    className={`inline-block max-w-full truncate px-2 py-1 ${uptimeBadge}`}
                                    style={uptimeRing ? { boxShadow: uptimeRing } : undefined}
                                  >
                                    {summary}
                                  </span>
                                ) : (
                                  summary || <span className="text-slate-500">-</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                          onClick={async () => {
                            try {
                              await api.triggerCheck(machine.id, 'FULL_CHECK');
                              toast.success(`Full check started for ${machine.hostname}`);
                              setTimeout(loadData, 2000);
                            } catch (e) {
                              toast.error(`Failed to start check for ${machine.hostname}`);
                            }
                          }}
                        >
                          Run
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}