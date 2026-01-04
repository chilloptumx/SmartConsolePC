# Quick status check for SmartConsole
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   SmartConsole Status Check" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker containers
Write-Host "Container Status:" -ForegroundColor Yellow
docker compose ps

Write-Host "`nApplication URLs:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:5001" -ForegroundColor Cyan

Write-Host "`nPowerShell Remoting:" -ForegroundColor Yellow
try {
    Test-WSMan -ComputerName localhost -ErrorAction Stop | Out-Null
    Write-Host "  [OK] WinRM is enabled" -ForegroundColor Green
    
    $trustedHosts = (Get-Item WSMan:\localhost\Client\TrustedHosts).Value
    if ($trustedHosts -match "localhost|127.0.0.1") {
        Write-Host "  [OK] TrustedHosts configured" -ForegroundColor Green
    } else {
        Write-Host "  [WARNING] TrustedHosts not configured - run enable-remoting-admin.ps1 as Administrator" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [ERROR] WinRM not working - run enable-remoting-admin.ps1 as Administrator" -ForegroundColor Red
}

Write-Host "`nConfiguration:" -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "  [OK] .env file exists" -ForegroundColor Green
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "WINDOWS_ADMIN_PASSWORD=CHANGE_THIS") {
        Write-Host "  [WARNING] Windows password not set in .env file!" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] Windows password configured" -ForegroundColor Green
    }
} else {
    Write-Host "  [ERROR] .env file not found!" -ForegroundColor Red
}

Write-Host ""

