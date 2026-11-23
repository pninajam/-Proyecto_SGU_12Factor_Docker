# Auditoría 12-Factor del proyecto SGU

| Factor | Evidencia en el proyecto | Cómo demostrarlo |
|---|---|---|
| I. Codebase | Repositorio único del servicio, commits y tags | `git log --oneline --decorate` |
| II. Dependencies | `package.json` y `package-lock.json` | `npm ci` |
| III. Config | `src/config.js`, `.env.example`, `env_file` de Compose | Cambiar `.env` sin reconstruir la imagen |
| IV. Backing services | PostgreSQL como servicio conectado por `DB_HOST=db` | `docker compose ps`; readiness |
| V. Build/release/run | Dockerfile build y runtime; migración como proceso puntual | `docker build`; `npm run migrate`; `docker compose up` |
| VI. Processes | API sin almacenar estado crítico en memoria local | Reiniciar API y verificar datos en PostgreSQL |
| VII. Port binding | `PORT`, `0.0.0.0`, `ports` | `curl localhost:8080/health/live` |
| VIII. Concurrency | Servicio HTTP sin sesión local; pool de conexiones | Escalar réplicas en una práctica ampliada |
| IX. Disposability | `SIGTERM`, cierre HTTP y `pool.end()` | `docker stop` y observar logs |
| X. Dev/prod parity | Mismo Dockerfile/imagen, configuración inyectada | Ejecutar misma imagen con distintos `.env` |
| XI. Logs | `src/logger.js` escribe JSON a stdout | `docker compose logs api` |
| XII. Admin processes | `src/scripts/migrate.js` es tarea puntual | `docker compose exec api npm run migrate` |

## Brechas deliberadas para discusión

- La autenticación y autorización no están implementadas: deben ser una mejora posterior.
- La migración es demostrativa y no sustituye una herramienta de migraciones versionadas.
- El ejemplo no implementa CI/CD ni escaneo/SBOM; se proponen como extensión.
- Para producción deben configurarse límites de recursos, políticas de red, backups, retención de logs, gestión de secretos y controles de acceso.


## Interfaz web y separación de responsabilidades

La interfaz HTML/CSS/JavaScript se publica como recurso estático desde Express. El navegador solo consume endpoints HTTP y no conoce credenciales ni dirección interna de PostgreSQL. Al usar rutas relativas (`/api/...`), la misma imagen puede atenderse por `localhost`, IP LAN o un nombre DNS sin recompilar el frontend. El puerto externo se configura mediante el mapeo `8080:8080` de Compose.
