import { spawn } from 'child_process';
import { config } from '../config.js';
import { logger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { escapePsSingleQuotedString, normalizeValueName, toPowerShellRegistryPath } from './registry-path.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PowerShellResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

export interface ConnectionOptions {
  hostname: string;
  ipAddress: string;
  username?: string;
  password?: string;
  useSSH?: boolean; // Not used, kept for compatibility
}

/**
 * Execute PowerShell command on remote Windows machine using WinRM via Python
 * This works from Linux Docker containers to Windows machines
 */
export async function executePowerShell(
  command: string,
  connection: ConnectionOptions
): Promise<PowerShellResult> {
  const startTime = Date.now();
  const username = connection.username || config.windows.adminUser;
  const password = connection.password || config.windows.adminPassword;

  logger.info(`Executing PowerShell on ${connection.hostname} (${connection.ipAddress}) via WinRM`);

  return new Promise((resolve) => {
    // Path to Python WinRM script
    const scriptPath = path.join(__dirname, '../../scripts/winrm-exec.py');
    
    // Execute Python script with WinRM
    const py = spawn('python3', [
      scriptPath,
      connection.ipAddress,
      username,
      password,
      command
    ], {
      timeout: config.windows.connectionTimeout,
    });

    let output = '';
    let errorOutput = '';

    py.stdout.on('data', (data) => {
      output += data.toString();
    });

    py.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    py.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      if (code === 0 && output) {
        try {
          // Parse JSON response from Python script
          const result = JSON.parse(output);
          
          if (result.success) {
            logger.info(`PowerShell execution successful on ${connection.hostname} (${duration}ms)`);
            resolve({
              success: true,
              output: result.stdout.trim(),
              duration,
            });
          } else {
            logger.error(`PowerShell execution failed on ${connection.hostname}: ${result.stderr}`);
            resolve({
              success: false,
              output: result.stdout.trim(),
              error: result.stderr.trim(),
              duration,
            });
          }
        } catch (parseError) {
          logger.error(`Failed to parse Python script output: ${output}`);
          resolve({
            success: false,
            output: '',
            error: `Failed to parse result: ${parseError}`,
            duration,
          });
        }
      } else {
        logger.error(`Python script execution failed on ${connection.hostname}: ${errorOutput}`);
        resolve({
          success: false,
          output: '',
          error: errorOutput.trim() || 'Python script execution failed',
          duration,
        });
      }
    });

    py.on('error', (error) => {
      const duration = Date.now() - startTime;
      logger.error(`Python spawn error: ${error.message}`);
      resolve({
        success: false,
        output: '',
        error: error.message,
        duration,
      });
    });
  });
}

/**
 * Test ping/connectivity to Windows machine
 */
export async function pingMachine(connection: ConnectionOptions): Promise<PowerShellResult> {
  // Always return JSON so the scheduler can safely persist `resultData` without parsing errors.
  // NOTE: This command executes *on the remote machine* (via WinRM). We intentionally avoid
  // pinging an external hostname/IP here (e.g., `host.docker.internal`) because it may not
  // resolve from the remote machine. Success here should primarily mean: "remote execution works".
  const command = `@{
    reachable = $true
    computerName = $env:COMPUTERNAME
    timestamp = (Get-Date).ToString('o')
  } | ConvertTo-Json`;
  return executePowerShell(command, connection);
}

/**
 * Get registry value from Windows machine
 */
export async function getRegistryValue(
  connection: ConnectionOptions,
  path: string,
  valueName?: string
): Promise<PowerShellResult> {
  const storedPath = path ?? '';
  const psPath = toPowerShellRegistryPath(storedPath);
  const safePsPath = escapePsSingleQuotedString(psPath);
  const safeStoredPath = escapePsSingleQuotedString(storedPath);

  const normalizedValueName = normalizeValueName(valueName);
  const safeValueName = normalizedValueName ? escapePsSingleQuotedString(normalizedValueName) : undefined;

  // Always return a consistent JSON shape for downstream storage/UI.
  const command = normalizedValueName
    ? `
      $p = '${safePsPath}'
      $stored = '${safeStoredPath}'
      $n = '${safeValueName}'
      function Get-RegistryBaseKey([string]$hive) {
        switch ($hive.ToUpperInvariant()) {
          'HKEY_LOCAL_MACHINE' { return [Microsoft.Win32.Registry]::LocalMachine }
          'HKEY_CURRENT_USER' { return [Microsoft.Win32.Registry]::CurrentUser }
          'HKEY_CLASSES_ROOT' { return [Microsoft.Win32.Registry]::ClassesRoot }
          'HKEY_USERS' { return [Microsoft.Win32.Registry]::Users }
          'HKEY_CURRENT_CONFIG' { return [Microsoft.Win32.Registry]::CurrentConfig }
          default { return $null }
        }
      }

      try {
        if ($stored -match '^(HKEY_[A-Z_]+)\\\\(.*)$') {
          $hive = $Matches[1]
          $subKey = $Matches[2]
          $base = Get-RegistryBaseKey $hive
          if ($null -eq $base) {
            @{ path = $stored; valueName = $n; exists = $false; error = "Unsupported hive: $hive" } | ConvertTo-Json
          } else {
            $key = $base.OpenSubKey($subKey)
            if ($null -eq $key) {
              @{ path = $stored; valueName = $n; exists = $false } | ConvertTo-Json
            } else {
              $val = $key.GetValue($n, $null)
              if ($null -eq $val) {
                @{ path = $stored; valueName = $n; exists = $false } | ConvertTo-Json
              } else {
                $kind = $key.GetValueKind($n).ToString()
                $type = $val.GetType().FullName
                @{ path = $stored; valueName = $n; exists = $true; value = $val; valueKind = $kind; valueType = $type } | ConvertTo-Json -Depth 10
              }
              $key.Close() | Out-Null
            }
          }
        } else {
          # Fallback: treat as a registry-provider key path
          if (Test-Path -Path $p) {
            try {
              $item = Get-ItemProperty -Path $p -Name $n -ErrorAction Stop
              $val = $item.$n
              $type = $null
              if ($null -ne $val) { $type = $val.GetType().FullName }
              @{ path = $stored; valueName = $n; exists = $true; value = $val; valueType = $type } | ConvertTo-Json -Depth 10
            } catch {
              @{ path = $stored; valueName = $n; exists = $false } | ConvertTo-Json
            }
          } else {
            @{ path = $stored; valueName = $n; exists = $false } | ConvertTo-Json
          }
        }
      } catch {
        @{ path = $stored; valueName = $n; exists = $false; error = $_.Exception.Message } | ConvertTo-Json
      }
    `
    : `
      $p = '${safePsPath}'
      $stored = '${safeStoredPath}'
      @{ path = $stored; exists = (Test-Path -Path $p) } | ConvertTo-Json
    `;

  return executePowerShell(command, connection);
}

/**
 * Get file information from Windows machine
 */
export async function getFileInfo(
  connection: ConnectionOptions,
  filePath: string
): Promise<PowerShellResult> {
  const command = `
    if (Test-Path -Path '${filePath}') {
      $file = Get-Item -Path '${filePath}'
      $isDirectory = $file.PSIsContainer
      $sizeBytes = $null
      if (-not $isDirectory -and $file -is [System.IO.FileInfo]) {
        $sizeBytes = $file.Length
      }
      @{
        path = '${filePath}'
        exists = $true
        name = $file.Name
        fullPath = $file.FullName
        isDirectory = $isDirectory
        sizeBytes = $sizeBytes
        createdTime = $file.CreationTime.ToString('o')
        modifiedTime = $file.LastWriteTime.ToString('o')
        isReadOnly = $file.IsReadOnly
        attributes = $file.Attributes.ToString()
      } | ConvertTo-Json
    } else {
      @{ path = '${filePath}'; exists = $false } | ConvertTo-Json
    }
  `;
  
  return executePowerShell(command, connection);
}

/**
 * Get currently logged-in user
 */
export async function getCurrentUser(connection: ConnectionOptions): Promise<PowerShellResult> {
  const command = `
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
        }
      } | ConvertTo-Json
    } else {
      @{ NoUserLoggedIn = $true } | ConvertTo-Json
    }
  `;
  
  return executePowerShell(command, connection);
}

/**
 * Get last logged-in user from registry
 */
export async function getLastUser(connection: ConnectionOptions): Promise<PowerShellResult> {
  const command = `
    $lastUser = Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\LogonUI' -Name 'LastLoggedOnUser' -ErrorAction SilentlyContinue
    if ($lastUser) {
      @{ LastUser = $lastUser.LastLoggedOnUser } | ConvertTo-Json
    } else {
      @{ LastUser = 'Unknown' } | ConvertTo-Json
    }
  `;
  
  return executePowerShell(command, connection);
}

/**
 * Get system information
 */
export async function getSystemInfo(connection: ConnectionOptions): Promise<PowerShellResult> {
  const command = `
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
    } | ConvertTo-Json
  `;
  
  return executePowerShell(command, connection);
}

