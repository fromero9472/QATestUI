# QATestUI - Starter (back + front)
# Uso: .\start.ps1
$root = $PSScriptRoot
Clear-Host
Write-Host ""
Write-Host "  QATestUI - Karate Feature Generator" -ForegroundColor Cyan
Write-Host "  Back + Front starter" -ForegroundColor DarkCyan
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
Write-Host ""
# 2. Backend en ventana separada
Write-Host "  [>>] Iniciando Backend en http://localhost:3001 ..." -ForegroundColor Yellow
$backendCmd = "Set-Location '$root\backend'; node server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
Start-Sleep -Seconds 2
Write-Host "  [OK] Backend en marcha" -ForegroundColor Green
# 3. Abrir navegador cuando el frontend este listo
Write-Host "  [>>] Esperando frontend para abrir el navegador..." -ForegroundColor Yellow
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
# 4. Frontend en esta ventana
Write-Host "  [>>] Iniciando Frontend en http://localhost:3000 ..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener el frontend." -ForegroundColor DarkGray
Write-Host "  Cerra la ventana del backend para detenerlo." -ForegroundColor DarkGray
Write-Host ""
Set-Location "$root\frontend"
npm start