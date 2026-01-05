import { Router } from 'express';
import { config } from '../config.js';
import { prisma } from '../services/database.js';
import { logAuditEvent } from '../services/audit.js';

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

type WinRmTransport = 'ntlm' | 'kerberos' | 'credssp';

function normalizeTransport(t: any): WinRmTransport {
  const v = String(t ?? 'ntlm').toLowerCase();
  if (v === 'kerberos') return 'kerberos';
  if (v === 'credssp') return 'credssp';
  return 'ntlm';
}

async function getSettings(keys: string[]) {
  const rows = await prisma.appSettings.findMany({ where: { key: { in: keys } } });
  return rows.reduce((acc, r) => {
    acc[r.key] = r.value;
    return acc;
  }, {} as Record<string, string>);
}

async function upsertSetting(key: string, value: string) {
  await prisma.appSettings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function deleteSetting(key: string) {
  try {
    await prisma.appSettings.delete({ where: { key } });
  } catch {
    // ignore if missing
  }
}

router.get('/auth', async (req, res) => {
  const envAuth = {
    source: 'env' as const,
    username: config.windows.adminUser || '',
    passwordSet: Boolean(config.windows.adminPassword),
    transport: 'ntlm' as WinRmTransport,
    useHttps: false,
    port: 5985,
    endpointTemplate: 'http://{ip}:5985/wsman',
  };

  const m = await getSettings([
    'scanAuth.enabled',
    'scanAuth.username',
    'scanAuth.password',
    'scanAuth.transport',
    'scanAuth.useHttps',
    'scanAuth.port',
  ]);

  const enabled = (m['scanAuth.enabled'] ?? '').toLowerCase() === 'true';
  const dbUsername = m['scanAuth.username'] ?? '';
  const dbPassword = m['scanAuth.password'] ?? '';
  const dbTransport = normalizeTransport(m['scanAuth.transport']);
  const dbUseHttps = (m['scanAuth.useHttps'] ?? '').toLowerCase() === 'true';
  const portRaw = parseInt(m['scanAuth.port'] ?? '', 10);
  const dbPort = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : dbUseHttps ? 5986 : 5985;

  const dbAuth = {
    source: 'db' as const,
    enabled,
    username: dbUsername,
    passwordSet: Boolean(dbPassword),
    transport: dbTransport,
    useHttps: dbUseHttps,
    port: dbPort,
    endpointTemplate: `${dbUseHttps ? 'https' : 'http'}://{ip}:${dbPort}/wsman`,
  };

  const effective = enabled && dbUsername
    ? {
        source: 'db' as const,
        username: dbUsername,
        passwordSet: Boolean(dbPassword),
        transport: dbTransport,
        useHttps: dbUseHttps,
        port: dbPort,
        endpointTemplate: dbAuth.endpointTemplate,
      }
    : envAuth;

  res.json({
    source: 'code+env+db',
    env: envAuth,
    db: dbAuth,
    effective,
    notes: [
      'These credentials are used by the WinRM execution layer for all scans unless you enable a DB override.',
      'Passwords are never returned to the UI; only a boolean “passwordSet”.',
    ],
  });
});

router.put('/auth', async (req, res) => {
  const {
    enabled,
    username,
    password,
    clearPassword,
    transport,
    useHttps,
    port,
  } = req.body ?? {};

  const updates: Array<Promise<any>> = [];
  let passwordUpdated = false;
  let passwordCleared = false;

  if (enabled !== undefined) {
    updates.push(upsertSetting('scanAuth.enabled', String(Boolean(enabled))));
  }
  if (username !== undefined) {
    updates.push(upsertSetting('scanAuth.username', String(username ?? '')));
  }
  if (transport !== undefined) {
    updates.push(upsertSetting('scanAuth.transport', normalizeTransport(transport)));
  }
  if (useHttps !== undefined) {
    updates.push(upsertSetting('scanAuth.useHttps', String(Boolean(useHttps))));
  }
  if (port !== undefined) {
    const p = Number(port);
    if (!Number.isFinite(p) || p < 1 || p > 65535) {
      return res.status(400).json({ error: 'port must be a number between 1 and 65535' });
    }
    updates.push(upsertSetting('scanAuth.port', String(Math.trunc(p))));
  }
  if (clearPassword) {
    updates.push(deleteSetting('scanAuth.password'));
    passwordCleared = true;
  } else if (password !== undefined) {
    // Accept empty string to intentionally set a blank password (rare, but explicit).
    updates.push(upsertSetting('scanAuth.password', String(password ?? '')));
    passwordUpdated = true;
  }

  await Promise.all(updates);

  await logAuditEvent({
    eventType: 'SCAN_AUTH_UPDATED',
    message: 'Scan authentication settings updated',
    entityType: 'AppSettings',
    entityId: 'scanAuth',
    metadata: {
      enabled: enabled === undefined ? undefined : Boolean(enabled),
      username: username === undefined ? undefined : String(username ?? ''),
      transport: transport === undefined ? undefined : normalizeTransport(transport),
      useHttps: useHttps === undefined ? undefined : Boolean(useHttps),
      port: port === undefined ? undefined : Math.trunc(Number(port)),
      passwordUpdated,
      passwordCleared,
    },
  });

  // Return the fresh view
  const envAuth = {
    source: 'env' as const,
    username: config.windows.adminUser || '',
    passwordSet: Boolean(config.windows.adminPassword),
    transport: 'ntlm' as WinRmTransport,
    useHttps: false,
    port: 5985,
    endpointTemplate: 'http://{ip}:5985/wsman',
  };

  const m = await getSettings([
    'scanAuth.enabled',
    'scanAuth.username',
    'scanAuth.password',
    'scanAuth.transport',
    'scanAuth.useHttps',
    'scanAuth.port',
  ]);

  const dbEnabled = (m['scanAuth.enabled'] ?? '').toLowerCase() === 'true';
  const dbUsername = m['scanAuth.username'] ?? '';
  const dbPassword = m['scanAuth.password'] ?? '';
  const dbTransport = normalizeTransport(m['scanAuth.transport']);
  const dbUseHttps = (m['scanAuth.useHttps'] ?? '').toLowerCase() === 'true';
  const portRaw = parseInt(m['scanAuth.port'] ?? '', 10);
  const dbPort = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : dbUseHttps ? 5986 : 5985;

  const dbAuth = {
    source: 'db' as const,
    enabled: dbEnabled,
    username: dbUsername,
    passwordSet: Boolean(dbPassword),
    transport: dbTransport,
    useHttps: dbUseHttps,
    port: dbPort,
    endpointTemplate: `${dbUseHttps ? 'https' : 'http'}://{ip}:${dbPort}/wsman`,
  };

  const effective = dbEnabled && dbUsername
    ? {
        source: 'db' as const,
        username: dbUsername,
        passwordSet: Boolean(dbPassword),
        transport: dbTransport,
        useHttps: dbUseHttps,
        port: dbPort,
        endpointTemplate: dbAuth.endpointTemplate,
      }
    : envAuth;

  res.json({
    source: 'code+env+db',
    env: envAuth,
    db: dbAuth,
    effective,
  });
});

function redactDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    const username = decodeURIComponent(u.username || '');
    const hasPassword = Boolean(u.password);
    const passwordRedacted = hasPassword ? '********' : '';
    const host = u.hostname;
    const port = u.port ? parseInt(u.port, 10) : 5432;
    const database = u.pathname?.replace(/^\//, '') || '';

    // Keep query params (e.g., schema) but never show password.
    const redacted = `${u.protocol}//${encodeURIComponent(username)}${hasPassword ? `:${passwordRedacted}` : ''}@${host}${u.port ? `:${u.port}` : ''}/${database}${u.search}`;

    const schema = u.searchParams.get('schema') || 'public';

    return { ok: true as const, redacted, username, hasPassword, host, port, database, schema };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Failed to parse DATABASE_URL' };
  }
}

router.get('/database', async (req, res) => {
  const parsed = redactDatabaseUrl(config.databaseUrl || '');

  let connected = false;
  let connectionError: string | null = null;
  try {
    // Simple probe to confirm connectivity from the API container.
    await prisma.$queryRaw`SELECT 1`;
    connected = true;
  } catch (e: any) {
    connected = false;
    connectionError = e?.message || 'Unknown database connection error';
  }

  // Provide a redacted, DB-focused "env file" view from inside the backend container.
  // We intentionally avoid returning all env vars to prevent leaking secrets.
  const envVars: Array<{ key: string; value: string }> = [];
  const addEnv = (key: string, value: string | undefined, opts?: { redact?: boolean }) => {
    if (value === undefined) return;
    const redact = opts?.redact ?? false;
    envVars.push({ key, value: redact ? '********' : value });
  };

  addEnv('NODE_ENV', process.env.NODE_ENV);
  addEnv('PORT', process.env.PORT);
  addEnv('DATABASE_URL', parsed.ok ? parsed.redacted : process.env.DATABASE_URL, { redact: false });
  // These may or may not exist in the backend container depending on deployment method.
  addEnv('POSTGRES_USER', process.env.POSTGRES_USER);
  addEnv('POSTGRES_DB', process.env.POSTGRES_DB);
  addEnv('POSTGRES_PASSWORD', process.env.POSTGRES_PASSWORD, { redact: true });

  const envFileRedacted =
    envVars.length === 0
      ? ''
      : envVars
          .map((kv) => `${kv.key}=${kv.value}`)
          .join('\n') + '\n';

  res.json({
    source: 'env',
    provider: 'postgresql',
    connected,
    connectionError,
    envVars,
    envFileRedacted,
    ...(parsed.ok
      ? {
          urlRedacted: parsed.redacted,
          host: parsed.host,
          port: parsed.port,
          database: parsed.database,
          user: parsed.username,
          passwordSet: parsed.hasPassword,
          schema: parsed.schema,
        }
      : {
          urlRedacted: '',
          parseError: parsed.error,
        }),
    notes: [
      'Connection details come from DATABASE_URL in the backend container environment.',
      'Passwords are never returned; only a boolean “passwordSet”.',
      'The env snippet below is redacted and only includes DB-related variables (not SMTP/WinRM secrets).',
    ],
  });
});

router.post('/database/purge', async (req, res) => {
  const { days, confirm } = req.body ?? {};
  if (confirm !== true) {
    return res.status(400).json({ error: 'confirm=true is required' });
  }

  const now = new Date();
  const parsedDays = days === undefined || days === null ? null : Number(days);

  if (parsedDays !== null) {
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      return res.status(400).json({ error: 'days must be a positive number' });
    }
  }

  const cutoff = parsedDays === null ? null : new Date(now.getTime() - Math.trunc(parsedDays) * 24 * 60 * 60 * 1000);

  // IMPORTANT: Purge runtime data only (results + audit). Preserve configuration tables.
  const [checkResultsDeleted, auditEventsDeleted] = await prisma.$transaction([
    prisma.checkResult.deleteMany(cutoff ? { where: { createdAt: { lt: cutoff } } } : undefined),
    prisma.auditEvent.deleteMany(cutoff ? { where: { createdAt: { lt: cutoff } } } : undefined),
  ]);

  await logAuditEvent({
    eventType: 'DATABASE_PURGE',
    message: cutoff ? `Purged runtime data older than ${Math.trunc(parsedDays!)} day(s)` : 'Purged all runtime data',
    entityType: 'Database',
    entityId: 'purge',
    metadata: {
      mode: cutoff ? 'older-than' : 'all',
      days: cutoff ? Math.trunc(parsedDays!) : null,
      cutoff: cutoff ? cutoff.toISOString() : null,
      deleted: {
        checkResults: checkResultsDeleted.count,
        auditEvents: auditEventsDeleted.count,
      },
    },
  });

  res.json({
    success: true,
    mode: cutoff ? 'older-than' : 'all',
    days: cutoff ? Math.trunc(parsedDays!) : null,
    cutoff: cutoff ? cutoff.toISOString() : null,
    deleted: {
      checkResults: checkResultsDeleted.count,
      auditEvents: auditEventsDeleted.count,
    },
    notes: [
      'This purge affects runtime data (check results + audit log).',
      'Configuration (machines, checks, schedules, reports) is preserved.',
    ],
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


