import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { loadRebootThresholds, parseUptimeInfo, getUptimeSeverity } from '../utils/reboot';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { StatusBadge } from '../components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

type CheckStatus = 'SUCCESS' | 'FAILED' | 'WARNING' | 'TIMEOUT';
type Expected = { machineId: string; checkType: string; checkName: string };

function makeObjectKey(checkType: string, checkName: string) {
  return `${checkType}::${checkName}`;
}

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: any) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(v: any) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractUserDisplay(resultData: any): string | null {
  const data = resultData && typeof resultData === 'object' ? resultData : {};
  const current = (data as any).currentUser ?? (data as any).current_user;
  const last = (data as any).lastUser ?? (data as any).last_user;

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

  const cur = parseMaybe(current);
  if (Array.isArray(cur)) {
    const active = cur.find((r) => String((r as any)?.State ?? (r as any)?.state ?? '').toLowerCase() === 'active');
    const row = active ?? cur[0];
    const u = (row as any)?.Username ?? (row as any)?.username ?? (row as any)?.User ?? (row as any)?.user;
    if (u) return String(u);
  } else if (cur && typeof cur === 'object') {
    if (!(cur as any).NoUserLoggedIn) {
      const u = (cur as any).Username ?? (cur as any).username;
      if (u) return String(u);
    }
  } else if (typeof cur === 'string') {
    const s = cur.trim();
    if (s && s.toLowerCase() !== 'unknown') return s;
  }

  const l = parseMaybe(last);
  if (l && typeof l === 'object' && !Array.isArray(l)) {
    const u = (l as any).LastUser ?? (l as any).lastUser ?? (l as any).last_user;
    if (u && String(u).toLowerCase() !== 'unknown') return String(u);
  } else if (typeof l === 'string') {
    const s = l.trim();
    if (s && s.toLowerCase() !== 'unknown') return s;
  }

  return null;
}

function summarizeResult(r: any): string {
  if (!r) return '';
  if (r.message) return String(r.message);
  const data = r.resultData;
  if (r.checkType === 'USER_INFO') {
    const u = extractUserDisplay(data);
    return u ? `user=${u}` : 'no user';
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data);
    return keys.length ? `${keys.length} fields` : '';
  }
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);
  return '';
}

function safeInlineValue(v: any) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function renderResultDataInline(result: any, maxLen = 220): { text: string; truncated: boolean } {
  const data = result?.resultData;
  if (result?.checkType === 'SYSTEM_INFO' && data && typeof data === 'object' && !Array.isArray(data)) {
    const { uptimeDays, lastBootTime } = parseUptimeInfo(data);
    const parts: string[] = [];
    if (uptimeDays !== null) parts.push(`uptime=${Number(uptimeDays.toFixed(2))}d`);
    if (lastBootTime) {
      const d = new Date(lastBootTime);
      parts.push(`boot=${Number.isNaN(d.getTime()) ? lastBootTime : d.toLocaleDateString()}`);
    }
    // CPU Information
    const cpuMaxMHz = Number((data as any).MaxClockSpeed ?? (data as any).maxClockSpeed);
    const cpuCurMHz = Number((data as any).CurrentClockSpeed ?? (data as any).currentClockSpeed);
    const cpuLoad = Number((data as any).LoadPercentage ?? (data as any).loadPercentage);
    if (Number.isFinite(cpuMaxMHz) || Number.isFinite(cpuCurMHz)) {
      const mhzToGhz = (mhz: number) => `${Number((mhz / 1000).toFixed(2))}GHz`;
      if (Number.isFinite(cpuCurMHz)) parts.push(`cpuCur=${mhzToGhz(cpuCurMHz)}`);
      if (Number.isFinite(cpuMaxMHz)) parts.push(`cpuMax=${mhzToGhz(cpuMaxMHz)}`);
      if (Number.isFinite(cpuLoad)) parts.push(`cpuLoad=${Math.round(cpuLoad)}%`);
    }

    // Disk Space Check
    const drive = (data as any).Drive ?? (data as any).drive;
    const freeGB = Number((data as any).FreeSpaceGB ?? (data as any).freeSpaceGB);
    const percentFree = Number((data as any).PercentFree ?? (data as any).percentFree);
    if (drive || Number.isFinite(freeGB) || Number.isFinite(percentFree)) {
      const d = drive ? String(drive) : 'disk';
      const sub: string[] = [];
      if (Number.isFinite(freeGB)) sub.push(`${Number(freeGB.toFixed(2))}GB`);
      if (Number.isFinite(percentFree)) sub.push(`${Number(percentFree.toFixed(1))}%`);
      if (sub.length) parts.push(`${d}Free=${sub.join(' ')}`);
    }

    if (parts.length > 0) {
      const out = parts.join(' · ');
      const truncated = out.length > maxLen;
      return { text: truncated ? `${out.slice(0, maxLen)}…` : out, truncated };
    }
  }
  if (result?.checkType === 'USER_INFO') {
    const u = extractUserDisplay(data);
    const t = u ? `user=${u}` : safeInlineValue(data);
    const truncated = t.length > maxLen;
    return { text: truncated ? `${t.slice(0, maxLen)}…` : t, truncated };
  }

  let out = '';
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      out = safeInlineValue(data);
    } else {
      const entries = Object.entries(data as Record<string, any>);
      // Prefer a readable key=value preview for top-level objects.
      const parts = entries.slice(0, 10).map(([k, v]) => `${k}=${safeInlineValue(v)}`);
      out = parts.join(' · ');
      if (entries.length > 10) out += ` · …(+${entries.length - 10})`;
    }
  } else {
    out = safeInlineValue(data);
  }

  const truncated = out.length > maxLen;
  return { text: truncated ? `${out.slice(0, maxLen)}…` : out, truncated };
}

function badgeForStatus(s?: CheckStatus) {
  if (s === 'FAILED' || s === 'TIMEOUT') return 'failed' as const;
  if (s === 'WARNING') return 'warning' as const;
  if (s === 'SUCCESS') return 'success' as const;
  return 'offline' as const;
}

function isNotFoundResult(r: any): boolean {
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
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const exists = (data as any).exists ?? (data as any).Exists;
  return exists === false;
}

export function AdHocScan() {
  const [machines, setMachines] = useState<any[]>([]);
  const [registryChecks, setRegistryChecks] = useState<any[]>([]);
  const [fileChecks, setFileChecks] = useState<any[]>([]);
  const [userChecks, setUserChecks] = useState<any[]>([]);
  const [systemChecks, setSystemChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMachineId, setSelectedMachineId] = useState<string>('none');
  const [useManualTarget, setUseManualTarget] = useState(false);
  const [manualTargetInput, setManualTargetInput] = useState('');
  const [manualTargetResolved, setManualTargetResolved] = useState<{ id: string; host: string } | null>(null);

  // Built-ins
  const [builtPing, setBuiltPing] = useState(true);
  const [builtUserInfo, setBuiltUserInfo] = useState(true); // to show user name by default
  const [builtSystemInfo, setBuiltSystemInfo] = useState(false);

  // Config selections
  const [selectedRegistry, setSelectedRegistry] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<Record<string, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<Record<string, boolean>>({});
  const [selectedSystem, setSelectedSystem] = useState<Record<string, boolean>>({});

  const [searchRegistry, setSearchRegistry] = useState('');
  const [searchFile, setSearchFile] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [searchSystem, setSearchSystem] = useState('');

  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [expected, setExpected] = useState<Expected[]>([]);
  const [latestMap, setLatestMap] = useState<Record<string, any>>({});
  const [selectedDetail, setSelectedDetail] = useState<{
    object: { checkType: string; checkName: string };
    result: any;
  } | null>(null);
  const pollTimer = useRef<number | null>(null);
  const rebootThresholds = useMemo(() => loadRebootThresholds(), []);

  const selectedMachine = useMemo(() => machines.find((m) => m.id === selectedMachineId), [machines, selectedMachineId]);
  const activeTarget = useMemo(() => {
    if (useManualTarget) {
      const host = manualTargetResolved?.host?.trim() || '';
      const id = manualTargetResolved?.id?.trim() || '';
      if (!host || !id) return null;
      return { id, hostname: host, ipAddress: host, location: { name: 'Manual' } };
    }
    return selectedMachine || null;
  }, [useManualTarget, manualTargetResolved, selectedMachine]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [m, rc, fc, uc, sc] = await Promise.all([
          api.getMachines(),
          api.getRegistryChecks(),
          api.getFileChecks(),
          api.getUserChecks(),
          api.getSystemChecks(),
        ]);
        setMachines(m);
        setRegistryChecks(rc);
        setFileChecks(fc);
        setUserChecks(uc);
        setSystemChecks(sc);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load scan options');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  const selectedIds = (m: Record<string, boolean>) => Object.entries(m).filter(([, v]) => v).map(([k]) => k);

  const selectedObjectList = useMemo(() => {
    const objects: { checkType: string; checkName: string }[] = [];
    if (builtPing) objects.push({ checkType: 'PING', checkName: 'Ping Test' });
    if (builtUserInfo) objects.push({ checkType: 'USER_INFO', checkName: 'User Information' });
    if (builtSystemInfo) objects.push({ checkType: 'SYSTEM_INFO', checkName: 'System Information' });

    for (const id of selectedIds(selectedRegistry)) {
      const rc = registryChecks.find((x) => x.id === id);
      if (rc) objects.push({ checkType: 'REGISTRY_CHECK', checkName: rc.name });
    }
    for (const id of selectedIds(selectedFile)) {
      const fc = fileChecks.find((x) => x.id === id);
      if (fc) objects.push({ checkType: 'FILE_CHECK', checkName: fc.name });
    }
    for (const id of selectedIds(selectedUser)) {
      const uc = userChecks.find((x) => x.id === id);
      if (uc) objects.push({ checkType: 'USER_INFO', checkName: uc.name });
    }
    for (const id of selectedIds(selectedSystem)) {
      const sc = systemChecks.find((x) => x.id === id);
      if (sc) objects.push({ checkType: 'SYSTEM_INFO', checkName: sc.name });
    }

    // Deduplicate by type+name
    const seen = new Set<string>();
    return objects.filter((o) => {
      const k = makeObjectKey(o.checkType, o.checkName);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [
    builtPing,
    builtUserInfo,
    builtSystemInfo,
    selectedRegistry,
    selectedFile,
    selectedUser,
    selectedSystem,
    registryChecks,
    fileChecks,
    userChecks,
    systemChecks,
  ]);

  const expectedDoneCount = useMemo(() => {
    const keys = new Set(Object.keys(latestMap));
    return expected.filter((e) => keys.has(`${e.machineId}::${makeObjectKey(e.checkType, e.checkName)}`)).length;
  }, [expected, latestMap]);

  const pollLatest = async (since: string, exp: Expected[], machineId: string) => {
    if (!since || exp.length === 0) return;
    const objects = Array.from(
      new Map(exp.map((e) => [makeObjectKey(e.checkType, e.checkName), { checkType: e.checkType, checkName: e.checkName }])).values()
    );

    const resp = await api.getLatestResultsForObjects({
      machineIds: [machineId],
      objects,
      since,
    });

    const next: Record<string, any> = {};
    for (const r of resp?.results ?? []) {
      const k = `${r.machineId}::${makeObjectKey(r.checkType, r.checkName)}`;
      next[k] = r;
    }
    setLatestMap(next);

    const done = exp.filter((e) => next[`${e.machineId}::${makeObjectKey(e.checkType, e.checkName)}`]).length;
    if (done >= exp.length) {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
      setRunning(false);
      toast.success('Ad-hoc scan complete');
    }
  };

  const runScan = async () => {
    // Manual target path (direct run; not persisted)
    if (useManualTarget) {
      const host = manualTargetInput.trim();
      if (!host) {
        toast.error('Enter a target hostname/IP');
        return;
      }
      if (selectedObjectList.length === 0) {
        toast.error('Select at least one attribute/check');
        return;
      }

      try {
        setRunning(true);
        setLatestMap({});
        setExpected([]);
        setStartedAt(null);
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        pollTimer.current = null;

        const payload = {
          targetHost: host,
          builtIns: { ping: builtPing, userInfo: builtUserInfo, systemInfo: builtSystemInfo },
          registryCheckIds: selectedIds(selectedRegistry),
          fileCheckIds: selectedIds(selectedFile),
          userCheckIds: selectedIds(selectedUser),
          systemCheckIds: selectedIds(selectedSystem),
        };

        const resp = await api.runAdHocScanDirect(payload);
        setManualTargetResolved({ id: resp.targetId, host: resp.targetHost });
        setStartedAt(resp.startedAt);
        setExpected(resp.expected || []);

        const next: Record<string, any> = {};
        for (const r of resp?.results ?? []) {
          const k = `${r.machineId}::${makeObjectKey(r.checkType, r.checkName)}`;
          next[k] = r;
        }
        setLatestMap(next);

        toast.success('Ad-hoc scan complete (manual target)');
      } catch (e: any) {
        toast.error(e?.message || 'Failed to run scan');
      } finally {
        setRunning(false);
      }
      return;
    }

    if (selectedMachineId === 'none') {
      toast.error('Select a machine first');
      return;
    }
    if (selectedObjectList.length === 0) {
      toast.error('Select at least one attribute/check');
      return;
    }

    try {
      setRunning(true);
      setLatestMap({});

      const payload = {
        machineIds: [selectedMachineId],
        builtIns: { ping: builtPing, userInfo: builtUserInfo, systemInfo: builtSystemInfo },
        registryCheckIds: selectedIds(selectedRegistry),
        fileCheckIds: selectedIds(selectedFile),
        userCheckIds: selectedIds(selectedUser),
        systemCheckIds: selectedIds(selectedSystem),
      };

      const resp = await api.runAdHocScan(payload);
      setStartedAt(resp.startedAt);
      setExpected(resp.expected || []);

      // Kick off polling
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = window.setInterval(() => {
        pollLatest(resp.startedAt, resp.expected || [], selectedMachineId).catch(() => null);
      }, 2000);
      await pollLatest(resp.startedAt, resp.expected || [], selectedMachineId);

      toast.success('Scan queued');
    } catch (e: any) {
      setRunning(false);
      toast.error(e?.message || 'Failed to start scan');
    }
  };

  const exportTable = (format: 'csv' | 'md' | 'html') => {
    if (!activeTarget) {
      toast.error(useManualTarget ? 'Run a scan first' : 'Select a machine first');
      return;
    }
    if (selectedObjectList.length === 0) {
      toast.error('Select at least one attribute/check');
      return;
    }

    const loc = activeTarget.location?.name || 'Undefined';
    const ip = activeTarget.ipAddress || '';

    // Resolve user name from any USER_INFO object we have for this machine
    let user: string | null = null;
    for (const obj of selectedObjectList.filter((o) => o.checkType === 'USER_INFO')) {
      const r = latestMap[`${activeTarget.id}::${makeObjectKey(obj.checkType, obj.checkName)}`];
      const u = extractUserDisplay(r?.resultData);
      if (u) {
        user = u;
        break;
      }
    }

    const headers = ['Machine', 'Location', 'IP Address', 'User', ...selectedObjectList.map((o) => o.checkName)];
    const row: string[] = [];
    row.push(`${activeTarget.hostname} (${loc})`);
    row.push(loc);
    row.push(ip);
    row.push(user || '');
    for (const obj of selectedObjectList) {
      const r = latestMap[`${activeTarget.id}::${makeObjectKey(obj.checkType, obj.checkName)}`];
      if (!r) {
        row.push('');
        continue;
      }
      const v = r.resultData;
      const rendered =
        v && typeof v === 'object'
          ? JSON.stringify(v)
          : v === null || v === undefined
            ? ''
            : String(v);
      row.push(`${r.status || ''}${rendered ? `: ${rendered}` : ''}`);
    }

    const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
    const safeHost = String(activeTarget.hostname || 'target').replace(/[^\w.-]+/g, '_').slice(0, 80);
    const base = `adhoc-scan-${safeHost}-${ts}`;

    if (format === 'csv') {
      const csv = [headers.map(escapeCsv).join(','), row.map(escapeCsv).join(',')].join('\r\n') + '\r\n';
      downloadTextFile(`${base}.csv`, csv, 'text/csv;charset=utf-8');
      toast.success('Exported CSV');
      return;
    }

    if (format === 'md') {
      const mdHeader = `| ${headers.map((h) => String(h).replace(/\|/g, '\\|')).join(' | ')} |`;
      const mdSep = `| ${headers.map(() => '---').join(' | ')} |`;
      const mdRow = `| ${row.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;
      const md = [`<!-- Generated: ${new Date().toISOString()} -->`, '', mdHeader, mdSep, mdRow, '', ''].join('\n');
      downloadTextFile(`${base}.md`, md, 'text/markdown;charset=utf-8');
      toast.success('Exported Markdown');
      return;
    }

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ad-Hoc Scan Export</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
      h1 { margin: 0 0 12px; font-size: 18px; }
      .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #f5f5f5; }
    </style>
  </head>
  <body>
    <h1>Ad-Hoc Scan</h1>
    <div class="meta">Generated: ${escapeHtml(new Date().toISOString())}</div>
    <table>
      <thead>
        <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        <tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>
      </tbody>
    </table>
  </body>
</html>
`;
    downloadTextFile(`${base}.html`, html, 'text/html;charset=utf-8');
    toast.success('Exported HTML');
  };

  const filterList = (list: any[], q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((x) => String(x?.name ?? '').toLowerCase().includes(needle));
  };

  const filteredRegistry = useMemo(() => filterList(registryChecks, searchRegistry), [registryChecks, searchRegistry]);
  const filteredFile = useMemo(() => filterList(fileChecks, searchFile), [fileChecks, searchFile]);
  const filteredUser = useMemo(() => filterList(userChecks, searchUser), [userChecks, searchUser]);
  const filteredSystem = useMemo(() => filterList(systemChecks, searchSystem), [systemChecks, searchSystem]);

  const toggleAll = (list: any[], setter: (v: Record<string, boolean>) => void, on: boolean) => {
    const next: Record<string, boolean> = {};
    for (const x of list) next[x.id] = on;
    setter(next);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">AdHoc Scan</h1>
          <p className="text-sm text-slate-400 mt-1">Run an on-demand scan with any configured attributes, then export the result.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={() => exportTable('csv')}
            disabled={!activeTarget || expected.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={() => exportTable('html')}
            disabled={!activeTarget || expected.length === 0}
          >
            Export HTML
          </Button>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={() => exportTable('md')}
            disabled={!activeTarget || expected.length === 0}
          >
            Export Markdown
          </Button>
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={runScan} disabled={loading || running}>
            {running ? 'Running…' : 'Run Scan'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800 p-6 lg:col-span-1">
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Target machine</Label>
              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  checked={useManualTarget}
                  onCheckedChange={(v) => {
                    const on = Boolean(v);
                    setUseManualTarget(on);
                    setLatestMap({});
                    setExpected([]);
                    setStartedAt(null);
                    if (pollTimer.current) window.clearInterval(pollTimer.current);
                    pollTimer.current = null;
                    if (!on) {
                      setManualTargetResolved(null);
                      setManualTargetInput('');
                    } else {
                      setSelectedMachineId('none');
                    }
                  }}
                />
                <span className="text-sm text-slate-300">Use manual one-off target (not saved)</span>
              </div>

              {!useManualTarget ? (
                <Select value={selectedMachineId} onValueChange={setSelectedMachineId} disabled={loading}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 mt-2">
                    <SelectValue placeholder="Select a machine…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="none">Select…</SelectItem>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.hostname} ({m.location?.name || 'Undefined'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-2 space-y-2">
                  <Input
                    value={manualTargetInput}
                    onChange={(e) => setManualTargetInput(e.target.value)}
                    placeholder="Hostname or IP (e.g., 192.168.6.4 or host.docker.internal)"
                    className="bg-slate-950 border-slate-800 font-mono"
                    disabled={loading || running}
                  />
                  <div className="text-xs text-slate-500">
                    This runs directly against the target and does not add it to Machines or persist results.
                  </div>
                </div>
              )}
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-medium text-slate-200 mb-3">Built-in attributes</div>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2 text-slate-300">
                  <Checkbox checked={builtPing} onCheckedChange={(v) => setBuiltPing(Boolean(v))} />
                  Ping (reachable)
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <Checkbox checked={builtUserInfo} onCheckedChange={(v) => setBuiltUserInfo(Boolean(v))} />
                  User Information (shows user name)
                </label>
                <label className="flex items-center gap-2 text-slate-300">
                  <Checkbox checked={builtSystemInfo} onCheckedChange={(v) => setBuiltSystemInfo(Boolean(v))} />
                  System Information
                </label>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              {startedAt ? (
                <>
                  <div>
                    <span className="text-slate-400">Last run:</span> <span className="font-mono">{new Date(startedAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Progress:</span>{' '}
                    <span className="font-mono">
                      {expectedDoneCount}/{expected.length}
                    </span>
                  </div>
                </>
              ) : (
                'No scan started yet.'
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6 lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">Registry checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(registryChecks, setSelectedRegistry, true)}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(registryChecks, setSelectedRegistry, false)}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchRegistry}
                onChange={(e) => setSearchRegistry(e.target.value)}
                placeholder="Search registry checks…"
                className="mt-3 bg-slate-950 border-slate-800"
              />
              <div className="mt-3 max-h-48 overflow-auto space-y-2 pr-1">
                {filteredRegistry.length === 0 ? (
                  <div className="text-xs text-slate-500">No registry checks configured.</div>
                ) : (
                  filteredRegistry.map((c) => (
                    <label key={c.id} className="flex items-start gap-2 text-sm text-slate-300">
                      <Checkbox
                        checked={Boolean(selectedRegistry[c.id])}
                        onCheckedChange={(v) => setSelectedRegistry((p) => ({ ...p, [c.id]: Boolean(v) }))}
                      />
                      <span>
                        <span className="font-mono">{c.name}</span>{' '}
                        {!c.isActive && <span className="text-xs text-slate-500">(inactive)</span>}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">File checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(fileChecks, setSelectedFile, true)}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(fileChecks, setSelectedFile, false)}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchFile}
                onChange={(e) => setSearchFile(e.target.value)}
                placeholder="Search file checks…"
                className="mt-3 bg-slate-950 border-slate-800"
              />
              <div className="mt-3 max-h-48 overflow-auto space-y-2 pr-1">
                {filteredFile.length === 0 ? (
                  <div className="text-xs text-slate-500">No file checks configured.</div>
                ) : (
                  filteredFile.map((c) => (
                    <label key={c.id} className="flex items-start gap-2 text-sm text-slate-300">
                      <Checkbox
                        checked={Boolean(selectedFile[c.id])}
                        onCheckedChange={(v) => setSelectedFile((p) => ({ ...p, [c.id]: Boolean(v) }))}
                      />
                      <span>
                        <span className="font-mono">{c.name}</span>{' '}
                        {!c.isActive && <span className="text-xs text-slate-500">(inactive)</span>}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">User checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(userChecks, setSelectedUser, true)}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(userChecks, setSelectedUser, false)}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search user checks…"
                className="mt-3 bg-slate-950 border-slate-800"
              />
              <div className="mt-3 max-h-48 overflow-auto space-y-2 pr-1">
                {filteredUser.length === 0 ? (
                  <div className="text-xs text-slate-500">No user checks configured.</div>
                ) : (
                  filteredUser.map((c) => (
                    <label key={c.id} className="flex items-start gap-2 text-sm text-slate-300">
                      <Checkbox
                        checked={Boolean(selectedUser[c.id])}
                        onCheckedChange={(v) => setSelectedUser((p) => ({ ...p, [c.id]: Boolean(v) }))}
                      />
                      <span>
                        <span className="font-mono">{c.name}</span>{' '}
                        {!c.isActive && <span className="text-xs text-slate-500">(inactive)</span>}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-200">System checks</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(systemChecks, setSelectedSystem, true)}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => toggleAll(systemChecks, setSelectedSystem, false)}
                  >
                    None
                  </Button>
                </div>
              </div>
              <Input
                value={searchSystem}
                onChange={(e) => setSearchSystem(e.target.value)}
                placeholder="Search system checks…"
                className="mt-3 bg-slate-950 border-slate-800"
              />
              <div className="mt-3 max-h-48 overflow-auto space-y-2 pr-1">
                {filteredSystem.length === 0 ? (
                  <div className="text-xs text-slate-500">No system checks configured.</div>
                ) : (
                  filteredSystem.map((c) => (
                    <label key={c.id} className="flex items-start gap-2 text-sm text-slate-300">
                      <Checkbox
                        checked={Boolean(selectedSystem[c.id])}
                        onCheckedChange={(v) => setSelectedSystem((p) => ({ ...p, [c.id]: Boolean(v) }))}
                      />
                      <span>
                        <span className="font-mono">{c.name}</span>{' '}
                        {!c.isActive && <span className="text-xs text-slate-500">(inactive)</span>}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6 mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-200">Latest results</div>
            <div className="text-xs text-slate-500 mt-1">
              Results populate as the queued checks complete (polled via <span className="font-mono">/api/data/latest-results</span>).
            </div>
          </div>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            disabled={!startedAt || running}
            onClick={() => {
              if (!startedAt || expected.length === 0 || selectedMachineId === 'none') return;
              pollLatest(startedAt, expected, selectedMachineId).catch(() => null);
            }}
          >
            Refresh
          </Button>
        </div>

        {!activeTarget ? (
          <div className="mt-4 text-sm text-slate-500">
            {useManualTarget ? 'Enter a manual target and run a scan to view results.' : 'Select a machine to view results.'}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Attribute</th>
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Status</th>
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Result</th>
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Created</th>
                  <th className="text-right p-3 text-xs font-medium text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {selectedObjectList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-sm text-slate-500">
                      Select attributes above, then run a scan.
                    </td>
                  </tr>
                ) : (
                  selectedObjectList.map((o) => {
                    const r = latestMap[`${activeTarget.id}::${makeObjectKey(o.checkType, o.checkName)}`];
                    const status = (r?.status as CheckStatus | undefined) ?? undefined;
                    const inline = r ? renderResultDataInline(r) : null;
                    const notFound = isNotFoundResult(r);
                    const uptimeSev =
                      r?.checkType === 'SYSTEM_INFO'
                        ? getUptimeSeverity(parseUptimeInfo(r?.resultData).uptimeDays, rebootThresholds)
                        : null;
                    const uptimeClass =
                      uptimeSev === 'critical'
                        ? 'bg-red-500/10 text-red-200 ring-2 ring-red-500 ring-inset'
                        : uptimeSev === 'warning'
                          ? 'bg-amber-500/10 text-amber-200 ring-2 ring-amber-500 ring-inset'
                          : '';
                    return (
                      <tr key={makeObjectKey(o.checkType, o.checkName)} className="border-b border-slate-800 hover:bg-slate-800/40">
                        <td className="p-3 text-sm text-slate-200">
                          <span className="font-mono">{o.checkName}</span>{' '}
                          <span className="text-xs text-slate-500">({o.checkType})</span>
                        </td>
                        <td className="p-3 text-sm">
                          {status ? <StatusBadge status={badgeForStatus(status)}>{status}</StatusBadge> : <span className="text-slate-500">—</span>}
                        </td>
                        <td
                          className={`p-3 text-sm ${
                            notFound
                              ? 'bg-red-500/10 text-red-200 ring-2 ring-red-500 ring-inset'
                              : uptimeClass || 'text-slate-300'
                          }`}
                        >
                          {r ? (
                            <div className="space-y-1">
                              <div className="font-mono text-xs break-words">{inline?.text || ''}</div>
                              {r.message ? (
                                <div className="text-xs text-slate-500 break-words">message: {String(r.message)}</div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-500">Pending…</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                          {r?.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                            disabled={!r}
                            onClick={() => setSelectedDetail({ object: o, result: r })}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selectedDetail} onOpenChange={() => setSelectedDetail(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl">
          <DialogHeader>
            <DialogTitle>Result Details</DialogTitle>
          </DialogHeader>
          {selectedDetail ? (
            <div className="space-y-3">
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Attribute:</span>{' '}
                <span className="font-mono">
                  {selectedDetail.object.checkName} ({selectedDetail.object.checkType})
                </span>
              </div>
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Status:</span>{' '}
                <span className="font-mono">{selectedDetail.result?.status ?? '—'}</span>
              </div>
              {selectedDetail.result?.message ? (
                <div className="text-sm text-slate-300">
                  <span className="text-slate-500">Message:</span>{' '}
                  <span className="font-mono">{String(selectedDetail.result.message)}</span>
                </div>
              ) : null}
              <div>
                <Label className="text-slate-400">ResultData (JSON)</Label>
                <pre className="mt-2 p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono overflow-x-auto text-slate-300 max-h-[420px] overflow-y-auto">
                  {JSON.stringify(selectedDetail.result?.resultData ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}


