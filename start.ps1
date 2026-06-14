# ============================================================================
#  Lanzador — Quiniela Mundial 2026
#  Uso:  ./start.ps1
#  Producción: usa reloj real y carga local.env.ps1 si existe.
# ============================================================================
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Crea local.env.ps1 para guardar secretos locales sin subirlos a Git:
#   $env:FOOTBALL_DATA_TOKEN = "TU_TOKEN"
#   $env:ADMIN_USER = "jorge"
#   $env:ADMIN_PASS = "una-clave-fuerte"
$localEnv = Join-Path $root "local.env.ps1"
if (Test-Path $localEnv) {
  . $localEnv
}

$env:REAL_CLOCK = "1"

$port = if ($env:PORT) { $env:PORT } else { 8026 }
Write-Host "Arrancando Quiniela Mundial 2026 en http://localhost:$port" -ForegroundColor Green
Write-Host "Para exponerlo:  cloudflared tunnel --url http://localhost:$port" -ForegroundColor Cyan
node server.mjs
