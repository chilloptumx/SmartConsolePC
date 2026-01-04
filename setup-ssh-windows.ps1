# Setup SSH-based PowerShell Remoting on Windows
# Run this script as Administrator on each Windows machine to monitor

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  SSH PowerShell Remoting Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Step 1: Install OpenSSH Server
Write-Host "Step 1: Installing OpenSSH Server..." -ForegroundColor Yellow
$sshServer = Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'

if ($sshServer.State -eq 'Installed') {
    Write-Host "[OK] OpenSSH Server already installed" -ForegroundColor Green
} else {
    Write-Host "Installing OpenSSH Server..." -ForegroundColor White
    try {
        Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
        Write-Host "[OK] OpenSSH Server installed" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to install OpenSSH Server: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Step 2: Start and enable SSH service
Write-Host "Step 2: Configuring SSH service..." -ForegroundColor Yellow
try {
    Start-Service sshd -ErrorAction SilentlyContinue
    Set-Service -Name sshd -StartupType 'Automatic'
    Write-Host "[OK] SSH service started and set to automatic" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to configure SSH service: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Configure PowerShell SSH subsystem
Write-Host "Step 3: Configuring PowerShell SSH subsystem..." -ForegroundColor Yellow
$sshdConfig = "C:\ProgramData\ssh\sshd_config"

# Check if PowerShell 7 is installed
$pwshPath = Get-Command pwsh -ErrorAction SilentlyContinue
if (-not $pwshPath) {
    Write-Host "[WARNING] PowerShell 7 not found!" -ForegroundColor Yellow
    Write-Host "Install with: winget install Microsoft.PowerShell" -ForegroundColor Cyan
    Write-Host "Using Windows PowerShell instead..." -ForegroundColor Yellow
    $subsystemLine = "Subsystem powershell c:/windows/system32/windowspowershell/v1.0/powershell.exe -sshs -NoLogo -NoProfile"
} else {
    Write-Host "[OK] PowerShell 7 found: $($pwshPath.Source)" -ForegroundColor Green
    $subsystemLine = "Subsystem powershell c:/progra~1/powershell/7/pwsh.exe -sshs -NoLogo"
}

# Check if already configured
if (Select-String -Path $sshdConfig -Pattern "Subsystem powershell" -Quiet) {
    Write-Host "[OK] PowerShell subsystem already configured" -ForegroundColor Green
} else {
    try {
        Add-Content -Path $sshdConfig -Value "`n$subsystemLine"
        Write-Host "[OK] PowerShell subsystem configured" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to configure PowerShell subsystem: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Step 4: Configure firewall
Write-Host "Step 4: Configuring firewall..." -ForegroundColor Yellow
if (Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Firewall rule already exists" -ForegroundColor Green
} else {
    try {
        New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
        Write-Host "[OK] Firewall rule created" -ForegroundColor Green
    } catch {
        Write-Host "[WARNING] Failed to create firewall rule: $_" -ForegroundColor Yellow
        Write-Host "You may need to manually allow port 22" -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 5: Restart SSH service
Write-Host "Step 5: Restarting SSH service..." -ForegroundColor Yellow
try {
    Restart-Service sshd
    Write-Host "[OK] SSH service restarted" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to restart SSH service: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  SSH Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Test SSH connection:" -ForegroundColor Yellow
Write-Host "  ssh $env:USERNAME@localhost" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test PowerShell remoting:" -ForegroundColor Yellow
Write-Host "  Enter-PSSession -HostName localhost -UserName $env:USERNAME" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test SSH connection above" -ForegroundColor White
Write-Host "  2. Add this machine to SmartConsole" -ForegroundColor White
Write-Host "  3. Set credentials in .env file" -ForegroundColor White
Write-Host "  4. Restart backend: docker compose restart backend" -ForegroundColor White
Write-Host ""

