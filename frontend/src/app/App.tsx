import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Configuration } from './pages/Configuration';
import { DataViewer } from './pages/DataViewer';
import { PcViewer } from './pages/PcViewer';
import { JobMonitor } from './pages/JobMonitor';
import { AdHocScan } from './pages/AdHocScan';

export default function App() {
  return (
    <BrowserRouter>
      <div className="dark min-h-screen bg-slate-950 text-slate-100">
        <Toaster position="top-right" theme="dark" />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            {/* Backwards-compatible alias: Scheduling now lives under Configuration tab */}
            <Route path="scheduling" element={<Navigate to="/configuration?tab=job-scheduler" replace />} />
            <Route path="configuration" element={<Configuration />} />
            <Route path="data-viewer" element={<DataViewer />} />
            <Route path="pc-viewer" element={<PcViewer />} />
            {/* Backwards-compatible alias: Email Reports now lives under Configuration tab */}
            <Route path="email-reports" element={<Navigate to="/configuration?tab=email-reports" replace />} />
            {/* Backwards-compatible alias */}
            <Route path="historical-reports" element={<PcViewer />} />
            <Route path="job-monitor" element={<JobMonitor />} />
            <Route path="adhoc-scan" element={<AdHocScan />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}
