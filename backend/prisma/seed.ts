import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Seed User Checks (previously static USER_INFO configuration)
  const existingUserChecks = await prisma.userCheck.count();
  if (existingUserChecks === 0) {
    console.log('Seeding default user checks...');
    
    // PowerShell scripts for reference
    const currentOnlyScript = `# Current logged-in user (wrapped for UI)
$result = @{}

try {
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
  $u = $cs.UserName
  if ($u) {
    $result.currentUser = @{ Username = $u; Source = 'Win32_ComputerSystem' }
  } else {
    $users = quser 2>&1
    if ($LASTEXITCODE -eq 0) {
      $result.currentUser = $users | Select-Object -Skip 1 | ForEach-Object {
        $line = $_ -replace '\\s+', ','
        $parts = $line -split ','
        @{
          Username = $parts[0]
          SessionName = $parts[1]
          ID = $parts[2]
          State = $parts[3]
          IdleTime = $parts[4]
          LogonTime = $parts[5..$parts.Length] -join ' '
          Source = 'quser'
        }
      }
    } else {
      $result.currentUser = @{ NoUserLoggedIn = $true }
    }
  }
} catch {
  $result.currentUser = @{ NoUserLoggedIn = $true; error = $_.Exception.Message }
}

$result | ConvertTo-Json -Depth 3`;

    const lastOnlyScript = `# Last logged-in user (wrapped for UI)
$result = @{}
$lastUser = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI' -Name 'LastLoggedOnUser' -ErrorAction SilentlyContinue
if ($lastUser) {
  $result.lastUser = @{ LastUser = $lastUser.LastLoggedOnUser }
} else {
  $result.lastUser = @{ LastUser = 'Unknown' }
}
$result | ConvertTo-Json -Depth 3`;

    const currentAndLastScript = `# Get both current and last logged-in user
$result = @{}

# Current User
try {
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
  $u = $cs.UserName
  if ($u) {
    $result.currentUser = @{ Username = $u; Source = 'Win32_ComputerSystem' }
  } else {
    $users = quser 2>&1
    if ($LASTEXITCODE -eq 0) {
      $result.currentUser = $users | Select-Object -Skip 1 | ForEach-Object {
        $line = $_ -replace '\\s+', ','
        $parts = $line -split ','
        @{
          Username = $parts[0]
          SessionName = $parts[1]
          ID = $parts[2]
          State = $parts[3]
          IdleTime = $parts[4]
          LogonTime = $parts[5..$parts.Length] -join ' '
          Source = 'quser'
        }
      }
    } else {
      $result.currentUser = @{ NoUserLoggedIn = $true }
    }
  }
} catch {
  $result.currentUser = @{ NoUserLoggedIn = $true; error = $_.Exception.Message }
}

# Last User
$lastUser = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI' -Name 'LastLoggedOnUser' -ErrorAction SilentlyContinue
if ($lastUser) {
  $result.lastUser = @{ LastUser = $lastUser.LastLoggedOnUser }
} else {
  $result.lastUser = @{ LastUser = 'Unknown' }
}

$result | ConvertTo-Json -Depth 3`;
    
    await prisma.userCheck.create({
      data: {
        name: 'Current and Last User',
        checkType: 'CUSTOM',
        description: 'Collects both current logged-in user and last logged-in user information from the registry. Uses Win32_ComputerSystem and quser for current user, registry LogonUI for last user.',
        customScript: currentAndLastScript,
        isActive: true,
      },
    });

    await prisma.userCheck.create({
      data: {
        name: 'Current User Only',
        checkType: 'CUSTOM',
        description: 'Collects only the currently logged-in user information using Win32_ComputerSystem or quser command',
        customScript: currentOnlyScript,
        isActive: false, // Disabled by default since Current and Last is more comprehensive
      },
    });

    await prisma.userCheck.create({
      data: {
        name: 'Last User Only',
        checkType: 'CUSTOM',
        description: 'Collects only the last logged-in user from the registry (HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI)',
        customScript: lastOnlyScript,
        isActive: false, // Disabled by default
      },
    });

    console.log('✓ User checks seeded (3 checks)');
  } else {
    console.log(`Skipping user checks seed (${existingUserChecks} already exist)`);
  }

  // Seed System Checks (previously static SYSTEM_INFO configuration)
  const existingSystemChecks = await prisma.systemCheck.count();
  if (existingSystemChecks === 0) {
    console.log('Seeding default system checks...');
    
    const systemInfoScript = `# Collect comprehensive system information
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$lastBoot = $os.LastBootUpTime

@{
  ComputerName = $cs.Name
  Manufacturer = $cs.Manufacturer
  Model = $cs.Model
  TotalMemoryGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
  OSVersion = $os.Caption
  OSArchitecture = $os.OSArchitecture
  LastBootTime = $lastBoot.ToString('o')
  UptimeDays = [math]::Round(((Get-Date) - $lastBoot).TotalDays, 2)
} | ConvertTo-Json`;
    
    await prisma.systemCheck.create({
      data: {
        name: 'System Information',
        checkType: 'CUSTOM',
        description: 'Collects comprehensive system information using Win32_OperatingSystem and Win32_ComputerSystem CIM classes. Outputs: ComputerName, Manufacturer, Model, TotalMemoryGB, OSVersion, OSArchitecture, LastBootTime, UptimeDays',
        customScript: systemInfoScript,
        isActive: true,
      },
    });

    // Add some additional example system checks for reference
    const diskSpaceScript = `# Check disk space on C: drive
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
@{
  Drive = $disk.DeviceID
  FreeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
  TotalSpaceGB = [math]::Round($disk.Size / 1GB, 2)
  UsedSpaceGB = [math]::Round(($disk.Size - $disk.FreeSpace) / 1GB, 2)
  PercentFree = [math]::Round(($disk.FreeSpace / $disk.Size) * 100, 2)
  VolumeName = $disk.VolumeName
  FileSystem = $disk.FileSystem
} | ConvertTo-Json`;

    const cpuInfoScript = `# Get CPU information
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
@{
  Name = $cpu.Name
  Manufacturer = $cpu.Manufacturer
  NumberOfCores = $cpu.NumberOfCores
  NumberOfLogicalProcessors = $cpu.NumberOfLogicalProcessors
  MaxClockSpeed = $cpu.MaxClockSpeed
  CurrentClockSpeed = $cpu.CurrentClockSpeed
  LoadPercentage = $cpu.LoadPercentage
  Architecture = $cpu.Architecture
} | ConvertTo-Json`;

    const networkInfoScript = `# Get network adapter information
$adapters = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true }
$result = @()
foreach ($adapter in $adapters) {
  $result += @{
    Description = $adapter.Description
    MACAddress = $adapter.MACAddress
    IPAddress = $adapter.IPAddress -join ', '
    SubnetMask = $adapter.IPSubnet -join ', '
    DefaultGateway = $adapter.DefaultIPGateway -join ', '
    DNSServers = $adapter.DNSServerSearchOrder -join ', '
    DHCPEnabled = $adapter.DHCPEnabled
  }
}
@{ Adapters = $result } | ConvertTo-Json -Depth 3`;

    await prisma.systemCheck.create({
      data: {
        name: 'Disk Space Check (C: Drive)',
        checkType: 'CUSTOM',
        description: 'Example: Monitors free and total space on the C: drive. Shows GB values and percentage free.',
        customScript: diskSpaceScript,
        isActive: false,
      },
    });

    await prisma.systemCheck.create({
      data: {
        name: 'CPU Information',
        checkType: 'CUSTOM',
        description: 'Example: Collects CPU details including cores, clock speed, and current load percentage.',
        customScript: cpuInfoScript,
        isActive: false,
      },
    });

    await prisma.systemCheck.create({
      data: {
        name: 'Network Adapter Information',
        checkType: 'CUSTOM',
        description: 'Example: Gathers information about all enabled network adapters including IP addresses, MAC addresses, and DNS settings.',
        customScript: networkInfoScript,
        isActive: false,
      },
    });

    console.log('✓ System checks seeded (4 checks: 1 default + 3 examples)');
  } else {
    console.log(`Skipping system checks seed (${existingSystemChecks} already exist)`);
  }

  // Seed Service Checks (Windows services)
  // This creates an initial example/service check so it immediately shows up in Configuration.
  {
    try {
      const svc = (prisma as any).serviceCheck;
      if (!svc?.findFirst || !svc?.create) throw new Error('serviceCheck model not available');

      console.log('Ensuring default service checks exist...');

      const snmpCollectorSnippet = `Collector snippet (PowerShell via WinRM; matches backend getServiceInfo)

$serviceName = 'SNMPTRAP'
$exePath = 'C:\\WINDOWS\\System32\\snmptrap.exe'

$result = @{}
$result.query = @{
  serviceName = $serviceName
  executablePath = $exePath
}

try {
  $svc = $null
  $matchedBy = $null

  if ($serviceName) {
    $sn = $serviceName -replace "'", "''"
    $svc = Get-CimInstance Win32_Service -Filter "Name='$sn'" -ErrorAction SilentlyContinue
    if ($svc) { $matchedBy = 'serviceName' }
  }

  if (-not $svc -and $exePath) {
    $needle = $exePath.ToLowerInvariant()
    # Enumerate services and match PathName; supports quoting/args in PathName.
    $all = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue
    $match = $all | Where-Object {
      $p = $_.PathName
      if (-not $p) { return $false }
      return $p.ToString().ToLowerInvariant().Contains($needle)
    } | Select-Object -First 1

    if ($match) {
      $svc = $match
      $matchedBy = 'executablePath'
    }
  }

  if ($svc) {
    $result.exists = $true
    $result.matchedBy = $matchedBy
    $result.name = $svc.Name
    $result.displayName = $svc.DisplayName
    $result.state = $svc.State
    $result.status = $svc.State
    $result.startMode = $svc.StartMode
    $result.pathName = $svc.PathName
    $result.processId = $svc.ProcessId
  } else {
    $result.exists = $false
  }
} catch {
  $result.exists = $false
  $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 6
`;

      const SNMP_CHECK_NAME = 'SNMP Trap Service';
      const SNMP_SERVICE_NAME = 'SNMPTRAP';
      // Store/compare as a normal Windows path (single backslashes at runtime).
      const SNMP_EXE_PATH = 'C:\\WINDOWS\\System32\\snmptrap.exe';

      const defaultDesc = `Checks Windows service state for the SNMP Trap service (snmptrap.exe).

${snmpCollectorSnippet}`;

      const existing = await svc.findFirst({
        where: {
          OR: [
            { serviceName: SNMP_SERVICE_NAME },
            { executablePath: SNMP_EXE_PATH },
            { name: SNMP_CHECK_NAME },
          ],
        },
      });

      if (!existing) {
        await svc.create({
          data: {
            name: SNMP_CHECK_NAME,
            serviceName: SNMP_SERVICE_NAME,
            executablePath: SNMP_EXE_PATH,
            expectedStatus: 'Running',
            description: defaultDesc,
            isActive: true,
          },
        });
        console.log('✓ Ensured service check: SNMP Trap Service (created)');
      } else {
        const updates: any = {};
        if (!(existing.name ?? '').toString().trim()) updates.name = SNMP_CHECK_NAME;
        if (!(existing.serviceName ?? '').toString().trim()) updates.serviceName = SNMP_SERVICE_NAME;
        if (!(existing.executablePath ?? '').toString().trim())
          updates.executablePath = SNMP_EXE_PATH;
        if (!(existing.expectedStatus ?? '').toString().trim()) updates.expectedStatus = 'Running';

        const currentDesc = (existing.description ?? '').toString();
        if (!currentDesc.includes('Collector snippet') || !currentDesc.includes('Get-CimInstance Win32_Service')) {
          updates.description = currentDesc.trim()
            ? `${currentDesc.trim()}\n\n${snmpCollectorSnippet}`
            : defaultDesc;
        }

        if (Object.keys(updates).length > 0) {
          await svc.update({ where: { id: existing.id }, data: updates });
          console.log('✓ Ensured service check: SNMP Trap Service (updated)');
        } else {
          console.log('✓ Ensured service check: SNMP Trap Service (already present)');
        }
      }
    } catch (e) {
      // Non-fatal for older schemas; keep startup resilient.
      console.log('Skipping service checks seed (schema not present yet)');
    }
  }

  // Ensure seeded User/System checks are stored as CUSTOM so the UI can show the actual script used.
  // This intentionally converts non-custom rows into custom-script rows using equivalent PowerShell.
  {
    const currentOnlyScript = `# Current logged-in user (wrapped for UI)
$result = @{}

try {
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
  $u = $cs.UserName
  if ($u) {
    $result.currentUser = @{ Username = $u; Source = 'Win32_ComputerSystem' }
  } else {
    $users = quser 2>&1
    if ($LASTEXITCODE -eq 0) {
      $result.currentUser = $users | Select-Object -Skip 1 | ForEach-Object {
        $line = $_ -replace '\\s+', ','
        $parts = $line -split ','
        @{
          Username = $parts[0]
          SessionName = $parts[1]
          ID = $parts[2]
          State = $parts[3]
          IdleTime = $parts[4]
          LogonTime = $parts[5..$parts.Length] -join ' '
          Source = 'quser'
        }
      }
    } else {
      $result.currentUser = @{ NoUserLoggedIn = $true }
    }
  }
} catch {
  $result.currentUser = @{ NoUserLoggedIn = $true; error = $_.Exception.Message }
}

$result | ConvertTo-Json -Depth 3`;

    const lastOnlyScript = `# Last logged-in user (wrapped for UI)
$result = @{}
$lastUser = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI' -Name 'LastLoggedOnUser' -ErrorAction SilentlyContinue
if ($lastUser) {
  $result.lastUser = @{ LastUser = $lastUser.LastLoggedOnUser }
} else {
  $result.lastUser = @{ LastUser = 'Unknown' }
}
$result | ConvertTo-Json -Depth 3`;

    const currentAndLastScript = `# Get both current and last logged-in user
$result = @{}

# Current User
try {
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
  $u = $cs.UserName
  if ($u) {
    $result.currentUser = @{ Username = $u; Source = 'Win32_ComputerSystem' }
  } else {
    $users = quser 2>&1
    if ($LASTEXITCODE -eq 0) {
      $result.currentUser = $users | Select-Object -Skip 1 | ForEach-Object {
        $line = $_ -replace '\\s+', ','
        $parts = $line -split ','
        @{
          Username = $parts[0]
          SessionName = $parts[1]
          ID = $parts[2]
          State = $parts[3]
          IdleTime = $parts[4]
          LogonTime = $parts[5..$parts.Length] -join ' '
          Source = 'quser'
        }
      }
    } else {
      $result.currentUser = @{ NoUserLoggedIn = $true }
    }
  }
} catch {
  $result.currentUser = @{ NoUserLoggedIn = $true; error = $_.Exception.Message }
}

# Last User
$lastUser = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI' -Name 'LastLoggedOnUser' -ErrorAction SilentlyContinue
if ($lastUser) {
  $result.lastUser = @{ LastUser = $lastUser.LastLoggedOnUser }
} else {
  $result.lastUser = @{ LastUser = 'Unknown' }
}

$result | ConvertTo-Json -Depth 3`;

    // Convert any built-in user check types into CUSTOM, ensuring scripts are populated and UI-friendly.
    const userChecks = await prisma.userCheck.findMany();
    for (const uc of userChecks) {
      if (uc.checkType === 'CUSTOM') continue;

      let script: string | null = null;
      const n = String(uc.name ?? '').trim();
      if (n === 'Current and Last User') script = currentAndLastScript;
      if (n === 'Current User Only') script = currentOnlyScript;
      if (n === 'Last User Only') script = lastOnlyScript;

      // Fallback by prior checkType if name doesn't match
      if (!script) {
        const t = String(uc.checkType ?? '').trim();
        if (t === 'CURRENT_AND_LAST') script = currentAndLastScript;
        else if (t === 'CURRENT_ONLY') script = currentOnlyScript;
        else if (t === 'LAST_ONLY') script = lastOnlyScript;
      }

      await prisma.userCheck.update({
        where: { id: uc.id },
        data: {
          checkType: 'CUSTOM',
          ...(script ? { customScript: script } : {}),
        },
      });
    }

    // Convert SYSTEM_INFO system checks into CUSTOM so the UI shows the actual script.
    const systemInfoScript = `# Collect comprehensive system information
$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$lastBoot = $os.LastBootUpTime

@{
  ComputerName = $cs.Name
  Manufacturer = $cs.Manufacturer
  Model = $cs.Model
  TotalMemoryGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
  OSVersion = $os.Caption
  OSArchitecture = $os.OSArchitecture
  LastBootTime = $lastBoot.ToString('o')
  UptimeDays = [math]::Round(((Get-Date) - $lastBoot).TotalDays, 2)
} | ConvertTo-Json`;

    const sysChecks = await prisma.systemCheck.findMany();
    for (const sc of sysChecks) {
      if (sc.checkType === 'CUSTOM') continue;

      const t = String(sc.checkType ?? '').trim();
      if (t === 'SYSTEM_INFO') {
        await prisma.systemCheck.update({
          where: { id: sc.id },
          data: {
            checkType: 'CUSTOM',
            customScript: sc.customScript ?? systemInfoScript,
          },
        });
      } else {
        // Unknown non-custom type: convert to CUSTOM but keep existing script if present.
        await prisma.systemCheck.update({
          where: { id: sc.id },
          data: {
            checkType: 'CUSTOM',
          },
        });
      }
    }
  }

  // Ensure newer system checks are present even if the DB was already seeded previously.
  // (The backend runs prisma:seed on startup, so this keeps old environments up to date.)
  {
    const name = 'Local Administrators Members';
    const existing = await prisma.systemCheck.findFirst({ where: { name } });
    if (!existing) {
      const localAdminsScript = `# Enumerate local Administrators group members (users + groups, including domain principals)
$group = 'Administrators'
$members = @()
$errors = @()

try {
  $members = Get-LocalGroupMember -Group $group -ErrorAction Stop | ForEach-Object {
    $sid = $null
    try { $sid = $_.SID.Value } catch { }
    @{
      Name = $_.Name
      ObjectClass = $_.ObjectClass
      PrincipalSource = $_.PrincipalSource
      SID = $sid
    }
  }
} catch {
  $errors += $_.Exception.Message

  # Fallback for environments where Get-LocalGroupMember isn't available
  $raw = (net localgroup $group 2>&1) | ForEach-Object { "$_" }
  $start = ($raw | Select-String -Pattern '----' -SimpleMatch | Select-Object -First 1).LineNumber
  $end = ($raw | Select-String -Pattern 'The command completed successfully' -SimpleMatch | Select-Object -First 1).LineNumber
  if ($start) {
    $from = [Math]::Min($raw.Length, $start + 1)
    $to = if ($end) { [Math]::Max(1, $end - 1) } else { $raw.Length }
    $names = @()
    for ($i = $from; $i -le $to; $i++) {
      $line = $raw[$i - 1].Trim()
      if ($line -and ($line -notmatch '^-{3,}$')) { $names += $line }
    }
    $members = $names | ForEach-Object { @{ Name = $_; ObjectClass = 'Unknown'; PrincipalSource = 'net' } }
  }
}

$members = $members | Sort-Object -Property ObjectClass, Name
@{
  Group = $group
  Count = ($members | Measure-Object).Count
  Members = $members
  Errors = $errors
} | ConvertTo-Json -Depth 6`;

      await prisma.systemCheck.create({
        data: {
          name,
          checkType: 'CUSTOM',
          description:
            'Enumerates all members of the local Administrators group (includes nested security groups and individual users when available).',
          customScript: localAdminsScript,
          isActive: false,
        },
      });
      console.log(`✓ Added system check: ${name}`);
    }
  }

  // Add example custom user check
  const existingUserCheckCount = await prisma.userCheck.count();
  if (existingUserCheckCount === 3) {
    console.log('Adding example custom user check...');
    
    const userSessionHistoryScript = `# Get recent user logon/logoff events from Event Log
$events = Get-WinEvent -FilterHashtable @{
  LogName = 'Security'
  Id = 4624, 4634
  StartTime = (Get-Date).AddDays(-7)
} -MaxEvents 20 -ErrorAction SilentlyContinue

$result = @()
foreach ($event in $events) {
  $username = $event.Properties[5].Value
  $logonType = $event.Properties[8].Value
  $result += @{
    TimeCreated = $event.TimeCreated.ToString('o')
    EventId = $event.Id
    EventType = if ($event.Id -eq 4624) { 'Logon' } else { 'Logoff' }
    Username = $username
    LogonType = $logonType
  }
}
@{ RecentEvents = $result } | ConvertTo-Json -Depth 3`;

    await prisma.userCheck.create({
      data: {
        name: 'Recent User Logon/Logoff Events',
        checkType: 'CUSTOM',
        description: 'Example: Queries the Security event log for recent user logon (4624) and logoff (4634) events from the last 7 days.',
        customScript: userSessionHistoryScript,
        isActive: false,
      },
    });

    console.log('✓ Added example custom user check');
  }

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

