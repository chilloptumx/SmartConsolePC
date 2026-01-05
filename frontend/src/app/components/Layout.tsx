import { Outlet, NavLink } from 'react-router-dom';
import { Monitor, Settings, Database, Activity, PcCase, ListChecks, Zap } from 'lucide-react';

export function Layout() {
  const navItems = [
    { to: '/dashboard', icon: Activity, label: 'Dashboard' },
    { to: '/configuration', icon: Settings, label: 'Configuration' },
    { to: '/data-viewer', icon: Database, label: 'Data Viewer' },
    { to: '/pc-viewer', icon: PcCase, label: 'PC Viewer' },
    { to: '/job-monitor', icon: ListChecks, label: 'Job Monitor' },
    { to: '/adhoc-scan', icon: Zap, label: 'AdHoc Scan' },
  ];

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
              <Monitor className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Smart Console</h1>
              <p className="text-xs text-slate-400">PC Health Monitor</p>
            </div>
          </div>
        </div>

        <nav className="px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-900">
          <div className="text-xs text-slate-500">
            <p>Version 2.1.0</p>
            <p className="text-slate-600">2026 TUCE Grown</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
