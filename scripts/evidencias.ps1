param([int]$StudentId = 1, [int]$SectionId = 1, [string]$BaseUrl = 'http://localhost:8080')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$folder = Join-Path 'evidencias' ('windows-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $folder | Out-Null
function Docker-Check {
    docker @args
    if ($LASTEXITCODE -ne 0) { throw 'Fallo Docker. Revise la salida.' }
}
function Http-Case($name, $body, $expected) {
    $inputPath = Join-Path $folder "$name-request.json"
    $outputPath = Join-Path $folder "$name-response.json"
    [IO.File]::WriteAllText((Join-Path (Get-Location) $inputPath), $body, (New-Object Text.UTF8Encoding($false)))
    $status = curl.exe -sS -o $outputPath -w '%{http_code}' -X POST "$BaseUrl/api/v1/enrollments" -H 'Content-Type: application/json' --data-binary "@$inputPath"
    if ($LASTEXITCODE -ne 0) { throw "Fallo de conexion: $name" }
    $status | Set-Content (Join-Path $folder "$name-status.txt")
    if ([int]$status -ne $expected) { throw "$name devolvio $status; se esperaba $expected. Use una pareja sin matricular." }
    return (Get-Content $outputPath -Raw | ConvertFrom-Json)
}
Docker-Check compose config --quiet
Docker-Check compose ps | Out-File (Join-Path $folder 'compose-ps.txt')
Invoke-RestMethod "$BaseUrl/health/ready" | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $folder 'health.json')
$payload = @{ studentId = $StudentId; sectionId = $SectionId } | ConvertTo-Json -Compress
$created = Http-Case '201' $payload 201
$duplicate = Http-Case '409' $payload 409
$invalid = Http-Case '422' ('{"studentId":0,"sectionId":' + $SectionId + '}') 422
Docker-Check compose logs --no-color --tail=200 api | Out-File (Join-Path $folder 'logs-antes.txt')
Docker-Check compose down
Docker-Check compose up -d
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
    try { if ((Invoke-RestMethod "$BaseUrl/health/ready").status -eq 'ready') { $ready = $true; break } }
    catch { Start-Sleep -Seconds 2 }
}
if (-not $ready) { throw 'No se recupero readiness tras reiniciar.' }
$after = Invoke-RestMethod "$BaseUrl/api/v1/enrollments"
$after | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $folder 'matriculas-despues.json')
if (-not ($after.data | Where-Object { $_.id -eq $created.data.id })) { throw 'No se encontro la matricula despues del reinicio.' }
Docker-Check compose logs --no-color --tail=200 api | Out-File (Join-Path $folder 'logs-despues.txt')
'APROBADO: 201, 409, 422 y persistencia de la matricula ' + $created.data.id | Set-Content (Join-Path $folder 'resultado.txt')
Write-Host "Evidencias guardadas en $folder. Agregue capturas del navegador y prueba desde otra PC."
