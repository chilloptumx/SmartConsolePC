import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Server, FileText, FolderKey, Settings as SettingsIcon, Mail, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { api } from '../services/api';
import { EmailReports } from './EmailReports';
import { Scheduling } from './Scheduling';

export function Configuration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [machines, setMachines] = useState<any[]>([]);
  const [registryChecks, setRegistryChecks] = useState<any[]>([]);
  const [fileChecks, setFileChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [smtp, setSmtp] = useState<any | null>(null);
  const [builtIn, setBuiltIn] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'machines');

  // Machine form state
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [machineName, setMachineName] = useState('');
  const [machineIP, setMachineIP] = useState('');
  const [machineModel, setMachineModel] = useState('');

  // Registry check form state
  const [isAddRegistryOpen, setIsAddRegistryOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPath, setRegPath] = useState('');
  const [regValueName, setRegValueName] = useState('');
  const [regExpected, setRegExpected] = useState('');
  const [regDesc, setRegDesc] = useState('');
  const [isEditRegistryOpen, setIsEditRegistryOpen] = useState(false);
  const [editingRegistryId, setEditingRegistryId] = useState<string | null>(null);
  const [editRegName, setEditRegName] = useState('');
  const [editRegPath, setEditRegPath] = useState('');
  const [editRegValueName, setEditRegValueName] = useState('');
  const [editRegExpected, setEditRegExpected] = useState('');
  const [editRegDesc, setEditRegDesc] = useState('');

  // File check form state
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [fileCheckExists, setFileCheckExists] = useState(true);
  const [fileCheckSize, setFileCheckSize] = useState(false);
  const [fileCheckCreated, setFileCheckCreated] = useState(false);
  const [fileCheckModified, setFileCheckModified] = useState(false);
  const [fileDesc, setFileDesc] = useState('');
  const [isEditFileOpen, setIsEditFileOpen] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editFilePath, setEditFilePath] = useState('');
  const [editFileCheckExists, setEditFileCheckExists] = useState(true);
  const [editFileCheckSize, setEditFileCheckSize] = useState(false);
  const [editFileCheckCreated, setEditFileCheckCreated] = useState(false);
  const [editFileCheckModified, setEditFileCheckModified] = useState(false);
  const [editFileDesc, setEditFileDesc] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [machinesData, registryData, fileData, smtpData, builtInData] = await Promise.all([
        api.getMachines(),
        api.getRegistryChecks(),
        api.getFileChecks(),
        api.getSmtpSettings().catch(() => null),
        api.getBuiltInCheckSettings().catch(() => null),
      ]);
      setMachines(machinesData);
      setRegistryChecks(registryData);
      setFileChecks(fileData);
      setSmtp(smtpData);
      setBuiltIn(builtInData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      // Fallback for environments without clipboard permissions
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast.success('Copied to clipboard');
    }
  };

  // Machine handlers
  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createMachine({
        hostname: machineName,
        ipAddress: machineIP,
        pcModel: machineModel || undefined
      });
      toast.success('Machine added successfully');
      setIsAddMachineOpen(false);
      setMachineName('');
      setMachineIP('');
      setMachineModel('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add machine');
    }
  };

  const handleDeleteMachine = async (id: string, name: string) => {
    if (!confirm(`Delete machine "${name}"?`)) return;
    try {
      await api.deleteMachine(id);
      toast.success('Machine deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete machine');
    }
  };

  // Registry check handlers
  const handleAddRegistryCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createRegistryCheck({
        name: regName,
        registryPath: regPath,
        valueName: regValueName || undefined,
        expectedValue: regExpected || undefined,
        description: regDesc || undefined
      });
      toast.success('Registry check added');
      setIsAddRegistryOpen(false);
      setRegName('');
      setRegPath('');
      setRegValueName('');
      setRegExpected('');
      setRegDesc('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add registry check');
    }
  };

  const handleDeleteRegistryCheck = async (id: string, name: string) => {
    if (!confirm(`Delete registry check "${name}"?`)) return;
    try {
      await api.deleteRegistryCheck(id);
      toast.success('Registry check deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete registry check');
    }
  };

  const resetEditRegistry = () => {
    setEditingRegistryId(null);
    setEditRegName('');
    setEditRegPath('');
    setEditRegValueName('');
    setEditRegExpected('');
    setEditRegDesc('');
  };

  const openEditRegistry = (check: any) => {
    setEditingRegistryId(check.id);
    setEditRegName(check.name ?? '');
    setEditRegPath(check.registryPath ?? '');
    setEditRegValueName(check.valueName ?? '');
    setEditRegExpected(check.expectedValue ?? '');
    setEditRegDesc(check.description ?? '');
    setIsEditRegistryOpen(true);
  };

  const handleUpdateRegistryCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistryId) return;
    try {
      await api.updateRegistryCheck(editingRegistryId, {
        name: editRegName,
        registryPath: editRegPath,
        valueName: editRegValueName || undefined,
        expectedValue: editRegExpected || undefined,
        description: editRegDesc || undefined,
      });
      toast.success('Registry check updated');
      setIsEditRegistryOpen(false);
      resetEditRegistry();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update registry check');
    }
  };

  // File check handlers
  const handleAddFileCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createFileCheck({
        name: fileName,
        filePath,
        checkExists: fileCheckExists,
        checkSize: fileCheckSize,
        checkCreated: fileCheckCreated,
        checkModified: fileCheckModified,
        description: fileDesc || undefined
      });
      toast.success('File check added');
      setIsAddFileOpen(false);
      setFileName('');
      setFilePath('');
      setFileCheckExists(true);
      setFileCheckSize(false);
      setFileCheckCreated(false);
      setFileCheckModified(false);
      setFileDesc('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add file check');
    }
  };

  const handleDeleteFileCheck = async (id: string, name: string) => {
    if (!confirm(`Delete file check "${name}"?`)) return;
    try {
      await api.deleteFileCheck(id);
      toast.success('File check deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete file check');
    }
  };

  const resetEditFile = () => {
    setEditingFileId(null);
    setEditFileName('');
    setEditFilePath('');
    setEditFileCheckExists(true);
    setEditFileCheckSize(false);
    setEditFileCheckCreated(false);
    setEditFileCheckModified(false);
    setEditFileDesc('');
  };

  const openEditFile = (check: any) => {
    setEditingFileId(check.id);
    setEditFileName(check.name ?? '');
    setEditFilePath(check.filePath ?? '');
    setEditFileCheckExists(Boolean(check.checkExists));
    setEditFileCheckSize(Boolean(check.checkSize));
    setEditFileCheckCreated(Boolean(check.checkCreated));
    setEditFileCheckModified(Boolean(check.checkModified));
    setEditFileDesc(check.description ?? '');
    setIsEditFileOpen(true);
  };

  const handleUpdateFileCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFileId) return;
    try {
      await api.updateFileCheck(editingFileId, {
        name: editFileName,
        filePath: editFilePath,
        checkExists: editFileCheckExists,
        checkSize: editFileCheckSize,
        checkCreated: editFileCheckCreated,
        checkModified: editFileCheckModified,
        description: editFileDesc || undefined,
      });
      toast.success('File check updated');
      setIsEditFileOpen(false);
      resetEditFile();
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update file check');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Configuration</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', v);
            return next;
          });
        }}
        className="space-y-6"
      >
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="machines" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <Server className="w-4 h-4 mr-2" />
            Machines
          </TabsTrigger>
          <TabsTrigger value="registry" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <FolderKey className="w-4 h-4 mr-2" />
            Registry Checks
          </TabsTrigger>
          <TabsTrigger value="files" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <FileText className="w-4 h-4 mr-2" />
            File Checks
          </TabsTrigger>
          <TabsTrigger value="email-reports" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <Mail className="w-4 h-4 mr-2" />
            Email Reports
          </TabsTrigger>
          <TabsTrigger value="job-scheduler" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <Clock className="w-4 h-4 mr-2" />
            Job Scheduler
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Machines Tab */}
        <TabsContent value="machines">
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200">Monitored Machines</h3>
                <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
                  <Button onClick={() => setIsAddMachineOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Machine
                  </Button>
                  <DialogContent className="bg-slate-900 border-slate-800">
                    <DialogHeader>
                      <DialogTitle className="text-slate-200">Add New Machine</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddMachine}>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label className="text-slate-300">Hostname *</Label>
                          <Input 
                            placeholder="e.g., wopr" 
                            className="bg-slate-950 border-slate-800"
                            value={machineName}
                            onChange={(e) => setMachineName(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">IP Address *</Label>
                          <Input 
                            placeholder="e.g., 192.168.6.32" 
                            className="bg-slate-950 border-slate-800 font-mono"
                            value={machineIP}
                            onChange={(e) => setMachineIP(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300">PC Model</Label>
                          <Input 
                            placeholder="e.g., Dell Optiplex HP 7000" 
                            className="bg-slate-950 border-slate-800"
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

              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : machines.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No machines configured</div>
                ) : (
                  machines.map((machine) => (
                    <div key={machine.id} className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="flex-1">
                        <div className="font-medium text-slate-200 font-mono">{machine.hostname}</div>
                        <div className="text-sm text-slate-400 font-mono">{machine.ipAddress}</div>
                        {machine.pcModel && <div className="text-xs text-slate-500 mt-1">{machine.pcModel}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          machine.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400' :
                          machine.status === 'OFFLINE' ? 'bg-slate-500/10 text-slate-400' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {machine.status}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMachine(machine.id, machine.hostname)}
                          className="hover:bg-red-500/10 text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Registry Checks Tab */}
        <TabsContent value="registry">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">Registry Checks</h3>
              <Dialog open={isAddRegistryOpen} onOpenChange={setIsAddRegistryOpen}>
                <Button onClick={() => setIsAddRegistryOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Registry Check
                </Button>
                <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-200">Add Registry Check</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddRegistryCheck}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-slate-300">Check Name *</Label>
                        <Input 
                          placeholder="e.g., Windows Version Check" 
                          className="bg-slate-950 border-slate-800"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Registry Path *</Label>
                        <Input 
                          placeholder="e.g., HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion" 
                          className="bg-slate-950 border-slate-800 font-mono"
                          value={regPath}
                          onChange={(e) => setRegPath(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Value Name</Label>
                        <Input 
                          placeholder="e.g., ProductName (optional)" 
                          className="bg-slate-950 border-slate-800 font-mono"
                          value={regValueName}
                          onChange={(e) => setRegValueName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Expected Value</Label>
                        <Input 
                          placeholder="Optional" 
                          className="bg-slate-950 border-slate-800"
                          value={regExpected}
                          onChange={(e) => setRegExpected(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Description</Label>
                        <Textarea 
                          placeholder="Optional description" 
                          className="bg-slate-950 border-slate-800"
                          value={regDesc}
                          onChange={(e) => setRegDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAddRegistryOpen(false)} className="border-slate-700">
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                        Add Check
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Dialog
              open={isEditRegistryOpen}
              onOpenChange={(open) => {
                setIsEditRegistryOpen(open);
                if (!open) resetEditRegistry();
              }}
            >
              <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-200">Edit Registry Check</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateRegistryCheck}>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label className="text-slate-300">Check Name *</Label>
                      <Input
                        placeholder="e.g., Windows Version Check"
                        className="bg-slate-950 border-slate-800"
                        value={editRegName}
                        onChange={(e) => setEditRegName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Registry Path *</Label>
                      <Input
                        placeholder="e.g., HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion"
                        className="bg-slate-950 border-slate-800 font-mono"
                        value={editRegPath}
                        onChange={(e) => setEditRegPath(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Value Name</Label>
                      <Input
                        placeholder="e.g., ProductName (optional)"
                        className="bg-slate-950 border-slate-800 font-mono"
                        value={editRegValueName}
                        onChange={(e) => setEditRegValueName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Expected Value</Label>
                      <Input
                        placeholder="Optional"
                        className="bg-slate-950 border-slate-800"
                        value={editRegExpected}
                        onChange={(e) => setEditRegExpected(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Description</Label>
                      <Textarea
                        placeholder="Optional description"
                        className="bg-slate-950 border-slate-800"
                        value={editRegDesc}
                        onChange={(e) => setEditRegDesc(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditRegistryOpen(false)}
                      className="border-slate-700"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={!editingRegistryId}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-slate-400">Loading...</div>
              ) : registryChecks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No registry checks configured</div>
              ) : (
                registryChecks.map((check) => (
                  <div key={check.id} className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-200">{check.name}</div>
                        <div className="text-sm text-slate-400 font-mono mt-1">{check.registryPath}</div>
                        {check.valueName && (
                          <div className="text-xs text-slate-500 font-mono mt-1">Value: {check.valueName}</div>
                        )}
                        {check.description && (
                          <div className="text-xs text-slate-500 mt-1">{check.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRegistry(check)}
                          className="hover:bg-slate-800 text-slate-300"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRegistryCheck(check.id, check.name)}
                          className="hover:bg-red-500/10 text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* File Checks Tab */}
        <TabsContent value="files">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">File Checks</h3>
              <Dialog open={isAddFileOpen} onOpenChange={setIsAddFileOpen}>
                <Button onClick={() => setIsAddFileOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add File Check
                </Button>
                <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-200">Add File Check</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddFileCheck}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-slate-300">Check Name *</Label>
                        <Input 
                          placeholder="e.g., Hosts File Check" 
                          className="bg-slate-950 border-slate-800"
                          value={fileName}
                          onChange={(e) => setFileName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">File Path *</Label>
                        <Input 
                          placeholder="e.g., C:\Windows\System32\drivers\etc\hosts" 
                          className="bg-slate-950 border-slate-800 font-mono"
                          value={filePath}
                          onChange={(e) => setFilePath(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300 mb-2 block">What to Check</Label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <Checkbox 
                              checked={fileCheckExists}
                              onCheckedChange={(checked) => setFileCheckExists(checked as boolean)}
                            />
                            <span className="text-sm text-slate-300">Check if file exists</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox 
                              checked={fileCheckSize}
                              onCheckedChange={(checked) => setFileCheckSize(checked as boolean)}
                            />
                            <span className="text-sm text-slate-300">Track file size</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox 
                              checked={fileCheckCreated}
                              onCheckedChange={(checked) => setFileCheckCreated(checked as boolean)}
                            />
                            <span className="text-sm text-slate-300">Track creation date</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox 
                              checked={fileCheckModified}
                              onCheckedChange={(checked) => setFileCheckModified(checked as boolean)}
                            />
                            <span className="text-sm text-slate-300">Track modification date</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <Label className="text-slate-300">Description</Label>
                        <Textarea 
                          placeholder="Optional description" 
                          className="bg-slate-950 border-slate-800"
                          value={fileDesc}
                          onChange={(e) => setFileDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAddFileOpen(false)} className="border-slate-700">
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                        Add Check
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Dialog
              open={isEditFileOpen}
              onOpenChange={(open) => {
                setIsEditFileOpen(open);
                if (!open) resetEditFile();
              }}
            >
              <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-200">Edit File Check</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateFileCheck}>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label className="text-slate-300">Check Name *</Label>
                      <Input
                        placeholder="e.g., Hosts File Check"
                        className="bg-slate-950 border-slate-800"
                        value={editFileName}
                        onChange={(e) => setEditFileName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">File Path *</Label>
                      <Input
                        placeholder="e.g., C:\Windows\System32\drivers\etc\hosts"
                        className="bg-slate-950 border-slate-800 font-mono"
                        value={editFilePath}
                        onChange={(e) => setEditFilePath(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-2 block">What to Check</Label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <Checkbox checked={editFileCheckExists} onCheckedChange={(v) => setEditFileCheckExists(v === true)} />
                          <span className="text-sm text-slate-300">Check if file exists</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox checked={editFileCheckSize} onCheckedChange={(v) => setEditFileCheckSize(v === true)} />
                          <span className="text-sm text-slate-300">Track file size</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox checked={editFileCheckCreated} onCheckedChange={(v) => setEditFileCheckCreated(v === true)} />
                          <span className="text-sm text-slate-300">Track creation date</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox checked={editFileCheckModified} onCheckedChange={(v) => setEditFileCheckModified(v === true)} />
                          <span className="text-sm text-slate-300">Track modification date</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-300">Description</Label>
                      <Textarea
                        placeholder="Optional description"
                        className="bg-slate-950 border-slate-800"
                        value={editFileDesc}
                        onChange={(e) => setEditFileDesc(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditFileOpen(false)}
                      className="border-slate-700"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={!editingFileId}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-slate-400">Loading...</div>
              ) : fileChecks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No file checks configured</div>
              ) : (
                fileChecks.map((check) => (
                  <div key={check.id} className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-200">{check.name}</div>
                        <div className="text-sm text-slate-400 font-mono mt-1">{check.filePath}</div>
                        <div className="flex gap-2 mt-2">
                          {check.checkExists && <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">Exists</span>}
                          {check.checkSize && <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">Size</span>}
                          {check.checkCreated && <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">Created</span>}
                          {check.checkModified && <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">Modified</span>}
                        </div>
                        {check.description && (
                          <div className="text-xs text-slate-500 mt-1">{check.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditFile(check)}
                          className="hover:bg-slate-800 text-slate-300"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFileCheck(check.id, check.name)}
                          className="hover:bg-red-500/10 text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Email Reports Tab */}
        <TabsContent value="email-reports">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <EmailReports embedded />
          </Card>
        </TabsContent>

        {/* Job Scheduler Tab */}
        <TabsContent value="job-scheduler">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <Scheduling embedded />
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-200">SMTP Email Settings</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Email sending is configured via environment variables on the backend container.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Status</div>
                  <div className={`inline-flex items-center rounded px-2 py-1 text-xs ${
                    smtp?.configured ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'
                  }`}>
                    {smtp?.configured ? 'Configured' : 'Not configured'}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm font-medium text-slate-200">Server</div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">SMTP_HOST</span>
                      <span className="text-slate-200 font-mono">{smtp?.host || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">SMTP_PORT</span>
                      <span className="text-slate-200 font-mono">{smtp?.port ?? '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm font-medium text-slate-200">Identity</div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">SMTP_USER</span>
                      <span className="text-slate-200 font-mono">{smtp?.user || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">SMTP_PASSWORD</span>
                      <span className="text-slate-200 font-mono">{smtp?.passwordSet ? '********' : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">SMTP_FROM</span>
                      <span className="text-slate-200 font-mono">{smtp?.from || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  To change SMTP settings, update your `.env` / compose environment and restart the backend container.
                </p>
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                  onClick={() => {
                    const snippet = [
                      'SMTP_HOST=',
                      'SMTP_PORT=587',
                      'SMTP_USER=',
                      'SMTP_PASSWORD=',
                      'SMTP_FROM=',
                      '',
                    ].join('\n');
                    copyText(snippet);
                  }}
                >
                  Copy .env snippet
                </Button>
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-200">Ping Configuration</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Controls how the built-in <span className="font-mono text-slate-300">PING</span> check behaves.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Mode</div>
                  <div className="inline-flex items-center rounded px-2 py-1 text-xs bg-slate-800 text-slate-200">
                    {builtIn?.ping?.mode || '—'}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                <div className="text-slate-400">Description</div>
                <div className="mt-1">{builtIn?.ping?.description || '—'}</div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm font-medium text-slate-200">Effective timeout</div>
                  <div className="mt-2 text-sm text-slate-300">
                    <span className="text-slate-400">WINDOWS_CONNECTION_TIMEOUT</span>{' '}
                    <span className="font-mono text-slate-200">
                      {builtIn?.ping?.effectiveTimeoutMs ?? builtIn?.windowsExecution?.connectionTimeoutMs ?? '—'} ms
                    </span>
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm font-medium text-slate-200">Output fields</div>
                  <div className="mt-2 text-sm text-slate-300 font-mono">
                    {(builtIn?.ping?.outputShape || []).join(', ') || '—'}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Scheduling for PING is configured under Job Scheduler.
                </p>
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                  onClick={() => {
                    const snippet = [
                      '# WinRM execution timeout used by PING (and other checks)',
                      'WINDOWS_CONNECTION_TIMEOUT=30000',
                      '',
                    ].join('\n');
                    copyText(snippet);
                  }}
                >
                  Copy .env snippet
                </Button>
              </div>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-200">User Info Configuration</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Controls the built-in <span className="font-mono text-slate-300">USER_INFO</span> collection.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Check Type</div>
                  <div className="inline-flex items-center rounded px-2 py-1 text-xs bg-slate-800 text-slate-200">
                    USER_INFO
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                <div className="text-slate-400">Description</div>
                <div className="mt-1">{builtIn?.userInfo?.description || '—'}</div>
              </div>

              <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-medium text-slate-200">Output fields</div>
                <div className="mt-2 text-sm text-slate-300 font-mono">
                  {(builtIn?.userInfo?.outputShape || []).join(', ') || '—'}
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Scheduling for USER_INFO is configured under Job Scheduler.
              </p>
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-200">System Info Configuration</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Controls the built-in <span className="font-mono text-slate-300">SYSTEM_INFO</span> collection.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Check Type</div>
                  <div className="inline-flex items-center rounded px-2 py-1 text-xs bg-slate-800 text-slate-200">
                    SYSTEM_INFO
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                <div className="text-slate-400">Description</div>
                <div className="mt-1">{builtIn?.systemInfo?.description || '—'}</div>
              </div>

              <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-medium text-slate-200">Output fields</div>
                <div className="mt-2 text-sm text-slate-300 font-mono">
                  {(builtIn?.systemInfo?.outputShape || []).join(', ') || '—'}
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Scheduling for SYSTEM_INFO is configured under Job Scheduler.
              </p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
