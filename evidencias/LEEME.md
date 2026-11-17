# Evidencias verificadas y pendientes

Fecha: 16/11/2026. Preparación con Node 24.22.1 y PostgreSQL 17.11 nativo, iniciado en un entorno temporal para pruebas. Las fechas JSON están en UTC. No se utilizó un simulador de PostgreSQL. Los tests de `test/http.test.js` sí usan dobles de prueba y están etiquetados como tales.

## Incluidas (salidas reales)

- `pruebas-unitarias.txt`: 22 comprobaciones aprobadas, 0 fallos.
- `pruebas-integracion.txt`: 12 comprobaciones con PostgreSQL real, 0 fallos.
- `dependencias.txt`: árbol npm resuelto.
- `migracion-test.txt`, `migracion-demo.txt`, `migracion-repetida.txt`: ejecuciones administrativas.
- `http-postgresql-real.json`: versión de runtime/BD, endpoints, 503 antes de esquema, 200 después, 201/409/422 y comprobación de persistencia.
- `api-real.jsonl`: logs de peticiones y apagado ordenado.
- `verificacion-estatica.txt`: comprobación de sintaxis JS y lectura YAML, sin afirmar validación Docker.

## No ejecutadas / no incluidas como evidencia falsa

- Docker build, Compose y volumen Docker: no había Docker disponible.
- Scripts PowerShell: no se ejecutaron en un host Windows.
- Capturas de navegador: Chromium no pudo iniciarse en el entorno de preparación; no se sustituyen por maquetas.
- Conexión desde otra PC LAN: requiere la red del laboratorio.
- Repositorio Git remoto/commit y registry: no proporcionados; no publicado.

## Capturas a añadir al ejecutar en Windows

1. `01-dashboard.png`: navegador en localhost, conexión operativa, KPI, formulario y tabla.
2. `02-matricula-201.png`: consola JSON con request, HTTP 201 y requestId visibles.
3. `03-duplicado-409.png`: repetir la misma pareja; HTTP 409 y código DUPLICATE_ENROLLMENT.
4. `04-compose-salud.png`: `docker compose ps` con API y DB saludables.
5. `05-logs.png`: `docker compose logs --tail=100 api`, incluyendo el mismo requestId.
6. `06-persistencia.png`: matrícula aún presente después de `down` / `up`, sin `-v`.
7. `07-lan.png`: navegador en otra PC usando la IPv4 real del servidor.

Usa Win+Shift+S. No captures `.env` ni contraseñas. Los scripts generan evidencia textual real al ejecutarlos; agrega las capturas a la subcarpeta de esa ejecución.
