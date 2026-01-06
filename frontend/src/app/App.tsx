import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Configuration } from './pages/Configuration';
import { DataViewerHub } from './pages/DataViewerHub';
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
            <Route path="data-viewer" element={<DataViewerHub />} />
            {/* Backwards-compatible alias: Email Reports now lives under Configuration tab */}
            <Route path="email-reports" element={<Navigate to="/configuration?tab=email-reports" replace />} />
            <Route path="adhoc-scan" element={<AdHocScan />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}
