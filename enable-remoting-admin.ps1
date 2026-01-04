# Enable PowerShell Remoting for SmartConsole
# Run this script as Administrator

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Enable PowerShell Remoting" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "[OK] Running as Administrator" -ForegroundColor Green
Write-Host ""

# Enable PowerShell Remoting
Write-Host "Enabling PowerShell Remoting..." -ForegroundColor Yellow
try {
    Enable-PSRemoting -Force -SkipNetworkProfileCheck | Out-Null
    Write-Host "[OK] PowerShell Remoting enabled" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] PowerShell Remoting may already be enabled" -ForegroundColor Yellow
}

# Configure TrustedHosts
Write-Host ""
Write-Host "Configuring TrustedHosts..." -ForegroundColor Yellow
try {
    $currentTrustedHosts = (Get-Item WSMan:\localhost\Client\TrustedHosts).Value
    
    if ($currentTrustedHosts -eq "" -or $currentTrustedHosts -eq $null) {
        Set-Item WSMan:\localhost\Client\TrustedHosts -Value "localhost,127.0.0.1" -Force
    } elseif ($currentTrustedHosts -notmatch "localhost" -or $currentTrustedHosts -notmatch "127.0.0.1") {
        $newValue = "$currentTrustedHosts,localhost,127.0.0.1"
        Set-Item WSMan:\localhost\Client\TrustedHosts -Value $newValue -Force
    }
    
    Write-Host "[OK] TrustedHosts configured: $(Get-Item WSMan:\localhost\Client\TrustedHosts | Select-Object -ExpandProperty Value)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to configure TrustedHosts" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Restart WinRM service
Write-Host ""
Write-Host "Restarting WinRM service..." -ForegroundColor Yellow
try {
    Restart-Service WinRM -Force
    Write-Host "[OK] WinRM service restarted" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to restart WinRM" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test the connection
Write-Host ""
Write-Host "Testing PowerShell Remoting..." -ForegroundColor Yellow
try {
    Test-WSMan -ComputerName localhost | Out-Null
    Write-Host "[OK] PowerShell Remoting is working!" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] PowerShell Remoting test failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   [SUCCESS] Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PowerShell Remoting is now configured." -ForegroundColor Green
Write-Host "You can now use SmartConsole to run health checks!" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Open http://localhost:3001 in your browser" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit..."

