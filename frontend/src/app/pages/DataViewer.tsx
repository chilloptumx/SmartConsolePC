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
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMachine, setFilterMachine] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [checkResults, searchTerm, filterMachine, filterType, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resultsResponse, machinesData] = await Promise.all([
        api.getCheckResults(),
        api.getMachines()
      ]);
      // Handle both array and {results, pagination} response formats
      const results = Array.isArray(resultsResponse) ? resultsResponse : resultsResponse.results || [];
      setCheckResults(results);
      setMachines(machinesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load check results');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...checkResults];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(result =>
        result.machine?.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.checkName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        result.checkType?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Machine filter
    if (filterMachine !== 'all') {
      filtered = filtered.filter(result => result.machineId === filterMachine);
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(result => result.checkType === filterType);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(result => result.status === filterStatus);
    }

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

      if (result.checkType === 'PING' && (data.reachable !== undefined)) {
        return `reachable=${String(data.reachable)}`;
      }

      // Generic object fallback
      const keys = Object.keys(data);
      return `${keys.length} fields`;
    }

    return data ?? '';
  };

  return (
    <div className="p-8">
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
        <div className="grid grid-cols-4 gap-4">
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
            <Select value={filterMachine} onValueChange={setFilterMachine}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Machines</SelectItem>
                {machines.map(machine => (
                  <SelectItem key={machine.id} value={machine.id}>{machine.hostname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300 text-sm">Check Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
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
        </div>
        {(searchTerm || filterMachine !== 'all' || filterType !== 'all' || filterStatus !== 'all') && (
          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSearchTerm('');
                setFilterMachine('all');
                setFilterType('all');
                setFilterStatus('all');
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
                      {result.machine?.hostname || 'Unknown'}
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
                    <td className="p-4 text-sm text-slate-300">
                      <span className={result.message ? 'text-amber-300' : 'text-slate-300'}>
                        {renderResultSummary(result) || <span className="text-slate-500">-</span>}
                      </span>
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
        {!loading && filteredResults.length > 0 && (
          <div className="p-4 border-t border-slate-800 text-sm text-slate-400">
            Showing {filteredResults.length} of {checkResults.length} results
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
