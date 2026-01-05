import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Server, FileText, FolderKey, Mail, Clock, User, Monitor, Activity, KeyRound, Database, Eye, EyeOff, MapPin } from 'lucide-react';
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
  const [userChecks, setUserChecks] = useState<any[]>([]);
  const [systemChecks, setSystemChecks] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [smtp, setSmtp] = useState<any | null>(null);
  const [builtIn, setBuiltIn] = useState<any | null>(null);
  const [scanAuth, setScanAuth] = useState<any | null>(null);
  const [dbInfo, setDbInfo] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get('tab') || 'machines');

  // Machine form state
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [machineName, setMachineName] = useState('');
  const [machineIP, setMachineIP] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);

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

  // User check form state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userCheckType, setUserCheckType] = useState('CURRENT_AND_LAST');
  const [userCustomScript, setUserCustomScript] = useState('');
  const [userDesc, setUserDesc] = useState('');
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserCheckType, setEditUserCheckType] = useState('CURRENT_AND_LAST');
  const [editUserCustomScript, setEditUserCustomScript] = useState('');
  const [editUserDesc, setEditUserDesc] = useState('');

  // System check form state
  const [isAddSystemOpen, setIsAddSystemOpen] = useState(false);
  const [systemName, setSystemName] = useState('');
  const [systemCheckType, setSystemCheckType] = useState('SYSTEM_INFO');
  const [systemCustomScript, setSystemCustomScript] = useState('');
  const [systemDesc, setSystemDesc] = useState('');
  const [isEditSystemOpen, setIsEditSystemOpen] = useState(false);
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [editSystemName, setEditSystemName] = useState('');
  const [editSystemCheckType, setEditSystemCheckType] = useState('SYSTEM_INFO');
  const [editSystemCustomScript, setEditSystemCustomScript] = useState('');
  const [editSystemDesc, setEditSystemDesc] = useState('');

  // Scan authentication form state (WinRM)
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authTransport, setAuthTransport] = useState('ntlm');
  const [authUseHttps, setAuthUseHttps] = useState(false);
  const [authPort, setAuthPort] = useState(5985);
  const [isSavingAuth, setIsSavingAuth] = useState(false);

  // Database purge state
  const [isPurgingDb, setIsPurgingDb] = useState(false);
  const [lastPurgeResult, setLastPurgeResult] = useState<any | null>(null);

  // Location form state
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocationName, setEditLocationName] = useState('');

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
      const [machinesData, registryData, fileData, userData, systemData, locationsData, smtpData, builtInData, authData, dbData] = await Promise.all([
        api.getMachines(),
        api.getRegistryChecks(),
        api.getFileChecks(),
        api.getUserChecks(),
        api.getSystemChecks(),
        api.getLocations().catch(() => []),
        api.getSmtpSettings().catch(() => null),
        api.getBuiltInCheckSettings().catch(() => null),
        api.getScanAuthSettings().catch(() => null),
        api.getDatabaseSettings().catch(() => null),
      ]);
      setMachines(machinesData);
      setRegistryChecks(registryData);
      setFileChecks(fileData);
      setUserChecks(userData);
      setSystemChecks(systemData);
      setLocations(locationsData);
      setSmtp(smtpData);
      setBuiltIn(builtInData);
      setScanAuth(authData);
      setDbInfo(dbData);

      // Initialize auth editor from DB values (password is never populated into the form)
      if (authData?.db) {
        setAuthEnabled(Boolean(authData.db.enabled));
        setAuthUsername(authData.db.username ?? '');
        setAuthTransport(authData.db.transport ?? 'ntlm');
        setAuthUseHttps(Boolean(authData.db.useHttps));
        setAuthPort(authData.db.port ?? (authData.db.useHttps ? 5986 : 5985));
        setAuthPassword('');
      }
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

  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      toast.error('Please select a file');
      return;
    }

    setIsBulkImporting(true);
    try {
      const text = await bulkImportFile.text();
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length === 0) {
        toast.error('File is empty or contains no valid entries');
        setIsBulkImporting(false);
        return;
      }

      let added = 0;
      let skipped = 0;
      let errors = 0;

      for (const line of lines) {
        // Parse line - expecting format: "hostname" or "hostname,ip" or "hostname,ip,model"
        const parts = line.split(',').map(p => p.trim());
        const hostname = parts[0];
        const ipAddress = parts[1] || hostname; // Use hostname as IP if not provided
        const pcModel = parts[2] || undefined;

        if (!hostname) {
          errors++;
          continue;
        }

        // Check if machine already exists
        const exists = machines.some(m => m.hostname.toLowerCase() === hostname.toLowerCase());
        if (exists) {
          skipped++;
          continue;
        }

        try {
          await api.createMachine({
            hostname,
            ipAddress,
            pcModel
          });
          added++;
        } catch (error) {
          errors++;
        }
      }

      // Show results
      const messages = [];
      if (added > 0) messages.push(`${added} PC${added !== 1 ? 's' : ''} added`);
      if (skipped > 0) messages.push(`${skipped} skipped (already exists)`);
      if (errors > 0) messages.push(`${errors} error${errors !== 1 ? 's' : ''}`);

      if (added > 0) {
        toast.success(messages.join(', '));
      } else if (skipped > 0 && errors === 0) {
        toast.info(messages.join(', '));
      } else {
        toast.warning(messages.join(', '));
      }

      setIsBulkImportOpen(false);
      setBulkImportFile(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process file');
    } finally {
      setIsBulkImporting(false);
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

  // User Check Handlers
  const handleAddUserCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUserCheck({
        name: userName,
        checkType: userCheckType,
        customScript: userCustomScript || null,
        description: userDesc || null,
      });
      toast.success('User check added');
      setIsAddUserOpen(false);
      setUserName('');
      setUserCheckType('CURRENT_AND_LAST');
      setUserCustomScript('');
      setUserDesc('');
      loadData();
    } catch (error) {
      toast.error('Failed to add user check');
    }
  };

  const handleDeleteUserCheck = async (id: string, name: string) => {
    if (!confirm(`Delete user check "${name}"?`)) return;
    try {
      await api.deleteUserCheck(id);
      toast.success('User check deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete user check');
    }
  };

  const resetEditUser = () => {
    setEditingUserId(null);
    setEditUserName('');
    setEditUserCheckType('CURRENT_AND_LAST');
    setEditUserCustomScript('');
    setEditUserDesc('');
  };

  const openEditUser = (check: any) => {
    setEditingUserId(check.id);
    setEditUserName(check.name ?? '');
    setEditUserCheckType(check.checkType ?? 'CURRENT_AND_LAST');
    setEditUserCustomScript(check.customScript ?? '');
    setEditUserDesc(check.description ?? '');
    setIsEditUserOpen(true);
  };

  const handleUpdateUserCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    try {
      await api.updateUserCheck(editingUserId, {
        name: editUserName,
        checkType: editUserCheckType,
        customScript: editUserCustomScript || null,
        description: editUserDesc || null,
      });
      toast.success('User check updated');
      setIsEditUserOpen(false);
      resetEditUser();
      loadData();
    } catch (error) {
      toast.error('Failed to update user check');
    }
  };

  const toggleUserCheckActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.updateUserCheck(id, { isActive: !currentStatus });
      toast.success(`User check ${!currentStatus ? 'enabled' : 'disabled'}`);
      loadData();
    } catch (error) {
      toast.error('Failed to update user check');
    }
  };

  // System Check Handlers
  const handleAddSystemCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSystemCheck({
        name: systemName,
        checkType: systemCheckType,
        customScript: systemCustomScript || null,
        description: systemDesc || null,
      });
      toast.success('System check added');
      setIsAddSystemOpen(false);
      setSystemName('');
      setSystemCheckType('SYSTEM_INFO');
      setSystemCustomScript('');
      setSystemDesc('');
      loadData();
    } catch (error) {
      toast.error('Failed to add system check');
    }
  };

  const handleDeleteSystemCheck = async (id: string, name: string) => {
    if (!confirm(`Delete system check "${name}"?`)) return;
    try {
      await api.deleteSystemCheck(id);
      toast.success('System check deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete system check');
    }
  };

  const resetEditSystem = () => {
    setEditingSystemId(null);
    setEditSystemName('');
    setEditSystemCheckType('SYSTEM_INFO');
    setEditSystemCustomScript('');
    setEditSystemDesc('');
  };

  const openEditSystem = (check: any) => {
    setEditingSystemId(check.id);
    setEditSystemName(check.name ?? '');
    setEditSystemCheckType(check.checkType ?? 'SYSTEM_INFO');
    setEditSystemCustomScript(check.customScript ?? '');
    setEditSystemDesc(check.description ?? '');
    setIsEditSystemOpen(true);
  };

  const handleUpdateSystemCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSystemId) return;
    try {
      await api.updateSystemCheck(editingSystemId, {
        name: editSystemName,
        checkType: editSystemCheckType,
        customScript: editSystemCustomScript || null,
        description: editSystemDesc || null,
      });
      toast.success('System check updated');
      setIsEditSystemOpen(false);
      resetEditSystem();
      loadData();
    } catch (error) {
      toast.error('Failed to update system check');
    }
  };

  const toggleSystemCheckActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.updateSystemCheck(id, { isActive: !currentStatus });
      toast.success(`System check ${!currentStatus ? 'enabled' : 'disabled'}`);
      loadData();
    } catch (error) {
      toast.error('Failed to update system check');
    }
  };

  const handleSaveScanAuth = async () => {
    setIsSavingAuth(true);
    try {
      const payload: any = {
        enabled: authEnabled,
        username: authUsername,
        transport: authTransport,
        useHttps: authUseHttps,
        port: authPort,
      };
      if (authPassword !== '') payload.password = authPassword;

      await api.updateScanAuthSettings(payload);
      toast.success('Scan authentication updated');
      setAuthPassword('');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update scan authentication');
    } finally {
      setIsSavingAuth(false);
    }
  };

  const handleClearScanAuthPassword = async () => {
    if (!confirm('Clear the stored scan password?')) return;
    setIsSavingAuth(true);
    try {
      await api.updateScanAuthSettings({ clearPassword: true });
      toast.success('Stored scan password cleared');
      setAuthPassword('');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to clear password');
    } finally {
      setIsSavingAuth(false);
    }
  };

  const runDatabasePurge = async (days: number | null) => {
    const label = days === null ? 'purge ALL runtime data' : `purge runtime data older than ${days} days`;
    if (!confirm(`Are you sure you want to ${label}?\n\nThis deletes check results + audit log history, but keeps configuration.`)) return;
    setIsPurgingDb(true);
    try {
      const result = await api.purgeDatabaseData({ confirm: true, ...(days === null ? {} : { days }) });
      setLastPurgeResult(result);
      toast.success(
        days === null
          ? `Purged all runtime data (results: ${result.deleted?.checkResults ?? 0}, audit: ${result.deleted?.auditEvents ?? 0})`
          : `Purged older than ${days} days (results: ${result.deleted?.checkResults ?? 0}, audit: ${result.deleted?.auditEvents ?? 0})`
      );
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to purge database data');
    } finally {
      setIsPurgingDb(false);
    }
  };

  // Location handlers
  const resetEditLocation = () => {
    setEditingLocationId(null);
    setEditLocationName('');
  };

  const openEditLocation = (loc: any) => {
    setEditingLocationId(loc.id);
    setEditLocationName(loc.name ?? '');
    setIsEditLocationOpen(true);
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLocation({
        name: locationName,
      });
      toast.success('Location created');
      setIsAddLocationOpen(false);
      setLocationName('');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create location');
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocationId) return;
    try {
      await api.updateLocation(editingLocationId, {
        name: editLocationName,
      });
      toast.success('Location updated');
      setIsEditLocationOpen(false);
      resetEditLocation();
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update location');
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!confirm(`Delete location "${name}"?`)) return;
    try {
      await api.deleteLocation(id);
      toast.success('Location deleted');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete location');
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
        className="space-y-6 lg:space-y-0 lg:flex lg:items-start lg:gap-6"
      >
        <TabsList className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col items-stretch gap-1 lg:w-72 lg:sticky lg:top-6">
          <div role="presentation" className="px-2 pt-1 pb-1 text-[11px] uppercase tracking-wider text-slate-500">
            Collected data (objects)
          </div>
          <TabsTrigger
            value="registry"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <FolderKey className="w-4 h-4 mr-2" />
            Registry Checks
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <FileText className="w-4 h-4 mr-2" />
            File Checks
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <User className="w-4 h-4 mr-2" />
            User Checks
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Monitor className="w-4 h-4 mr-2" />
            System Checks
          </TabsTrigger>

          <div role="presentation" className="mt-3 px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500 border-t border-slate-800">
            Machines
          </div>
          <TabsTrigger
            value="machines"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Server className="w-4 h-4 mr-2" />
            PC List
          </TabsTrigger>
          <TabsTrigger
            value="locations"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Define Locations
          </TabsTrigger>

          <div role="presentation" className="mt-3 px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500 border-t border-slate-800">
            Automation (cadence)
          </div>
          <TabsTrigger
            value="job-scheduler"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Clock className="w-4 h-4 mr-2" />
            Job Scheduler
          </TabsTrigger>
          <TabsTrigger
            value="email-reports"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Mail className="w-4 h-4 mr-2" />
            Report Scheduler
          </TabsTrigger>
          <TabsTrigger
            value="ping"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Activity className="w-4 h-4 mr-2" />
            Ping Configuration
          </TabsTrigger>

          <div role="presentation" className="mt-3 px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500 border-t border-slate-800">
            Integrations
          </div>
          <TabsTrigger
            value="smtp"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Mail className="w-4 h-4 mr-2" />
            SMTP
          </TabsTrigger>

          <div role="presentation" className="mt-3 px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500 border-t border-slate-800">
            Security
          </div>
          <TabsTrigger
            value="auth"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <KeyRound className="w-4 h-4 mr-2" />
            Authentication
          </TabsTrigger>

          <div role="presentation" className="mt-3 px-2 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500 border-t border-slate-800">
            Platform
          </div>
          <TabsTrigger
            value="database"
            className="w-full justify-start data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300 hover:bg-slate-800"
          >
            <Database className="w-4 h-4 mr-2" />
            Database
          </TabsTrigger>
        </TabsList>

        <div className="lg:flex-1 space-y-6">

          {/* PC List Tab */}
          <TabsContent value="machines">
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-200">Monitored Machines</h3>
                <div className="flex gap-2">
                  <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
                    <Button 
                      onClick={() => setIsBulkImportOpen(true)} 
                      variant="outline"
                      className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Bulk Import
                    </Button>
                    <DialogContent className="bg-slate-900 border-slate-800">
                      <DialogHeader>
                        <DialogTitle className="text-slate-200">Bulk Import PCs from File</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label className="text-slate-300">Select Text File</Label>
                          <p className="text-xs text-slate-400 mt-1 mb-3">
                            Upload a .txt file with one PC per line. Format options:
                          </p>
                          <ul className="text-xs text-slate-400 mb-3 ml-4 space-y-1">
                            <li>• <span className="font-mono text-slate-300">hostname</span> (uses hostname as IP)</li>
                            <li>• <span className="font-mono text-slate-300">hostname,ip_address</span></li>
                            <li>• <span className="font-mono text-slate-300">hostname,ip_address,model</span></li>
                          </ul>
                          <Input
                            type="file"
                            accept=".txt"
                            className="bg-slate-950 border-slate-800"
                            onChange={(e) => setBulkImportFile(e.target.files?.[0] || null)}
                          />
                          {bulkImportFile && (
                            <p className="text-sm text-emerald-400 mt-2">
                              Selected: {bulkImportFile.name}
                            </p>
                          )}
                        </div>
                        <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3">
                          <p className="text-xs text-amber-200">
                            <strong>Note:</strong> PCs that already exist will be skipped automatically.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setIsBulkImportOpen(false);
                            setBulkImportFile(null);
                          }} 
                          className="border-slate-700"
                          disabled={isBulkImporting}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleBulkImport}
                          className="bg-cyan-600 hover:bg-cyan-700"
                          disabled={!bulkImportFile || isBulkImporting}
                        >
                          {isBulkImporting ? 'Importing...' : 'Import'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-200 font-mono">{machine.hostname}</div>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] border ${
                              machine.location?.name
                                ? 'bg-slate-800 text-slate-200 border-slate-700'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}
                            title="Location"
                          >
                            {machine.location?.name || 'Undefined'}
                          </span>
                        </div>
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

        {/* User Checks Tab */}
          <TabsContent value="users">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">User Checks</h3>
              <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <Button onClick={() => setIsAddUserOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add User Check
                </Button>
                <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-200">Add User Check</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddUserCheck}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-slate-300">Check Name *</Label>
                        <Input
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-slate-200"
                          placeholder="e.g., Current and Last User"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Check Type</Label>
                        <select
                          value={userCheckType}
                          onChange={(e) => setUserCheckType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200"
                        >
                          <option value="CURRENT_AND_LAST">Current and Last User</option>
                          <option value="CURRENT_ONLY">Current User Only</option>
                          <option value="LAST_ONLY">Last User Only</option>
                          <option value="CUSTOM">Custom Script</option>
                        </select>
                      </div>
                      {userCheckType === 'CUSTOM' && (
                        <div>
                          <Label className="text-slate-300">Custom PowerShell Script</Label>
                          <Textarea
                            value={userCustomScript}
                            onChange={(e) => setUserCustomScript(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-slate-200 font-mono text-sm"
                            rows={6}
                            placeholder="Enter PowerShell script..."
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-slate-300">Description</Label>
                        <Textarea
                          value={userDesc}
                          onChange={(e) => setUserDesc(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-slate-200"
                          rows={2}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">Add Check</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {userChecks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No user checks configured. Add one to get started.
                </div>
              ) : (
                userChecks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between p-4 bg-slate-950 rounded border border-slate-800">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium text-slate-200">{check.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs ${check.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                          {check.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                          {check.checkType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {check.description && (
                        <p className="text-sm text-slate-400 mt-1">{check.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUserCheckActive(check.id, check.isActive)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        {check.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditUser(check)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUserCheck(check.id, check.name)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Edit User Check Dialog */}
          <Dialog open={isEditUserOpen} onOpenChange={(open) => { setIsEditUserOpen(open); if (!open) resetEditUser(); }}>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-slate-200">Edit User Check</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateUserCheck}>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-slate-300">Check Name *</Label>
                    <Input
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Check Type</Label>
                    <select
                      value={editUserCheckType}
                      onChange={(e) => setEditUserCheckType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200"
                    >
                      <option value="CURRENT_AND_LAST">Current and Last User</option>
                      <option value="CURRENT_ONLY">Current User Only</option>
                      <option value="LAST_ONLY">Last User Only</option>
                      <option value="CUSTOM">Custom Script</option>
                    </select>
                  </div>
                  {editUserCheckType === 'CUSTOM' && (
                    <div>
                      <Label className="text-slate-300">Custom PowerShell Script</Label>
                      <Textarea
                        value={editUserCustomScript}
                        onChange={(e) => setEditUserCustomScript(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-200 font-mono text-sm"
                        rows={6}
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-slate-300">Description</Label>
                    <Textarea
                      value={editUserDesc}
                      onChange={(e) => setEditUserDesc(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">Update Check</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </TabsContent>

        {/* System Checks Tab */}
          <TabsContent value="system">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">System Checks</h3>
              <Dialog open={isAddSystemOpen} onOpenChange={setIsAddSystemOpen}>
                <Button onClick={() => setIsAddSystemOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add System Check
                </Button>
                <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-200">Add System Check</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddSystemCheck}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-slate-300">Check Name *</Label>
                        <Input
                          value={systemName}
                          onChange={(e) => setSystemName(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-slate-200"
                          placeholder="e.g., System Information"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">Check Type</Label>
                        <select
                          value={systemCheckType}
                          onChange={(e) => setSystemCheckType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200"
                        >
                          <option value="SYSTEM_INFO">System Information</option>
                          <option value="CUSTOM">Custom Script</option>
                        </select>
                      </div>
                      {systemCheckType === 'CUSTOM' && (
                        <div>
                          <Label className="text-slate-300">Custom PowerShell Script</Label>
                          <Textarea
                            value={systemCustomScript}
                            onChange={(e) => setSystemCustomScript(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-slate-200 font-mono text-sm"
                            rows={6}
                            placeholder="Enter PowerShell script..."
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-slate-300">Description</Label>
                        <Textarea
                          value={systemDesc}
                          onChange={(e) => setSystemDesc(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-slate-200"
                          rows={2}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">Add Check</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {systemChecks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No system checks configured. Add one to get started.
                </div>
              ) : (
                systemChecks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between p-4 bg-slate-950 rounded border border-slate-800">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium text-slate-200">{check.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs ${check.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                          {check.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                          {check.checkType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {check.description && (
                        <p className="text-sm text-slate-400 mt-1">{check.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSystemCheckActive(check.id, check.isActive)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        {check.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditSystem(check)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSystemCheck(check.id, check.name)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Edit System Check Dialog */}
          <Dialog open={isEditSystemOpen} onOpenChange={(open) => { setIsEditSystemOpen(open); if (!open) resetEditSystem(); }}>
            <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-slate-200">Edit System Check</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateSystemCheck}>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-slate-300">Check Name *</Label>
                    <Input
                      value={editSystemName}
                      onChange={(e) => setEditSystemName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Check Type</Label>
                    <select
                      value={editSystemCheckType}
                      onChange={(e) => setEditSystemCheckType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200"
                    >
                      <option value="SYSTEM_INFO">System Information</option>
                      <option value="CUSTOM">Custom Script</option>
                    </select>
                  </div>
                  {editSystemCheckType === 'CUSTOM' && (
                    <div>
                      <Label className="text-slate-300">Custom PowerShell Script</Label>
                      <Textarea
                        value={editSystemCustomScript}
                        onChange={(e) => setEditSystemCustomScript(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-200 font-mono text-sm"
                        rows={6}
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-slate-300">Description</Label>
                    <Textarea
                      value={editSystemDesc}
                      onChange={(e) => setEditSystemDesc(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">Update Check</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </TabsContent>

        {/* Report Scheduler Tab */}
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

        {/* Ping Configuration Tab */}
          <TabsContent value="ping">
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
          </TabsContent>

        {/* SMTP Configuration Tab */}
          <TabsContent value="smtp">
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
          </TabsContent>

        {/* Authentication Tab */}
          <TabsContent value="auth">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-200">Scan Authentication</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Credentials used for WinRM PowerShell execution during scans.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Effective Source</div>
                <div className="inline-flex items-center rounded px-2 py-1 text-xs bg-slate-800 text-slate-200">
                  {scanAuth?.effective?.source || '—'}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-medium text-slate-200">Effective Authentication</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Username</span>
                    <span className="text-slate-200 font-mono">{scanAuth?.effective?.username || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Password</span>
                    <span className="text-slate-200 font-mono">
                      {scanAuth?.effective?.passwordSet ? '********' : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Transport</span>
                    <span className="text-slate-200 font-mono">{scanAuth?.effective?.transport || 'ntlm'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Endpoint</span>
                    <span className="text-slate-200 font-mono">{scanAuth?.effective?.endpointTemplate || '—'}</span>
                  </div>
                </div>

                <div className="mt-4 rounded border border-slate-800 bg-slate-900/40 p-3">
                  <div className="text-xs text-slate-400">Environment (fallback)</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">WINDOWS_ADMIN_USER</span>
                      <span className="text-slate-200 font-mono">{scanAuth?.env?.username || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">WINDOWS_ADMIN_PASSWORD</span>
                      <span className="text-slate-200 font-mono">{scanAuth?.env?.passwordSet ? '********' : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-200">Database Override</div>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <Checkbox checked={authEnabled} onCheckedChange={(v) => setAuthEnabled(v === true)} />
                    Enable override
                  </label>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="text-slate-300">Username</Label>
                    <Input
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200 font-mono"
                      placeholder="DOMAIN\\username or username"
                      disabled={!authEnabled}
                    />
                  </div>

                  <div>
                    <Label className="text-slate-300">Password</Label>
                    <div className="relative">
                      <Input
                        type={showAuthPassword ? 'text' : 'password'}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-200 font-mono pr-10"
                        placeholder={scanAuth?.db?.passwordSet ? 'Leave blank to keep existing' : 'Enter password'}
                        disabled={!authEnabled}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 disabled:opacity-50"
                        onClick={() => setShowAuthPassword((v) => !v)}
                        disabled={!authEnabled}
                        aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                      >
                        {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Stored password: {scanAuth?.db?.passwordSet ? 'set' : 'not set'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300">Transport</Label>
                      <select
                        value={authTransport}
                        onChange={(e) => setAuthTransport(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200"
                        disabled={!authEnabled}
                      >
                        <option value="ntlm">NTLM</option>
                        <option value="kerberos">Kerberos</option>
                        <option value="credssp">CredSSP</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-slate-300">Port</Label>
                      <Input
                        type="number"
                        value={authPort}
                        onChange={(e) => setAuthPort(parseInt(e.target.value || '0', 10) || 0)}
                        className="bg-slate-950 border-slate-800 text-slate-200 font-mono"
                        disabled={!authEnabled}
                        min={1}
                        max={65535}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <Checkbox checked={authUseHttps} onCheckedChange={(v) => setAuthUseHttps(v === true)} disabled={!authEnabled} />
                    Use HTTPS (typically port 5986)
                  </label>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-950 hover:bg-slate-900 text-red-300 hover:text-red-200"
                      onClick={handleClearScanAuthPassword}
                      disabled={isSavingAuth}
                    >
                      Clear stored password
                    </Button>
                    <Button
                      className="bg-cyan-600 hover:bg-cyan-700"
                      onClick={handleSaveScanAuth}
                      disabled={isSavingAuth}
                    >
                      {isSavingAuth ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-500">
                  Tip: If you prefer env-based credentials, keep override disabled and update
                  <span className="font-mono text-slate-300"> WINDOWS_ADMIN_USER</span> /
                  <span className="font-mono text-slate-300"> WINDOWS_ADMIN_PASSWORD</span> on the backend container.
                </div>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => {
                      const snippet = [
                        '# Windows Machine Credentials (used for PowerShell remoting / WinRM)',
                        'WINDOWS_ADMIN_USER=administrator',
                        'WINDOWS_ADMIN_PASSWORD=your-windows-password',
                        '',
                      ].join('\n');
                      copyText(snippet);
                    }}
                  >
                    Copy .env snippet
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          </TabsContent>

        {/* Database Tab */}
          <TabsContent value="database">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-200">Database</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Information about the PostgreSQL database and tools to purge historical runtime data.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Status</div>
                <div className={`inline-flex items-center rounded px-2 py-1 text-xs ${
                  dbInfo?.connected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'
                }`}>
                  {dbInfo?.connected ? 'Connected' : 'Not connected'}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-medium text-slate-200">Connection</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Provider</span>
                    <span className="text-slate-200 font-mono">{dbInfo?.provider || 'postgresql'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Host</span>
                    <span className="text-slate-200 font-mono">{dbInfo?.host || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Port</span>
                    <span className="text-slate-200 font-mono">{dbInfo?.port ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Database</span>
                    <span className="text-slate-200 font-mono">{dbInfo?.database || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">User</span>
                    <span className="text-slate-200 font-mono">{dbInfo?.user || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Password</span>
                    <span className="text-slate-200 font-mono">{dbInfo?.passwordSet ? '********' : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">Schema</span>
                    <span className="text-slate-200 font-mono">{dbInfo?.schema || 'public'}</span>
                  </div>
                </div>

                <div className="mt-4 rounded border border-slate-800 bg-slate-900/40 p-3">
                  <div className="text-xs text-slate-400">DATABASE_URL (redacted)</div>
                  <div className="mt-2 text-xs text-slate-200 font-mono break-all">
                    {dbInfo?.urlRedacted || '—'}
                  </div>
                  {dbInfo?.connectionError && (
                    <div className="mt-2 text-xs text-amber-200">
                      Connection error: {dbInfo.connectionError}
                    </div>
                  )}
                  {dbInfo?.parseError && (
                    <div className="mt-2 text-xs text-amber-200">
                      Parse error: {dbInfo.parseError}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4">
                  <div className="text-sm font-medium text-slate-200">How to change the database</div>
                  <p className="text-xs text-slate-500 mt-2">
                    This app connects using <span className="font-mono text-slate-300">DATABASE_URL</span> on the <span className="font-mono text-slate-300">backend</span> container.
                    To switch databases, update that env var and restart the backend container.
                  </p>
                  <ul className="mt-3 space-y-2 text-xs text-slate-400">
                    <li>
                      - If you’re using this repo’s <span className="font-mono text-slate-300">docker-compose.yml</span>, set
                      <span className="font-mono text-slate-300"> POSTGRES_PASSWORD</span> (and/or <span className="font-mono text-slate-300">DATABASE_URL</span>) in your project <span className="font-mono text-slate-300">.env</span>.
                    </li>
                    <li>
                      - To use an external Postgres, point <span className="font-mono text-slate-300">DATABASE_URL</span> at a host reachable from the backend container (e.g. <span className="font-mono text-slate-300">host.docker.internal</span> on Windows/macOS).
                    </li>
                    <li>
                      - On startup the backend automatically runs Prisma migrations + seed on the target database.
                    </li>
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                      onClick={() => {
                        const snippet = [
                          '# Use an external Postgres instance (example)',
                          'DATABASE_URL=postgresql://healthcheck:YOUR_PASSWORD@host.docker.internal:5432/healthcheck?schema=public',
                          '',
                        ].join('\n');
                        copyText(snippet);
                      }}
                    >
                      Copy DATABASE_URL example
                    </Button>
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                      onClick={() => {
                        const snippet = [
                          '# Restart backend after changing DATABASE_URL / POSTGRES_PASSWORD',
                          'docker compose up -d --build --force-recreate backend',
                          '',
                        ].join('\n');
                        copyText(snippet);
                      }}
                    >
                      Copy restart command
                    </Button>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Note: If you keep the bundled Postgres service, data persists in the Docker volume. To fully reset local DB data,
                    you can run <span className="font-mono text-slate-300">docker compose down -v</span> (this deletes the volume).
                  </div>
                </div>

                <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-slate-200">Backend container env (redacted)</div>
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                      onClick={() => copyText(dbInfo?.envFileRedacted || '')}
                      disabled={!dbInfo?.envFileRedacted}
                    >
                      Copy env snippet
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    This is a DB-focused view of the backend container’s environment. Sensitive values are masked.
                  </p>
                  <div className="mt-3">
                    <Textarea
                      value={dbInfo?.envFileRedacted || '—'}
                      readOnly
                      rows={8}
                      className="bg-slate-950 border-slate-800 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded border border-slate-800 bg-slate-950 p-4">
                <div className="text-sm font-medium text-slate-200">Purge Runtime Data</div>
                <p className="text-xs text-slate-500 mt-1">
                  Purges delete <span className="font-mono text-slate-300">check_results</span> and <span className="font-mono text-slate-300">audit_events</span>.
                  Your configuration (machines, checks, schedules, reports) is preserved.
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="border-red-500/30 bg-slate-950 hover:bg-red-500/10 text-red-200"
                    onClick={() => runDatabasePurge(null)}
                    disabled={isPurgingDb}
                  >
                    Purge ALL runtime data
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => runDatabasePurge(30)}
                    disabled={isPurgingDb}
                  >
                    Purge &gt; 30 days
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => runDatabasePurge(60)}
                    disabled={isPurgingDb}
                  >
                    Purge &gt; 60 days
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => runDatabasePurge(90)}
                    disabled={isPurgingDb}
                  >
                    Purge &gt; 90 days
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => runDatabasePurge(180)}
                    disabled={isPurgingDb}
                  >
                    Purge &gt; 180 days
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-950 hover:bg-slate-900"
                    onClick={() => loadData()}
                    disabled={loading || isPurgingDb}
                  >
                    Refresh
                  </Button>
                </div>

                {lastPurgeResult && (
                  <div className="mt-4 rounded border border-slate-800 bg-slate-900/40 p-3">
                    <div className="text-xs text-slate-400">Last purge</div>
                    <div className="mt-2 text-xs text-slate-200 font-mono">
                      mode={lastPurgeResult.mode} days={String(lastPurgeResult.days ?? 'all')} cutoff={String(lastPurgeResult.cutoff ?? '—')}
                    </div>
                    <div className="mt-1 text-xs text-slate-300">
                      deleted: results={lastPurgeResult.deleted?.checkResults ?? 0}, audit={lastPurgeResult.deleted?.auditEvents ?? 0}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
          </TabsContent>

        {/* Define Locations Tab */}
          <TabsContent value="locations">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-200">Define Locations</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Create location names, then assign each PC to a location below. PCs without an assigned location show{' '}
                  <span className="font-mono text-slate-300">Undefined</span>.
                </p>
              </div>
              <Dialog open={isAddLocationOpen} onOpenChange={setIsAddLocationOpen}>
                <Button onClick={() => setIsAddLocationOpen(true)} className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                </Button>
                <DialogContent className="bg-slate-900 border-slate-800 max-w-xl">
                  <DialogHeader>
                    <DialogTitle className="text-slate-200">Add Location</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddLocation}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-slate-300">Location Name *</Label>
                        <Input
                          value={locationName}
                          onChange={(e) => setLocationName(e.target.value)}
                          className="bg-slate-950 border-slate-800"
                          placeholder="e.g., HQ, Warehouse, Remote Office"
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsAddLocationOpen(false)} className="border-slate-700">
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                        Create
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Dialog
              open={isEditLocationOpen}
              onOpenChange={(open) => {
                setIsEditLocationOpen(open);
                if (!open) resetEditLocation();
              }}
            >
              <DialogContent className="bg-slate-900 border-slate-800 max-w-xl">
                <DialogHeader>
                  <DialogTitle className="text-slate-200">Edit Location</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateLocation}>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label className="text-slate-300">Location Name *</Label>
                      <Input
                        value={editLocationName}
                        onChange={(e) => setEditLocationName(e.target.value)}
                        className="bg-slate-950 border-slate-800"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsEditLocationOpen(false)} className="border-slate-700">
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" disabled={!editingLocationId}>
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <div className="space-y-2">
              {locations.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No locations defined</div>
              ) : (
                locations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between p-4 bg-slate-950 rounded border border-slate-800">
                    <div className="flex-1">
                      <div className="font-medium text-slate-200">{loc.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditLocation(loc)}
                        className="hover:bg-slate-800 text-slate-300"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        className="hover:bg-red-500/10 text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 border-t border-slate-800 pt-6">
              <h4 className="text-slate-200 font-semibold">Assign locations to PCs</h4>
              <p className="text-sm text-slate-400 mt-1">
                Each PC can be assigned to a single location. Set it to <span className="font-mono text-slate-300">Undefined</span> to clear.
              </p>

              <div className="mt-4 space-y-2">
                {machines.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No PCs configured</div>
                ) : (
                  machines.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-slate-950 rounded border border-slate-800">
                      <div className="min-w-0">
                        <div className="font-mono text-slate-200 truncate">{m.hostname}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{m.ipAddress}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500 whitespace-nowrap">Location</div>
                        <select
                          value={m.location?.id || ''}
                          onChange={async (e) => {
                            const next = e.target.value;
                            try {
                              await api.updateMachine(m.id, { locationId: next || null });
                              toast.success('Location updated');
                              loadData();
                            } catch (err: any) {
                              toast.error(err?.message || 'Failed to update machine location');
                            }
                          }}
                          className="min-w-[220px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200"
                        >
                          <option value="">Undefined</option>
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
