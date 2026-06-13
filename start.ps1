# ============================================================================
#  Lanzador — Quiniela Mundial 2026
#  Uso:  ./start.ps1            (datos de ejemplo, reloj simulado)
#  Producción: define las variables antes de lanzar (ver README.md).
# ============================================================================
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Descomenta y ajusta para producción:
# $env:ADMIN_USER = "jorge"
# $env:ADMIN_PASS = "una-clave-fuerte"
# $env:FOOTBALL_DATA_TOKEN = "TU_TOKEN"
# $env:REAL_CLOCK = "1"

$port = if ($env:PORT) { $env:PORT } else { 8026 }
Write-Host "Arrancando Quiniela Mundial 2026 en http://localhost:$port" -ForegroundColor Green
Write-Host "Para exponerlo:  cloudflared tunnel --url http://localhost:$port" -ForegroundColor Cyan
node server.mjs
