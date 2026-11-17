# A3. Matriz de auditoría 12-Factor

Corte: 16/11/2026. “Cumple” se limita al alcance didáctico y a la evidencia indicada. La ejecución local no demuestra un despliegue Docker o productivo. El ZIP no trae historial Git, URL remota ni commit verificables.

| Factor | Estado | Evidencia concreta | Comando / prueba y justificación |
|---|---|---|---|
| 1. Codebase | Parcial | Código en una carpeta; sin repositorio/historial adjunto | En el repositorio del equipo: `git remote -v` y `git rev-parse HEAD`. URL y commit pendientes; no se inventaron. |
| 2. Dependencies | Cumple | `package.json`, `package-lock.json`, Dockerfile con `npm ci` | `npm ci` ejecutado; `evidencias/dependencias.txt`. Árbol real resuelto, no lockfile manual. |
| 3. Config | Cumple | `src/config.js`, `.env.example`, `.gitignore`, `.dockerignore` | `test/config.test.js`: contraseña ausente, puertos inválidos y timeout negativo rechazados; secretos externos. |
| 4. Backing services | Cumple | `src/db.js`, `DB_HOST`, servicio `db` | Integración real con PostgreSQL 17.11; `evidencias/http-postgresql-real.json`. Conexión por entorno, no fija. |
| 5. Build, release, run | Parcial | Dockerfile build/runtime; tag 1.0.0; migración separada | Etapas definidas y dependencias probadas. Build Docker y release con digest pendientes por falta de motor/registry. |
| 6. Processes | Cumple | Estado persistido en PostgreSQL, no en memoria de la API | Reinicio real Node + PostgreSQL conserva la matrícula: `persistence.pass=true` en evidencia HTTP. Prueba del volumen Docker pendiente. |
| 7. Port binding | Cumple | `src/server.js`: `0.0.0.0`, `PORT`; Compose publica `HOST_PORT` | HTTP real probado en puerto 8080. Acceso LAN no probado. |
| 8. Concurrency | Parcial | API sin sesión local; bloqueo de sección y pool de 10 conexiones | Integración prueba solicitudes simultáneas y evita sobrecupo. No equivale a escalado horizontal: faltan proxy, réplicas y prueba de carga. El puerto fijo impide `--scale api=2` tal cual. |
| 9. Disposability | Cumple | SIGTERM/SIGINT, límite de 10 s, cierre HTTP/pool | `evidencias/api-real.jsonl`: `shutdown_started` y `shutdown_completed`; reinicio local exitoso. |
| 10. Dev/prod parity | Parcial | Node 24 y PostgreSQL 17 declarados en Docker y pruebas | Mismas versiones principales y configuración externa. No hay entorno productivo ni digest inmutable; los tags base pueden cambiar. |
| 11. Logs | Cumple | `src/logger.js`, evento `request_completed` y errores seguros | JSON a stdout, nivel y `request_id`; HTTP prueba ausencia de secretos. `evidencias/api-real.jsonl`. |
| 12. Admin processes | Cumple | `src/scripts/migrate.js`, `npm run migrate` | Migración ejecutada aparte del servidor y repetida sin borrar matrículas; `evidencias/migracion-repetida.txt`. |

## Lectura del resultado

Ocho factores cumplen en el alcance demostrado y cuatro son parciales (1, 5, 8 y 10). Ninguno se marca “No aplica”: todos son pertinentes. No se afirma despliegue Cloud completo. “Cloud-Ready” significa que la aplicación facilita su configuración, ejecución, observación y operación en contenedores; todavía necesita controles y validaciones para producción.

## Mejora respecto de la matriz original

La matriz original solo enumeraba evidencias posibles y citaba un lockfile inexistente. Ahora distingue lo implementado, lo realmente ejecutado y las demostraciones pendientes. Se incorpora el lockfile obtenido con npm y los resultados reproducibles del taller.
