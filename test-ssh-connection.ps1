# Test SSH connection for SmartConsole
# Run this after setup-ssh-windows.ps1 completes

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Testing SSH Connection" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$username = "testuser"
$target = "127.0.0.1"

Write-Host "Testing SSH connection to $target as $username..." -ForegroundColor Yellow
Write-Host ""

# Test 1: Basic SSH
Write-Host "Test 1: Basic SSH connection..." -ForegroundColor Yellow
try {
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes ${username}@${target} "echo 'SSH OK'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] SSH connection successful" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] SSH connection failed" -ForegroundColor Red
        Write-Host "Error: $result" -ForegroundColor Red
        Write-Host ""
        Write-Host "Possible issues:" -ForegroundColor Yellow
        Write-Host "  - SSH service not running" -ForegroundColor White
        Write-Host "  - Wrong username/password" -ForegroundColor White
        Write-Host "  - Firewall blocking connection" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "[ERROR] SSH test failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: PowerShell via SSH
Write-Host "Test 2: PowerShell via SSH..." -ForegroundColor Yellow
try {
    $result = ssh ${username}@${target} "powershell -Command 'Write-Output \"PowerShell OK\"'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] PowerShell via SSH successful" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] PowerShell via SSH failed" -ForegroundColor Red
        Write-Host "Error: $result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] PowerShell test failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Get system info
Write-Host "Test 3: Getting system info via SSH..." -ForegroundColor Yellow
try {
    $result = ssh ${username}@${target} "powershell -Command '(Get-ComputerInfo).CsName'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Computer name: $result" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Could not get system info" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] System info test failed: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  SSH Connection Tests Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now run health checks from SmartConsole" -ForegroundColor White
Write-Host ""
Write-Host "Open: http://localhost:3001" -ForegroundColor Cyan
Write-Host ""

