import { useState, useEffect } from 'react';
import { Plus, Mail, Trash2, Send } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';
import { api } from '../services/api';

export function EmailReports({ embedded = false }: { embedded?: boolean }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form state
  const [reportName, setReportName] = useState('');
  const [reportSchedule, setReportSchedule] = useState('0 8 * * *'); // Daily at 8 AM
  const [recipients, setRecipients] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await api.getEmailReports();
      setReports(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Failed to load email reports');
    } finally {
      setLoading(false);
    }
  };

  const toggleReport = async (id: string, currentStatus: boolean) => {
    try {
      await api.updateEmailReport(id, { isActive: !currentStatus });
      toast.success('Report status updated');
      loadReports();
    } catch (error) {
      toast.error('Failed to update report');
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reportName || !reportSchedule || !recipients) {
      toast.error('Please fill in all required fields');
      return;
    }

    const recipientList = recipients.split('\n').map(email => email.trim()).filter(email => email);
    
    if (recipientList.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    try {
      // Backend expects a flexible `filterConfig` object plus explicit `columns` to include.
      // Keep this UI simple: allow filtering by type/status, and include a sensible default column set.
      const filterConfig: any = {};
      if (filterType !== 'all') filterConfig.checkTypes = [filterType];
      if (filterStatus !== 'all') filterConfig.status = [filterStatus];

      const columns = [
        'Machine',
        'Location',
        'Check Type',
        'Check Name',
        'Status',
        'Timestamp',
        'Duration',
        'Message',
      ];

      await api.createEmailReport({
        name: reportName,
        schedule: reportSchedule,
        recipients: recipientList,
        filterConfig,
        columns,
      });
      
      toast.success('Email report created successfully');
      setIsCreateOpen(false);
      setReportName('');
      setReportSchedule('0 8 * * *');
      setRecipients('');
      setFilterType('all');
      setFilterStatus('all');
      loadReports();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create email report');
    }
  };

  const handleDeleteReport = async (id: string, name: string) => {
    if (!confirm(`Delete email report "${name}"?`)) return;
    
    try {
      await api.deleteEmailReport(id);
      toast.success('Report deleted');
      loadReports();
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const sendTestEmail = async (id: string, name: string) => {
    try {
      await api.sendTestEmail(id);
      toast.success(`Test email sent for: ${name}`);
    } catch (error) {
      toast.error('Failed to send test email');
    }
  };

  const cronPresets = [
    { value: '*/30 * * * *', label: 'Every 30 minutes' },
    { value: '0 * * * *', label: 'Every hour' },
    { value: '0 8 * * *', label: 'Daily at 8:00 AM' },
    { value: '0 8 * * 1', label: 'Weekly on Monday at 8:00 AM' },
    { value: '0 8 1 * *', label: 'Monthly on the 1st at 8:00 AM' },
    { value: '0 */4 * * *', label: 'Every 4 hours' },
    { value: '0 */12 * * *', label: 'Twice daily (every 12 hours)' },
  ];

  return (
    <div className={embedded ? '' : 'p-8'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          {embedded ? (
            <>
              <h3 className="text-lg font-semibold text-slate-200">Email Reports</h3>
              <p className="text-slate-400 mt-1">Configure automated email reports and notifications</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">Email Reports</h1>
              <p className="text-slate-400 mt-1">Configure automated email reports and notifications</p>
            </>
          )}
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Create New Report
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-100">Create Email Report</DialogTitle>
              <DialogDescription className="text-slate-400">
                Configure an automated email report to be sent on a schedule.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateReport}>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-slate-300">Report Name *</Label>
                  <Input 
                    placeholder="e.g., Daily Health Summary" 
                    className="bg-slate-950 border-slate-800"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Schedule Preset</Label>
                  <Select value={reportSchedule} onValueChange={setReportSchedule}>
                    <SelectTrigger className="bg-slate-950 border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      {cronPresets.map(preset => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Cron Expression *</Label>
                  <Input 
                    placeholder="0 8 * * *" 
                    className="bg-slate-950 border-slate-800 font-mono"
                    value={reportSchedule}
                    onChange={(e) => setReportSchedule(e.target.value)}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Format: minute hour day month weekday
                  </p>
                </div>

                <div>
                  <Label className="text-slate-300">Recipients *</Label>
                  <Textarea
                    placeholder="Enter email addresses (one per line)&#10;admin@company.com&#10;ops@company.com"
                    className="bg-slate-950 border-slate-800 h-24"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter one email address per line
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Filter by Check Type</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="bg-slate-950 border-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="PING">Ping Only</SelectItem>
                        <SelectItem value="REGISTRY_CHECK">Registry Checks Only</SelectItem>
                        <SelectItem value="FILE_CHECK">File Checks Only</SelectItem>
                        <SelectItem value="SERVICE_CHECK">Service Checks Only</SelectItem>
                        <SelectItem value="USER_INFO">User Info Only</SelectItem>
                        <SelectItem value="SYSTEM_INFO">System Info Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Filter by Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="bg-slate-950 border-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="SUCCESS">Success Only</SelectItem>
                        <SelectItem value="WARNING">Warning Only</SelectItem>
                        <SelectItem value="FAILED">Failed Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-700">
                  Cancel
                </Button>
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">
                  Create Report
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports Grid */}
      <div className="grid gap-6">
        {loading ? (
          <Card className="bg-slate-900 border-slate-800 p-8">
            <div className="text-center text-slate-400">Loading...</div>
          </Card>
        ) : reports.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 p-8">
            <div className="text-center text-slate-400">
              No email reports configured. Click "Create New Report" to get started.
            </div>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="bg-slate-900 border-slate-800 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-semibold text-slate-200">{report.name}</h3>
                    <StatusBadge status={report.isActive ? 'success' : 'offline'}>
                      {report.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Schedule:</span>
                      <code className="text-slate-300 bg-slate-950 px-2 py-0.5 rounded font-mono text-xs">
                        {report.schedule}
                      </code>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Recipients:</span>
                      <span className="text-slate-300">
                        {report.recipients?.length || 0} recipient(s)
                      </span>
                    </div>

                    {report.recipients && report.recipients.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {report.recipients.map((recipient: any) => (
                          <span 
                            key={recipient.id} 
                            className="px-2 py-0.5 bg-slate-950 text-slate-400 rounded text-xs"
                          >
                            {recipient.email}
                          </span>
                        ))}
                      </div>
                    )}

                    {report.lastSentAt && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Last sent:</span>
                        <span className="text-slate-400">{new Date(report.lastSentAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={report.isActive}
                    onCheckedChange={() => toggleReport(report.id, report.isActive)}
                    className="data-[state=checked]:bg-cyan-600"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => sendTestEmail(report.id, report.name)}
                    className="hover:bg-slate-800 text-slate-300"
                    title="Send Test Email"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteReport(report.id, report.name)}
                    className="hover:bg-red-500/10 text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

    </div>
  );
}
