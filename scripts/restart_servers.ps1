[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$backendDir = Join-Path $workspaceRoot "backend"
$frontendDir = Join-Path $workspaceRoot "frontend"
$logsDir = Join-Path $workspaceRoot ".server-logs"
$pythonExe = Join-Path $workspaceRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
}

Write-Host "Deteniendo servidores anteriores..." -ForegroundColor Cyan

# 1. Detener procesos por puerto (8000 backend, 3000 frontend)
$ports = @(8000, 3000)
foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($p in $pids) {
                if ($p -and $p -ne 0 -and $p -ne $PID) {
                    Write-Host "Deteniendo proceso $p en puerto $port..." -ForegroundColor Yellow
                    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        # Silencio si falla la búsqueda por conexión de red
    }
}

# 2. Detener procesos huérfanos que contengan uvicorn app.main o next-server en este directorio
try {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        ($_.CommandLine -like "*uvicorn app.main:app*" -or $_.CommandLine -like "*next dev*") -and
        $_.ProcessId -ne $PID
    } | ForEach-Object {
        Write-Host "Deteniendo proceso residual $($_.ProcessId): $($_.Name)..." -ForegroundColor Yellow
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch {
    # Ignorar si no hay permisos WMI
}

Start-Sleep -Seconds 2

# 3. Iniciar Backend (FastAPI / Uvicorn)
Write-Host "Iniciando Backend en http://localhost:8000..." -ForegroundColor Cyan
$backendOut = Join-Path $logsDir "backend.out.log"
$backendErr = Join-Path $logsDir "backend.err.log"

$backendProc = Start-Process `
    -FilePath $pythonExe `
    -ArgumentList "-m uvicorn app.main:app --reload --port 8000" `
    -WorkingDirectory $backendDir `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Backend iniciado (PID: $($backendProc.Id))" -ForegroundColor Green

# 4. Iniciar Frontend (Next.js en puerto 3000)
Write-Host "Iniciando Frontend en http://localhost:3000..." -ForegroundColor Cyan
$frontendOut = Join-Path $logsDir "frontend.out.log"
$frontendErr = Join-Path $logsDir "frontend.err.log"

$frontendProc = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev -- -p 3000" `
    -WorkingDirectory $frontendDir `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr `
    -WindowStyle Hidden `
    -PassThru

Write-Host "Frontend iniciado (PID: $($frontendProc.Id))" -ForegroundColor Green

# 5. Esperar verificación inicial
Write-Host "Verificando disponibilidad de los servidores..." -ForegroundColor Cyan
Start-Sleep -Seconds 4

$backendOk = $false
try {
    $res = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($res -and $res.status -eq "ok") {
        $backendOk = $true
    }
} catch {}

if ($backendOk) {
    Write-Host "[OK] Backend respondiendo en http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "[WAIT] Backend iniciando... Revisa $backendOut si tarda en responder." -ForegroundColor Yellow
}

$frontendOk = $false
try {
    $tcp = Test-NetConnection -ComputerName "localhost" -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($tcp) {
        $frontendOk = $true
    }
} catch {}

if ($frontendOk) {
    Write-Host "[OK] Frontend escuchando en http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "[WAIT] Frontend compilando... Revisa $frontendOut si tarda en responder." -ForegroundColor Yellow
}

Write-Host "`nServidores reiniciados correctamente." -ForegroundColor Green

