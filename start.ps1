# QATestUI - Starter completo (backend + frontend + runner agent)
# Uso: .\start.ps1  [-RunnerAgentPath "ruta\al\runner-agent"]

param(
  [string]$RunnerAgentPath = "C:\Users\$env:USERNAME\Desktop\Claro\TestQA\runner-agent"
)

$root = $PSScriptRoot
Clear-Host
Write-Host ""
Write-Host "  QATestUI - Karate Feature Generator" -ForegroundColor Cyan
Write-Host "  Backend + Frontend + Runner Agent"   -ForegroundColor DarkCyan
Write-Host ""

function Install-If-Needed {
  param([string]$Dir, [string]$Label)
  if (-not (Test-Path "$Dir\node_modules")) {
    Write-Host "  [npm] Instalando dependencias de $Label..." -ForegroundColor Yellow
    Push-Location $Dir
    npm install --silent
    Pop-Location
    Write-Host "  [OK] $Label listo" -ForegroundColor Green
  } else {
    Write-Host "  [OK] $Label - dependencias ya instaladas" -ForegroundColor DarkGreen
  }
}

# 1. Dependencias
Install-If-Needed "$root\backend"  "Backend"
Install-If-Needed "$root\frontend" "Frontend"

$runnerExists = Test-Path $RunnerAgentPath
if ($runnerExists) {
  Install-If-Needed $RunnerAgentPath "Runner Agent"
} else {
  Write-Host "  [--] Runner Agent no encontrado en: $RunnerAgentPath" -ForegroundColor DarkYellow
  Write-Host "       (el Feature Runner no estara disponible)" -ForegroundColor DarkYellow
}

Write-Host ""

# 2. Backend
Write-Host "  [>>] Iniciando Backend en http://localhost:3001 ..." -ForegroundColor Yellow
$backendCmd = "Set-Location '$root\backend'; node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
Start-Sleep -Seconds 2
Write-Host "  [OK] Backend en marcha" -ForegroundColor Green

# 3. Runner Agent (si existe)
if ($runnerExists) {
  Write-Host "  [>>] Iniciando Runner Agent en http://localhost:4000 ..." -ForegroundColor Yellow
  $agentCmd = "Set-Location '$RunnerAgentPath'; node agent.js"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $agentCmd -WindowStyle Normal
  Start-Sleep -Seconds 1
  Write-Host "  [OK] Runner Agent en marcha" -ForegroundColor Green
}

Write-Host ""

# 4. Abrir browser cuando el frontend esté listo
$browserScript = @"
`$url = 'http://localhost:3000'
for (`$i = 1; `$i -le 30; `$i++) {
    Start-Sleep -Seconds 2
    try {
        Invoke-WebRequest `$url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
        Start-Process `$url
        exit
    } catch {}
}
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $browserScript -WindowStyle Hidden

# 5. Frontend (en esta ventana)
Write-Host "  [>>] Iniciando Frontend en http://localhost:3000 ..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Ctrl+C  → detiene el frontend" -ForegroundColor DarkGray
Write-Host "  Cerra las otras ventanas para detener backend y agente." -ForegroundColor DarkGray
Write-Host ""
Set-Location "$root\frontend"
npm start