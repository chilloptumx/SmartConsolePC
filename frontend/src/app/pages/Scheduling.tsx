import { useState, useEffect } from 'react';
import { Plus, Play, Pencil, Trash2, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { api } from '../services/api';

export function Scheduling({ embedded = false }: { embedded?: boolean }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [appCadenceSaving, setAppCadenceSaving] = useState(false);
  const [pingCadence, setPingCadence] = useState('*/5 * * * *');
  const [userCadence, setUserCadence] = useState('*/10 * * * *');
  const [baselineCadence, setBaselineCadence] = useState('0 * * * *');
  const [pingEnabled, setPingEnabled] = useState(true);
  const [userEnabled, setUserEnabled] = useState(true);
  const [baselineEnabled, setBaselineEnabled] = useState(true);
  
  // Form state
  const [jobName, setJobName] = useState('');
  const [jobType, setJobType] = useState('PING');
  const [cronExpression, setCronExpression] = useState('*/5 * * * *');
  const [targetAll, setTargetAll] = useState(true);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsData, machinesData] = await Promise.all([
        api.getScheduledJobs(),
        api.getMachines()
      ]);
      setJobs(jobsData);
      setMachines(machinesData);

      // Derive the "3 cadence" values from existing jobs if present.
      const byType = (t: string) => jobsData.filter((j: any) => j?.jobType === t);
      const pick = (t: string) => byType(t).find((j: any) => String(j?.name ?? '').toLowerCase().includes('smartconsole')) ?? byType(t)[0];

      const pj = pick('PING');
      if (pj?.cronExpression) setPingCadence(pj.cronExpression);
      if (typeof pj?.isActive === 'boolean') setPingEnabled(pj.isActive);

      const uj = pick('USER_INFO');
      if (uj?.cronExpression) setUserCadence(uj.cronExpression);
      if (typeof uj?.isActive === 'boolean') setUserEnabled(uj.isActive);

      const bj = pick('BASELINE_CHECK');
      if (bj?.cronExpression) setBaselineCadence(bj.cronExpression);
      if (typeof bj?.isActive === 'boolean') setBaselineEnabled(bj.isActive);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load scheduled jobs');
    } finally {
      setLoading(false);
    }
  };

  const upsertAppCadenceJob = async (jobType: string, name: string, cronExpression: string, isActive: boolean) => {
    const existing = jobs.find((j: any) => j?.jobType === jobType && String(j?.name ?? '') === name);
    if (existing) {
      await api.updateScheduledJob(existing.id, { cronExpression, isActive, targetAll: true });
      return existing.id;
    }
    const created = await api.createScheduledJob({ name, jobType, cronExpression, targetAll: true });
    return created.id;
  };

  const applyAppCadences = async () => {
    // Basic cron sanity check
    const ok = (c: string) => String(c).trim().split(' ').length >= 5;
    if (![pingCadence, userCadence, baselineCadence].every(ok)) {
      toast.error('Invalid cron expression (expected at least 5 fields)');
      return;
    }

    setAppCadenceSaving(true);
    try {
      const keep = new Set([
        'SmartConsole: Ping cadence',
        'SmartConsole: Logged-in user cadence',
        'SmartConsole: Everything else cadence',
      ]);

      await upsertAppCadenceJob('PING', 'SmartConsole: Ping cadence', pingCadence, pingEnabled);
      await upsertAppCadenceJob('USER_INFO', 'SmartConsole: Logged-in user cadence', userCadence, userEnabled);
      await upsertAppCadenceJob('BASELINE_CHECK', 'SmartConsole: Everything else cadence', baselineCadence, baselineEnabled);

      // Disable legacy/duplicate jobs that would cause double-execution of the same cadences.
      // (We keep any non-overlapping job types like FULL_CHECK, and we keep your SmartConsole-named cadence jobs.)
      const freshJobs = await api.getScheduledJobs();
      const overlappingTypes = new Set(['PING', 'USER_INFO', 'SYSTEM_INFO', 'BASELINE_CHECK']);
      const duplicates = freshJobs.filter(
        (j: any) => overlappingTypes.has(j?.jobType) && !keep.has(String(j?.name ?? '')) && j?.isActive
      );
      for (const j of duplicates) {
        await api.updateScheduledJob(j.id, { isActive: false });
      }

      if (duplicates.length > 0) {
        toast.success(`Cadences applied (disabled ${duplicates.length} duplicate job${duplicates.length === 1 ? '' : 's'})`);
      } else {
        toast.success('Cadences applied');
      }
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to apply cadences');
    } finally {
      setAppCadenceSaving(false);
    }
  };

  const toggleJob = async (id: string, currentStatus: boolean) => {
    try {
      await api.updateScheduledJob(id, { isActive: !currentStatus });
      toast.success('Job status updated');
      loadData();
    } catch (error) {
      toast.error('Failed to update job');
    }
  };

  const runJobNow = async (id: string, name: string) => {
    try {
      await api.runJobNow(id);
      toast.success(`Running job: ${name}`);
    } catch (error) {
      toast.error('Failed to run job');
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobName || !cronExpression) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await api.createScheduledJob({
        name: jobName,
        jobType,
        cronExpression,
        targetAll,
        targetMachineIds: targetAll ? undefined : selectedMachines
      });
      toast.success('Job created successfully');
      setIsCreateOpen(false);
      setJobName('');
      setCronExpression('*/5 * * * *');
      setJobType('PING');
      setTargetAll(true);
      setSelectedMachines([]);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create job');
    }
  };

  const handleDeleteJob = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      await api.deleteScheduledJob(id);
      toast.success('Job deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  const cronPresets = [
    { value: '*/5 * * * *', label: 'Every 5 minutes' },
    { value: '*/15 * * * *', label: 'Every 15 minutes' },
    { value: '*/30 * * * *', label: 'Every 30 minutes' },
    { value: '0 * * * *', label: 'Every hour' },
    { value: '0 2 * * *', label: 'Daily at 2:00 AM' },
    { value: '0 1 * * 0', label: 'Weekly on Sunday' },
  ];

  const formatJobType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={embedded ? '' : 'p-8'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          {embedded ? (
            <>
              <h3 className="text-lg font-semibold text-slate-200">Job Scheduler</h3>
              <p className="text-slate-400 mt-1">Manage automated health checks and monitoring tasks</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">Scheduled Jobs</h1>
              <p className="text-slate-400 mt-1">Manage automated health checks and monitoring tasks</p>
            </>
          )}
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Create New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-200">Create New Scheduled Job</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateJob}>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-slate-300">Job Name *</Label>
                  <Input 
                    placeholder="e.g., Daily Health Check" 
                    className="bg-slate-950 border-slate-800 text-slate-300 placeholder:text-slate-500"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Check Type *</Label>
                  <Select value={jobType} onValueChange={setJobType}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      <SelectItem value="PING">Ping</SelectItem>
                      <SelectItem value="REGISTRY_CHECK">Registry Check</SelectItem>
                      <SelectItem value="FILE_CHECK">File Check</SelectItem>
                      <SelectItem value="USER_INFO">User Info</SelectItem>
                      <SelectItem value="SYSTEM_INFO">System Info</SelectItem>
                    <SelectItem value="BASELINE_CHECK">Everything Else (System + Registry + File)</SelectItem>
                      <SelectItem value="FULL_CHECK">Full Check (All)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Target Machines *</Label>
                  <Select value={targetAll ? 'all' : 'specific'} onValueChange={(v) => setTargetAll(v === 'all')}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      <SelectItem value="all">All Machines</SelectItem>
                      <SelectItem value="specific">Specific Machines</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Schedule Preset</Label>
                  <Select value={cronExpression} onValueChange={setCronExpression}>
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      {cronPresets.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Cron Expression *</Label>
                  <Input 
                    placeholder="*/5 * * * *" 
                    className="bg-slate-950 border-slate-800 font-mono text-slate-300 placeholder:text-slate-500"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">Use standard cron syntax: minute hour day month weekday</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-700 text-slate-300">
                  Cancel
                </Button>
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                  Create Job
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recommended 3-cadence setup */}
      {embedded && (
        <Card className="bg-slate-900 border-slate-800 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Cadence setup (recommended)</h4>
              <p className="text-xs text-slate-400 mt-1">
                Configure three independent schedules: <span className="text-slate-200">Ping</span>,{' '}
                <span className="text-slate-200">Logged-in user</span>, and <span className="text-slate-200">Everything else</span>.
              </p>
            </div>
            <Button
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={applyAppCadences}
              disabled={appCadenceSaving}
            >
              Apply
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-200">Ping</div>
                <Switch checked={pingEnabled} onCheckedChange={setPingEnabled} className="data-[state=checked]:bg-cyan-600" />
              </div>
              <div className="mt-3 space-y-2">
                <Label className="text-xs text-slate-400">Cron</Label>
                <Input
                  value={pingCadence}
                  onChange={(e) => setPingCadence(e.target.value)}
                  className="bg-slate-900 border-slate-800 font-mono text-slate-200"
                />
              </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-200">Logged-in user</div>
                <Switch checked={userEnabled} onCheckedChange={setUserEnabled} className="data-[state=checked]:bg-cyan-600" />
              </div>
              <div className="mt-3 space-y-2">
                <Label className="text-xs text-slate-400">Cron</Label>
                <Input
                  value={userCadence}
                  onChange={(e) => setUserCadence(e.target.value)}
                  className="bg-slate-900 border-slate-800 font-mono text-slate-200"
                />
              </div>
            </div>

            <div className="rounded border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-200">Everything else</div>
                <Switch checked={baselineEnabled} onCheckedChange={setBaselineEnabled} className="data-[state=checked]:bg-cyan-600" />
              </div>
              <div className="mt-3 space-y-2">
                <Label className="text-xs text-slate-400">Cron</Label>
                <Input
                  value={baselineCadence}
                  onChange={(e) => setBaselineCadence(e.target.value)}
                  className="bg-slate-900 border-slate-800 font-mono text-slate-200"
                />
                <div className="text-[11px] text-slate-500">
                  Runs: System checks + Registry checks + File checks (no Ping/User)
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Jobs Table */}
      <Card className="bg-slate-900 border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left p-4 text-sm font-medium text-slate-400">Job Name</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Schedule</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Last Run</th>
                <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No scheduled jobs yet. Click "Create New Job" to get started.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span className="font-medium text-slate-200">{job.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300">
                        {formatJobType(job.jobType)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="text-xs text-slate-500 font-mono">{job.cronExpression}</div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-400">
                      {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="p-4">
                      <Switch
                        checked={job.isActive}
                        onCheckedChange={() => toggleJob(job.id, job.isActive)}
                        className="data-[state=checked]:bg-cyan-600"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runJobNow(job.id, job.name)}
                          className="hover:bg-slate-800 text-slate-300"
                          title="Run Now"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="hover:bg-red-500/10 text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteJob(job.id, job.name)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Cron Helper */}
      <Card className="bg-slate-900 border-slate-800 p-6 mt-6">
        <h3 className="font-semibold mb-4">Cron Expression Quick Reference</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-slate-950 rounded border border-slate-800">
            <div className="font-mono text-cyan-400 mb-1">*/5 * * * *</div>
            <div className="text-slate-400">Every 5 minutes</div>
          </div>
          <div className="p-3 bg-slate-950 rounded border border-slate-800">
            <div className="font-mono text-cyan-400 mb-1">0 2 * * *</div>
            <div className="text-slate-400">Daily at 2:00 AM</div>
          </div>
          <div className="p-3 bg-slate-950 rounded border border-slate-800">
            <div className="font-mono text-cyan-400 mb-1">0 */4 * * *</div>
            <div className="text-slate-400">Every 4 hours</div>
          </div>
          <div className="p-3 bg-slate-950 rounded border border-slate-800">
            <div className="font-mono text-cyan-400 mb-1">0 1 * * 0</div>
            <div className="text-slate-400">Sunday at 1:00 AM</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
