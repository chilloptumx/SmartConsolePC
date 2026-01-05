import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Seed User Checks (previously static USER_INFO configuration)
  const existingUserChecks = await prisma.userCheck.count();
  if (existingUserChecks === 0) {
    console.log('Seeding default user checks...');
    
    // PowerShell scripts for reference
    const currentUserScript = `# Get currently logged-in user
try {
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
  $u = $cs.UserName
  if ($u) {
    @{ Username = $u; Source = 'Win32_ComputerSystem' } | ConvertTo-Json
  } else {
    $users = quser 2>&1
    if ($LASTEXITCODE -eq 0) {
      $users | Select-Object -Skip 1 | ForEach-Object {
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
      } | ConvertTo-Json
    } else {
      @{ NoUserLoggedIn = $true } | ConvertTo-Json
    }
  }
} catch {
  @{ NoUserLoggedIn = $true; error = $_.Exception.Message } | ConvertTo-Json
}`;

    const lastUserScript = `# Get last logged-in user from registry
$lastUser = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI' -Name 'LastLoggedOnUser' -ErrorAction SilentlyContinue
if ($lastUser) {
  @{ LastUser = $lastUser.LastLoggedOnUser } | ConvertTo-Json
} else {
  @{ LastUser = 'Unknown' } | ConvertTo-Json
}`;

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
        checkType: 'CURRENT_AND_LAST',
        description: 'Collects both current logged-in user and last logged-in user information from the registry. Uses Win32_ComputerSystem and quser for current user, registry LogonUI for last user.',
        customScript: currentAndLastScript,
        isActive: true,
      },
    });

    await prisma.userCheck.create({
      data: {
        name: 'Current User Only',
        checkType: 'CURRENT_ONLY',
        description: 'Collects only the currently logged-in user information using Win32_ComputerSystem or quser command',
        customScript: currentUserScript,
        isActive: false, // Disabled by default since Current and Last is more comprehensive
      },
    });

    await prisma.userCheck.create({
      data: {
        name: 'Last User Only',
        checkType: 'LAST_ONLY',
        description: 'Collects only the last logged-in user from the registry (HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI)',
        customScript: lastUserScript,
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
        checkType: 'SYSTEM_INFO',
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

