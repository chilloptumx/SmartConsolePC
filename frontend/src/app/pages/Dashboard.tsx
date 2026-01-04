import { RefreshCw, Plus, TrendingUp, TrendingDown, Minus, Settings } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { api } from '../services/api';

export function Dashboard() {
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [isCardConfigOpen, setIsCardConfigOpen] = useState(false);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track which columns to display in the machine status table
  const [displayColumns, setDisplayColumns] = useState({
    ipAddress: true,
    lastSeen: true,
    pcModel: true,
  });

  // Fetch data from API
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [machinesData, resultsData] = await Promise.all([
        api.getMachines(),
        api.getResults({ limit: 5 })
      ]);
      
      setMachines(machinesData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: machines.length,
    online: machines.filter((m) => m.status === 'ONLINE').length,
    offline: machines.filter((m) => m.status === 'OFFLINE').length,
    warnings: machines.filter((m) => m.status === 'WARNING' || m.status === 'ERROR').length,
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
        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Machines</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-semibold text-slate-200">{stats.total}</div>
          <div className="text-xs text-emerald-400 mt-2">+2 this week</div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Online</span>
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
          </div>
          <div className="text-3xl font-semibold text-emerald-400">{stats.online}</div>
          <div className="text-xs text-slate-400 mt-2">{Math.round((stats.online / stats.total) * 100)}% uptime</div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Offline</span>
            <div className="w-2 h-2 bg-slate-400 rounded-full" />
          </div>
          <div className="text-3xl font-semibold text-slate-400">{stats.offline}</div>
          <div className="text-xs text-slate-500 mt-2">Needs attention</div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Warnings</span>
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          </div>
          <div className="text-3xl font-semibold text-amber-400">{stats.warnings}</div>
          <div className="text-xs text-amber-400 mt-2">High resource usage</div>
        </Card>
      </div>

      <div className="space-y-4">
        {/* Machine Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Machine Status</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Last check: 2 mins ago</span>
              <Dialog open={isCardConfigOpen} onOpenChange={setIsCardConfigOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-slate-800 text-slate-400 hover:text-slate-200">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-slate-100">Configure Machine Table Columns</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Choose which columns to display in the machine status table.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <Checkbox 
                          checked={displayColumns.ipAddress}
                          onCheckedChange={(checked) =>
                            setDisplayColumns(prev => ({ ...prev, ipAddress: checked as boolean }))
                          }
                        />
                        <div>
                          <span className="text-sm text-slate-300">IP Address</span>
                          <p className="text-xs text-slate-500">Show machine IP/connection address</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <Checkbox 
                          checked={displayColumns.lastSeen}
                          onCheckedChange={(checked) =>
                            setDisplayColumns(prev => ({ ...prev, lastSeen: checked as boolean }))
                          }
                        />
                        <div>
                          <span className="text-sm text-slate-300">Last Seen</span>
                          <p className="text-xs text-slate-500">Show when the machine last reported in</p>
                        </div>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <Checkbox 
                          checked={displayColumns.pcModel}
                          onCheckedChange={(checked) =>
                            setDisplayColumns(prev => ({ ...prev, pcModel: checked as boolean }))
                          }
                        />
                        <div>
                          <span className="text-sm text-slate-300">Model</span>
                          <p className="text-xs text-slate-500">Show detected hardware model</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={() => {
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
                  <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : machines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No machines added yet. Click "Add Machine" to get started.
                    </td>
                  </tr>
                ) : (
                  machines.map((machine) => (
                    <tr key={machine.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                      <td className="p-4">
                        <Link
                          to={`/pc-viewer?machineId=${encodeURIComponent(machine.id)}`}
                          className="font-mono text-sm text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
                          title="View PC viewer"
                        >
                          {machine.hostname}
                        </Link>
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