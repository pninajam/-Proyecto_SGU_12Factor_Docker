$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path '.env')) {
    $secret = [guid]::NewGuid().ToString('N')
    (Get-Content '.env.example') -replace '^DB_PASSWORD=.*$', "DB_PASSWORD=$secret" | Set-Content '.env' -Encoding ascii
}
function Run-Docker {
    docker @args
    if ($LASTEXITCODE -ne 0) { throw 'Fallo Docker. Revise el mensaje anterior.' }
}
Run-Docker info --format '{{.ServerVersion}}'
Run-Docker compose config --quiet
Run-Docker compose up --build -d
# La API puede figurar unhealthy hasta aplicar la migración: es intencional.
Run-Docker compose exec -T api npm run migrate
$hostPort = ((Get-Content '.env' | Where-Object { $_ -match '^HOST_PORT=' }) -replace '^HOST_PORT=', '').Trim()
if (-not $hostPort) { $hostPort = '8080' }
$base = "http://localhost:$hostPort"
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $health = Invoke-RestMethod "$base/health/ready"
        if ($health.status -eq 'ready') { $ready = $true; break }
    } catch { Start-Sleep -Seconds 2 }
}
if (-not $ready) { throw 'La API no esta lista. Ejecute docker compose logs api db.' }
Run-Docker compose ps
Start-Process $base
Write-Host "Proyecto listo en $base"
