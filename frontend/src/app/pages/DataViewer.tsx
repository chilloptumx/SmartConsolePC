import { useState, useEffect } from 'react';
import { Search, Download, Filter, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';
import { api } from '../services/api';

export function DataViewer() {
  const [checkResults, setCheckResults] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  // Pagination (server-side)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number }>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMachine, setFilterMachine] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterUserMode, setFilterUserMode] = useState<'current' | 'last' | 'either'>('current');

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds (keeps current filters/paging)
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMachine, filterType, filterStatus, filterUser, filterUserMode, page, pageSize]);

  useEffect(() => {
    applyFilters();
  }, [checkResults, searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        limit: pageSize,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      if (filterMachine !== 'all') params.machineId = filterMachine;
      if (filterType !== 'all') params.checkType = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterUser !== 'all') params.loggedInUser = filterUser;
      if (filterUser !== 'all') params.loggedInUserMode = filterUserMode;

      const usersModeParam = filterUserMode === 'either' ? 'both' : filterUserMode;
      const [resultsResponse, machinesData, usersData] = await Promise.all([
        api.getResults(params),
        api.getMachines(),
        api.getUserInfoUsers({ mode: usersModeParam }).catch(() => []),
      ]);

      const results = resultsResponse?.results || [];
      setCheckResults(results);
      if (resultsResponse?.pagination) {
        setPagination(resultsResponse.pagination);
      } else {
        // Fallback (shouldn't happen with current backend)
        setPagination({
          page,
          limit: pageSize,
          total: results.length,
          totalPages: 1,
        });
      }
      setMachines(machinesData);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load check results');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // Machine/type/status filters are now server-side. Keep search as a client-side filter on the current page.
    if (!searchTerm) {
      setFilteredResults(checkResults);
      return;
    }

    const q = searchTerm.toLowerCase();
    const filtered = checkResults.filter((result) => {
      const host = String(result.machine?.hostname || '').toLowerCase();
      const name = String(result.checkName || '').toLowerCase();
      const type = String(result.checkType || '').toLowerCase();
      return host.includes(q) || name.includes(q) || type.includes(q);
    });
    setFilteredResults(filtered);
  };

  const exportToCsv = () => {
    try {
      const headers = ['Timestamp', 'Machine', 'Check Name', 'Check Type', 'Status', 'Result', 'Message'];
      const rows = filteredResults.map(result => [
        new Date(result.createdAt).toLocaleString(),
        result.machine?.hostname || 'Unknown',
        result.checkName || '',
        result.checkType || 'Unknown',
        result.status || 'Unknown',
        typeof result.resultData === 'object' ? JSON.stringify(result.resultData) : result.resultData,
        result.message || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healthcheck-results-${new Date().toISOString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'success';
      case 'FAILED': return 'failed';
      case 'WARNING': return 'warning';
      default: return 'offline';
    }
  };

  const formatCheckType = (type: string) => {
    return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
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

  const renderResultSummary = (result: any) => {
    if (result?.message) return result.message;

    const data = result?.resultData;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // USER_INFO: show current/last user instead of generic "2 fields"
      if (result.checkType === 'USER_INFO') {
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

        const pickCurrentUsername = () => {
          if (Array.isArray(current)) {
            const active = current.find((r: any) => String(r?.State ?? r?.state ?? '').toLowerCase() === 'active');
            const row = active ?? current[0];
            return row?.Username ?? row?.username ?? null;
          }
          if (current && typeof current === 'object') {
            if ((current as any).NoUserLoggedIn) return null;
            return (current as any).Username ?? (current as any).username ?? null;
          }
          if (typeof current === 'string') {
            const s = current.trim();
            return s && s.toLowerCase() !== 'unknown' ? s : null;
          }
          return null;
        };

        const pickLastUser = () => {
          if (last && typeof last === 'object' && !Array.isArray(last)) {
            const u = (last as any).LastUser ?? (last as any).lastUser ?? (last as any).last_user;
            return u ? String(u) : null;
          }
          if (typeof last === 'string') {
            const s = last.trim();
            return s && s.toLowerCase() !== 'unknown' ? s : null;
          }
          return null;
        };

        const cur = pickCurrentUsername();
        const lu = pickLastUser();

        const parts: string[] = [];
        if (cur) parts.push(`current=${String(cur)}`);
        if (lu) parts.push(`last=${String(lu)}`);
        return parts.length ? parts.join(' · ') : 'no user';
      }

      // Normalize common fields (older data used different casing/keys).
      const exists = (data.exists ?? data.Exists) as boolean | undefined;
      const path = (data.path ?? data.FullPath ?? data.fullPath) as string | undefined;
      const isDirectory = (data.isDirectory ?? data.PSIsContainer) as boolean | undefined;
      const sizeBytes = (data.sizeBytes ?? data.size_bytes) as number | undefined;
      const createdTime = (data.createdTime ?? data.creationTime ?? data.created ?? data.CreationTime) as string | undefined;
      const modifiedTime = (data.modifiedTime ?? data.lastWriteTime ?? data.modified ?? data.LastWriteTime) as string | undefined;

      const formatDateOnly = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return String(iso);
        return d.toLocaleDateString();
      };

      if (result.checkType === 'FILE_CHECK' && (exists !== undefined || path)) {
        const parts: string[] = [];
        if (path) parts.push(path);
        if (exists !== undefined) parts.push(`exists=${exists}`);
        if (isDirectory !== undefined) parts.push(isDirectory ? 'dir' : 'file');
        if (exists === true && !isDirectory && typeof sizeBytes === 'number') parts.push(formatBytesSI(sizeBytes));
        if (exists === true && createdTime) parts.push(`created=${formatDateOnly(createdTime)}`);
        if (exists === true && modifiedTime) parts.push(`modified=${formatDateOnly(modifiedTime)}`);
        return parts.join(' · ');
      }

      if (result.checkType === 'REGISTRY_CHECK' && (exists !== undefined || path)) {
        const valueName = (data.valueName ?? data.value_name) as string | undefined;
        const value = data.value;
        const valueKind = (data.valueKind ?? data.value_kind) as string | undefined;
        const valueType = (data.valueType ?? data.value_type) as string | undefined;
        const parts: string[] = [];
        if (path) parts.push(path);
        if (exists !== undefined) parts.push(`exists=${exists}`);
        if (exists === true && valueName) {
          const typeLabel = valueKind || (valueType ? valueType.split('.').pop() : undefined) || (value !== undefined ? typeof value : undefined);
          const valueLabel = value !== undefined ? `${valueName}=${String(value)}` : valueName;
          parts.push(typeLabel ? `${valueLabel} (${typeLabel})` : valueLabel);
        } else if (exists === true && !valueName) {
          parts.push('key found');
        } else if (valueName) {
          parts.push(valueName);
        }
        return parts.join(' · ');
      }

      if (result.checkType === 'PING') {
        const reachable = (data.reachable ?? (data as any).Reachable) as any;
        const ok =
          result.status === 'SUCCESS' ||
          reachable === true ||
          (data as any).success === true;

        const ms =
          (typeof (result as any).duration === 'number' && Number.isFinite((result as any).duration) && (result as any).duration >= 0)
            ? (result as any).duration
            : (typeof (data as any).responseTime === 'number' && Number.isFinite((data as any).responseTime))
              ? (data as any).responseTime
              : (typeof (data as any).avgResponseTime === 'number' && Number.isFinite((data as any).avgResponseTime))
                ? (data as any).avgResponseTime
                : null;

        return ms !== null ? `${ok ? 'success' : 'failed'} (${ms}ms)` : (ok ? 'success' : 'failed');
      }

      if (result.checkType === 'SYSTEM_INFO') {
        // Support custom system objects like Network Adapter Information (seeded as CUSTOM but stored as SYSTEM_INFO results).
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
            const v4 = parts.find((p) => /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(p));
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

        const computerName = data.ComputerName ?? data.computerName;
        const manufacturer = data.Manufacturer ?? data.manufacturer;
        const model = data.Model ?? data.model;
        const totalMemoryGB = data.TotalMemoryGB ?? data.totalMemoryGB;
        const osVersion = data.OSVersion ?? data.osVersion;
        const osArch = data.OSArchitecture ?? data.osArchitecture;
        const uptimeDays = data.UptimeDays ?? data.uptimeDays;
        
        const parts: string[] = [];
        if (computerName) parts.push(`${computerName}`);
        if (manufacturer || model) {
          const hw = [manufacturer, model].filter(Boolean).join(' ');
          if (hw) parts.push(hw);
        }
        if (totalMemoryGB !== undefined) parts.push(`${totalMemoryGB}GB RAM`);
        if (osVersion) parts.push(`${osVersion}`);
        if (osArch) parts.push(`${osArch}`);
        if (uptimeDays !== undefined) parts.push(`uptime ${uptimeDays}d`);
        
        return parts.length > 0 ? parts.join(' · ') : 'system info';
      }

      // Generic object fallback
      const keys = Object.keys(data);
      return `${keys.length} fields`;
    }

    return data ?? '';
  };

  const isNotFoundResult = (result: any) => {
    if (!result) return false;
    if (result.checkType !== 'REGISTRY_CHECK' && result.checkType !== 'FILE_CHECK') return false;
    let data: any = result.resultData;
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

  return (
    // Extra bottom padding so the pagination controls never get clipped by the bottom of the scroll container.
    <div className="p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">Data Viewer</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-slate-700" onClick={exportToCsv} disabled={filteredResults.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export to CSV
          </Button>
          <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={loadData}>
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800 p-6 mb-6">
        <h3 className="font-semibold mb-4 text-slate-200 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <Label className="text-slate-300 text-sm">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-slate-950 border-slate-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-slate-300 text-sm">Machine</Label>
            <Select
              value={filterMachine}
              onValueChange={(v) => {
                setFilterMachine(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Machines</SelectItem>
                {machines.map(machine => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.hostname} ({machine.location?.name || 'Undefined'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 text-sm">Check Type</Label>
            <Select
              value={filterType}
              onValueChange={(v) => {
                setFilterType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PING">Ping</SelectItem>
                <SelectItem value="REGISTRY_CHECK">Registry Check</SelectItem>
                <SelectItem value="FILE_CHECK">File Check</SelectItem>
                <SelectItem value="USER_INFO">User Info</SelectItem>
                <SelectItem value="SYSTEM_INFO">System Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 text-sm">Status</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => {
                setFilterStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 text-sm">User</Label>
            <Select
              value={filterUser}
              onValueChange={(v) => {
                setFilterUser(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Users</SelectItem>
                {users.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No users found
                  </SelectItem>
                ) : (
                  users.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 text-sm">User Field</Label>
            <Select
              value={filterUserMode}
              onValueChange={(v) => {
                const mode = (v as any) as 'current' | 'last' | 'either';
                setFilterUserMode(mode);
                setFilterUser('all');
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="last">Last</SelectItem>
                <SelectItem value="either">Either</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(searchTerm ||
          filterMachine !== 'all' ||
          filterType !== 'all' ||
          filterStatus !== 'all' ||
          filterUser !== 'all' ||
          filterUserMode !== 'current') && (
          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSearchTerm('');
                setFilterMachine('all');
                setFilterType('all');
                setFilterStatus('all');
                setFilterUser('all');
                setFilterUserMode('current');
                setPage(1);
              }}
              className="border-slate-700"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Results Table */}
      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Timestamp</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Machine</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Check Type</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Result</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No check results found. Run some checks to see data here.
                  </td>
                </tr>
              ) : (
                filteredResults.map((result) => (
                  <tr key={result.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-4 text-sm text-slate-400 font-mono">
                      {new Date(result.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-sm text-slate-300">
                      {result.machine?.hostname || 'Unknown'} ({result.machine?.location?.name || 'Undefined'})
                    </td>
                    <td className="p-4 text-sm">
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">
                        {result.checkName || formatCheckType(result.checkType)}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={getStatusColor(result.status)} withDot>
                        {result.status}
                      </StatusBadge>
                    </td>
                    <td
                      className={`p-4 text-sm ${
                        isNotFoundResult(result)
                          ? 'bg-red-500/10 text-red-200 ring-2 ring-red-500 ring-inset'
                          : 'text-slate-300'
                      }`}
                    >
                      {(() => {
                        const notFound = isNotFoundResult(result);
                        const textClass = notFound ? 'text-red-200' : result.message ? 'text-amber-300' : 'text-slate-300';
                        const boxClass = notFound ? 'inline-block w-full px-2 py-1 rounded-none' : '';
                        return (
                          <span className={`${textClass} ${boxClass}`}>
                            {renderResultSummary(result) || <span className="text-slate-500">-</span>}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedResult(result)}
                        className="hover:bg-slate-800 text-slate-300"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Results count */}
        {!loading && (
          <div className="sticky bottom-0 z-10 p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur text-sm text-slate-400 flex items-center justify-between gap-4 flex-wrap">
            <div>
              {(() => {
                const total = pagination.total || 0;
                if (total <= 0) return <span>Showing 0 results</span>;
                const from = (pagination.page - 1) * pagination.limit + 1;
                const to = Math.min((pagination.page - 1) * pagination.limit + checkResults.length, total);
                if (searchTerm) {
                  return (
                    <span>
                      Showing {filteredResults.length} matching on this page (rows {from}-{to} of {total})
                    </span>
                  );
                }
                return (
                  <span>
                    Showing {from}-{to} of {total}
                  </span>
                );
              })()}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    const next = parseInt(v, 10);
                    setPageSize(next);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[90px] bg-slate-950 border-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs text-slate-500">
                  Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                  disabled={pagination.totalPages === 0 || page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages || p + 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Details Modal */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle>Check Result Details</DialogTitle>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400">Machine</Label>
                  <div className="font-mono mt-1 text-slate-200">{selectedResult.machine?.hostname || 'Unknown'}</div>
                </div>
                <div>
                  <Label className="text-slate-400">Check Name</Label>
                  <div className="mt-1 text-slate-200">{selectedResult.checkName || formatCheckType(selectedResult.checkType)}</div>
                </div>
                <div>
                  <Label className="text-slate-400">Check Type</Label>
                  <div className="mt-1 text-slate-200">{formatCheckType(selectedResult.checkType)}</div>
                </div>
                <div>
                  <Label className="text-slate-400">Timestamp</Label>
                  <div className="font-mono text-sm mt-1 text-slate-300">
                    {new Date(selectedResult.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label className="text-slate-400">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={getStatusColor(selectedResult.status)} withDot>
                      {selectedResult.status}
                    </StatusBadge>
                  </div>
                </div>
                {selectedResult.duration && (
                  <div>
                    <Label className="text-slate-400">Duration</Label>
                    <div className="mt-1 text-slate-300">{selectedResult.duration}ms</div>
                  </div>
                )}
              </div>

              {selectedResult.message && (
                <div>
                  <Label className="text-slate-400">Message</Label>
                  <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-sm text-amber-300">
                    {selectedResult.message}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-slate-400">Result Data (JSON)</Label>
                <pre className="mt-2 p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono overflow-x-auto text-slate-300 max-h-96 overflow-y-auto">
                  {JSON.stringify(selectedResult.resultData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
