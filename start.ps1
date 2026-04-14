# ── QATestUI Start Script ──────────────────────────────────────────
Write-Host ""
Write-Host "  ⚡ QATestUI – Karate Feature Generator" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

$root = $PSScriptRoot

# Install backend dependencies
Write-Host "  [1/4] Instalando dependencias del backend..." -ForegroundColor Yellow
Set-Location "$root\backend"
npm install --silent
Write-Host "        ✔ Backend listo" -ForegroundColor Green

# Install frontend dependencies
Write-Host "  [2/4] Instalando dependencias del frontend..." -ForegroundColor Yellow
Set-Location "$root\frontend"
npm install --silent
Write-Host "        ✔ Frontend listo" -ForegroundColor Green

# Start backend in background
Write-Host "  [3/4] Iniciando backend en http://localhost:3001 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; node server.js" -WindowStyle Normal
Start-Sleep -Seconds 2
Write-Host "        ✔ Backend corriendo" -ForegroundColor Green

# Start frontend
Write-Host "  [4/4] Iniciando frontend en http://localhost:3000 ..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ✅ Todo listo. La app abrirá en tu navegador." -ForegroundColor Green
Write-Host "     Presioná Ctrl+C para detener el frontend." -ForegroundColor DarkGray
Write-Host ""

Set-Location "$root\frontend"
npm start

