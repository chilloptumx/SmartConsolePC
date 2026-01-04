# Enable WinRM for SmartConsole Health Checks
# Run this script as Administrator on each Windows machine to monitor

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Enabling WinRM for SmartConsole" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Enabling PowerShell Remoting (WinRM)..." -ForegroundColor Yellow
try {
    Enable-PSRemoting -Force -SkipNetworkProfileCheck | Out-Null
    Write-Host "[OK] PowerShell Remoting enabled" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to enable PS Remoting: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Configuring WinRM service..." -ForegroundColor Yellow
try {
    # Set service to automatic
    Set-Service WinRM -StartupType Automatic
    Start-Service WinRM
    Write-Host "[OK] WinRM service started" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to start WinRM: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Configuring WinRM for HTTP (port 5985)..." -ForegroundColor Yellow
try {
    # Enable HTTP listener
    winrm quickconfig -quiet -force
    
    # Allow unencrypted traffic (for HTTP - use HTTPS in production!)
    winrm set winrm/config/service '@{AllowUnencrypted="true"}'
    winrm set winrm/config/service/auth '@{Basic="true"}'
    
    Write-Host "[OK] WinRM HTTP configured" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] WinRM might already be configured: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 4: Configuring firewall..." -ForegroundColor Yellow
try {
    # Enable firewall rule for WinRM HTTP
    Enable-NetFirewallRule -Name "WINRM-HTTP-In-TCP" -ErrorAction SilentlyContinue
    Write-Host "[OK] Firewall configured for WinRM" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Firewall rule may already exist: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 5: Setting TrustedHosts..." -ForegroundColor Yellow
try {
    # Allow connections from localhost (for testing)
    Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
    Write-Host "[OK] TrustedHosts configured" -ForegroundColor Green
    Write-Host "[WARNING] TrustedHosts set to '*' - restrict this in production!" -ForegroundColor Yellow
} catch {
    Write-Host "[ERROR] Failed to set TrustedHosts: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Step 6: Restarting WinRM service..." -ForegroundColor Yellow
try {
    Restart-Service WinRM
    Write-Host "[OK] WinRM service restarted" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to restart WinRM: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  WinRM Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration Summary:" -ForegroundColor Yellow
Write-Host "  Service: WinRM (Windows Remote Management)" -ForegroundColor White
Write-Host "  Protocol: HTTP" -ForegroundColor White
Write-Host "  Port: 5985" -ForegroundColor White
Write-Host "  Authentication: Basic" -ForegroundColor White
Write-Host ""
Write-Host "Test WinRM from PowerShell:" -ForegroundColor Yellow
Write-Host "  Test-WSMan -ComputerName localhost" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or test from another machine:" -ForegroundColor Yellow
Write-Host "  Test-WSMan -ComputerName $env:COMPUTERNAME" -ForegroundColor Cyan
Write-Host ""
Write-Host "Security Note:" -ForegroundColor Yellow
Write-Host "  This setup uses HTTP (unencrypted) for simplicity." -ForegroundColor White
Write-Host "  For production, configure HTTPS (port 5986) with SSL certificates." -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Add this machine to SmartConsole web interface" -ForegroundColor White
Write-Host "  2. Set credentials in .env file" -ForegroundColor White
Write-Host "  3. Test health checks from SmartConsole" -ForegroundColor White
Write-Host ""

