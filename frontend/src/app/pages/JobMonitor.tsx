import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { api } from '../services/api';

type MonitorEvent = {
  id: string;
  source: 'AUDIT' | 'CHECK_RESULT';
  createdAt: string;
  machineId?: string;
  machineHostname?: string;
  level?: string;
  eventType: string;
  title: string;
  status?: string;
  details: any;
};

export function JobMonitor({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<MonitorEvent | null>(null);

  // Filters
  const [filterMachine, setFilterMachine] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'audit' | 'check'>('all');
  const [search, setSearch] = useState<string>('');

  const loadMachines = async () => {
    try {
      const data = await api.getMachines();
      setMachines(data);
    } catch (e) {
      toast.error('Failed to load machines');
    }
  };

  const loadEvents = async (opts: { append?: boolean } = {}) => {
    setLoading(true);
    try {
      const resp = await api.getMonitorEvents({
        machineId: filterMachine === 'all' ? undefined : filterMachine,
        source: filterSource,
        search: search.trim() || undefined,
        limit: 100,
        before: opts.append ? nextCursor ?? undefined : undefined,
      });

      const list = resp?.results ?? [];
      const cursor = resp?.nextCursor ?? null;

      setEvents((prev) => (opts.append ? [...prev, ...list] : list));
      setNextCursor(cursor);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load job monitor events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMachine, filterSource]);

  const visible = useMemo(() => events, [events]);

  const locationForMachineId = (id?: string) => {
    if (!id) return 'Undefined';
    const m = machines.find((x) => x.id === id);
    return m?.location?.name || 'Undefined';
  };

  const badgeClass = (e: MonitorEvent) => {
    if (e.source === 'CHECK_RESULT') {
      if (e.status === 'FAILED') return 'bg-red-500/10 text-red-300 border border-red-500/20';
      if (e.status === 'WARNING') return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
      return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20';
    }
    if (e.level === 'ERROR') return 'bg-red-500/10 text-red-300 border border-red-500/20';
    if (e.level === 'WARN') return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
    return 'bg-slate-500/10 text-slate-300 border border-slate-500/20';
  };

  return (
    <div className={embedded ? '' : 'p-8'}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Job Monitor</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={() => navigate('/adhoc-scan')}
          >
            AdHoc Scan
          </Button>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            onClick={() => loadEvents()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-300 text-sm">Machine</Label>
            <Select value={filterMachine} onValueChange={setFilterMachine}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All Machines</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.hostname} ({m.location?.name || 'Undefined'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 text-sm">Source</Label>
            <Select value={filterSource} onValueChange={(v) => setFilterSource(v as any)}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="audit">Actions / Jobs</SelectItem>
                <SelectItem value="check">Check Results</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 text-sm">Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadEvents();
              }}
              placeholder="Search (hostname, event type, title)…"
              className="bg-slate-950 border-slate-800"
            />
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                onClick={() => loadEvents()}
                disabled={loading}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Time</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Machine</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Summary</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Loading…</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No events yet. Trigger a check, create a config item, or send an email report to generate events.
                  </td>
                </tr>
              ) : (
                visible.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                    <td className="p-4 text-sm text-slate-400 font-mono whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-slate-300 font-mono">
                      {e.machineHostname || '-'} <span className="text-slate-500">({locationForMachineId(e.machineId)})</span>
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded ${badgeClass(e)}`}>
                        {e.source === 'CHECK_RESULT' ? (e.status || e.eventType) : e.eventType}
                      </span>
                      <div className="text-xs text-slate-500 mt-1">{e.source}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-200">
                      {e.title}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                        onClick={() => setSelected(e)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            Showing {visible.length} events
          </div>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-950 hover:bg-slate-900"
            disabled={loading || !nextCursor}
            onClick={() => loadEvents({ append: true })}
          >
            Load More
          </Button>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-4xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Time:</span>{' '}
                <span className="font-mono">{new Date(selected.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Machine:</span>{' '}
                <span className="font-mono">
                  {selected.machineHostname || '-'} ({locationForMachineId(selected.machineId)})
                </span>
              </div>
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">Type:</span>{' '}
                <span className="font-mono">{selected.eventType}</span>{' '}
                <span className="text-slate-500">({selected.source})</span>
              </div>
              <div>
                <Label className="text-slate-400">Payload (JSON)</Label>
                <pre className="mt-2 p-4 bg-slate-950 rounded border border-slate-800 text-xs font-mono overflow-x-auto text-slate-300 max-h-[420px] overflow-y-auto">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


