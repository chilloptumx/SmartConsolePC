import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

// Read-only settings endpoints (safe for UI)
router.get('/smtp', async (req, res) => {
  const smtp = config.smtp || ({} as any);
  res.json({
    source: 'env',
    configured: Boolean(smtp.host && smtp.user && smtp.password && smtp.from),
    host: smtp.host || '',
    port: smtp.port || 587,
    user: smtp.user || '',
    from: smtp.from || '',
    passwordSet: Boolean(smtp.password),
  });
});

router.get('/checks', async (req, res) => {
  // These are "built-in" checks (not DB-defined like registry/file checks).
  // Today they are intentionally minimal and largely controlled by the WinRM execution layer.
  res.json({
    source: 'code+env',
    windowsExecution: {
      adminUser: config.windows.adminUser || '',
      adminPasswordSet: Boolean(config.windows.adminPassword),
      connectionTimeoutMs: config.windows.connectionTimeout,
      maxRetries: config.windows.maxRetries,
    },
    ping: {
      checkType: 'PING',
      mode: 'winrm-exec',
      description:
        'PING currently verifies WinRM remote execution works (not ICMP). If WinRM succeeds, the machine is considered reachable.',
      effectiveTimeoutMs: config.windows.connectionTimeout,
      outputShape: ['reachable', 'computerName', 'timestamp'],
    },
    userInfo: {
      checkType: 'USER_INFO',
      description: 'Collects current session users (quser) and last logged on user (registry).',
      outputShape: ['currentUser', 'lastUser'],
    },
    systemInfo: {
      checkType: 'SYSTEM_INFO',
      description: 'Collects basic system + OS details via Get-CimInstance.',
      outputShape: [
        'ComputerName',
        'Manufacturer',
        'Model',
        'TotalMemoryGB',
        'OSVersion',
        'OSArchitecture',
        'LastBootTime',
        'UptimeDays',
      ],
    },
    notes: [
      'Schedules for these checks are configured under Scheduling.',
      'Registry/File checks are configured under Configuration tabs and run dynamically.',
    ],
  });
});

export default router;


