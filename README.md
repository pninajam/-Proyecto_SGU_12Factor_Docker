# SGU-UNJBG - Taller Semana 14 resuelto

Proyecto base conservado y ampliado según el PDF del taller: dashboard, API REST, PostgreSQL, auditoría de los 12 factores, cinco mejoras y evidencias verificadas.

**Empieza por `INFORME_TALLER_RESUELTO.pdf`.** La resolución editable está en `docs/TALLER_RESUELTO.md`. El estado real de las comprobaciones está en `evidencias/LEEME.md`. Datos ficticios; no es un sistema institucional de producción.

## Inicio rápido en Windows

1. Instala e inicia Docker Desktop con contenedores Linux. Abre PowerShell dentro de esta carpeta (la que contiene `compose.yaml`).
2. Ejecuta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\iniciar.ps1
```

Este comando solo aplica la política a ese proceso. El script crea `.env` si falta, genera una contraseña local, construye, levanta los servicios, migra y abre el navegador. No sobrescribe un `.env` existente. No requiere Node local.

**Alternativa manual:**

```powershell
docker --version
docker compose version
docker info
Copy-Item .env.example .env
notepad .env
# Cambia DB_PASSWORD por una contraseña de laboratorio.
docker compose config --quiet
docker compose up --build -d
docker compose exec -T api npm run migrate
docker compose ps
Start-Process 'http://localhost:8080'
```

Antes de migrar, readiness devuelve 503: el proceso vive, pero aún no existen las tablas. Después de migrar, espera un ciclo de healthcheck (10 segundos). `api` y `db` deben estar saludables. Si 8080 está ocupado cambia `HOST_PORT=8081` en `.env`, recrea con `docker compose up -d` y usa http://localhost:8081.

## Probar endpoints y matrícula

```powershell
curl.exe -i http://localhost:8080/health/live
curl.exe -i http://localhost:8080/health/ready
curl.exe -i http://localhost:8080/api/v1/catalog
curl.exe -i http://localhost:8080/api/v1/dashboard
curl.exe -i http://localhost:8080/api/v1/enrollments
'{"studentId":1,"sectionId":1}' | Set-Content -Encoding ascii solicitud.json
curl.exe -i -X POST http://localhost:8080/api/v1/enrollments -H 'Content-Type: application/json' --data-binary '@solicitud.json'
# Repite el mismo POST para observar 409.
```

Se usa un archivo JSON para evitar diferencias de comillas entre Windows PowerShell y PowerShell 7. La primera petición es 201 solo si esa pareja no está matriculada y hay vacantes. ID 0 produce 422; recurso inexistente 404; JSON roto 400; cuerpo mayor de 32 KB 413; error inesperado 500. Respuestas y logs comparten `requestId`/`request_id`.

## Pruebas automatizadas

Con Node 24 instalado:

```powershell
npm ci
npm test
```

22 comprobaciones aprobadas (incluye un test contenedor con 8 subpruebas). La construcción Docker también las ejecuta. Integración real y aislada en PostgreSQL 17:

```powershell
docker compose -p sgu-pruebas -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p sgu-pruebas -f compose.test.yaml down
```

12 comprobaciones de integración (11 casos y su test contenedor), incluida concurrencia. El entorno de pruebas tiene base `sgu_test`, datos temporales y no utiliza el volumen de demostración. No ejecutes `npm run test:integration` contra una base con datos reales. La suite exige que el nombre termine en `_test`.

## Evidencias Docker y persistencia

Sobre una pareja aún sin matricular (por ejemplo estudiante 2/sección 1):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\evidencias.ps1 -StudentId 2 -SectionId 1
```

El script registra HTTP 201/409/422, logs, estado y persistencia tras `down`/`up`. No elimina volúmenes. Si ya usaste esa pareja, elige otra del catálogo. Para otro puerto agrega `-BaseUrl http://localhost:8081`.

```powershell
docker compose logs --tail=100 api
docker compose down
docker compose up -d
```

`down` conserva `sgu_data`; **`down -v` borra los datos** y no es parte de la verificación normal. Cambiar DB_PASSWORD no cambia automáticamente la contraseña de un volumen ya inicializado.

## Configuración fallida (B1)

Guarda copia local del `.env`, elimina temporalmente la línea DB_PASSWORD y ejecuta `docker compose up -d --force-recreate api`; consulta `docker compose logs --tail=50 api`. Debe aparecer `Falta la variable obligatoria DB_PASSWORD.`. Restaura la línea y recrea otra vez. No publiques `.env`, ni captures `docker compose config` sin filtrar: puede mostrar la contraseña resuelta. Usa `config --quiet` para validar.

## Acceso desde otra PC

Ejecuta `ipconfig`, identifica la IPv4 de la tarjeta LAN y abre `http://IPV4:8080` en otra PC de la misma red. Si Windows bloquea la conexión, permite TCP 8080 solo en perfil privado y subred local (PowerShell administrador):

```powershell
New-NetFirewallRule -DisplayName 'SGU laboratorio 8080' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Private -RemoteAddress LocalSubnet
```

Adapta el puerto si lo cambiaste. No abras el router a Internet. Al terminar puedes retirar la regla con `Remove-NetFirewallRule -DisplayName 'SGU laboratorio 8080'`.

## Registry (no publicado)

No se suministró cuenta ni namespace. No hay URL ni digest publicados. Con tu cuenta real, sustituye TU_USUARIO:

```powershell
docker login
docker build -t TU_USUARIO/sgu-matricula-api:1.0.0 .
docker push TU_USUARIO/sgu-matricula-api:1.0.0
docker image inspect TU_USUARIO/sgu-matricula-api:1.0.0 --format '{{json .RepoDigests}}'
```

Registra la URL real del repositorio, tag y digest devuelto tras el push. No confundas el ID local de imagen con el digest publicado.

## Archivos principales

- `src/`, `public/`: aplicación y dashboard originales con mejoras del taller.
- `test/`: configuración, contrato de errores y HTTP con dobles de prueba.
- `integration/`: matrícula, errores y concurrencia con PostgreSQL real.
- `Dockerfile`, `compose.yaml`, `compose.test.yaml`: construcción y orquestación.
- `package-lock.json`: árbol real obtenido con npm; Docker usa `npm ci`.
- `docs/12-factor-audit.md`: matriz de doce factores con estados justificados.
- `docs/MEJORAS_PRIORIZADAS.md`: cinco mejoras, riesgos, responsables por rol y aceptación.
- `docs/TALLER_RESUELTO.md`: actividades A1-C8, cierre y guion de exposición.
- `evidencias/`: salidas reales de las pruebas y registro de limitaciones.

## Estado verificado de esta entrega

Node 24.22.1 y PostgreSQL 17.11 ejecutados localmente en el entorno de preparación: 22 comprobaciones unitarias/HTTP + 12 de integración aprobadas. Se comprobaron endpoints, migración, concurrencia y persistencia tras reiniciar procesos. **Docker no está instalado en ese entorno: el build, Compose, volumen Docker y LAN deben verificarse en tu Windows.** No se pudo ejecutar el navegador para tomar capturas; se incluye una lista precisa de las capturas pendientes. No publicado en registry. Los scripts PowerShell están preparados, pero no se ejecutaron en Windows durante esta entrega.
