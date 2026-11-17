# A4. Cinco mejoras priorizadas

Responsables expresados por rol porque no se facilitaron nombres del equipo. Los roles se pueden asignar al presentar; no se inventan autores.

| ID / prioridad | Problema y riesgo inicial | Cambio aplicado / archivo | Prueba de aceptación | Responsable |
|---|---|---|---|---|
| M1 / Alta | Sin lockfile; instalaciones podían resolver árboles diferentes. | `package-lock.json` real, Dockerfile usa `npm ci` en ambas etapas. | Instalación `npm ci` exitosa; `npm ls --all` sin dependencias inválidas. | DevOps / integración |
| M2 / Alta | `parseInt` aceptaba `8080abc`, decimales y valores fuera de rango. | `src/config.js`: cadena de dígitos, entero seguro y límites; `HOST_PORT` externo en Compose. | 11 casos de configuración: válidos pasan; contraseña ausente, puertos y timeout inválidos fallan. | Backend |
| M3 / Alta | Parser JSON previo al requestId; error 500 para JSON roto; ID ilimitado; logs con mensaje técnico que podía contener secretos. | `src/app.js`: correlación antes del parser, IDs de hasta 100 caracteres, 400/413 controlados, log HTTP final y eliminación del mensaje técnico libre. | HTTP JSON roto 400 con requestId, cuerpo grande 413, ID largo sustituido y error 500 sin secreto en respuesta ni log. | Backend + QA |
| M4 / Alta | Readiness decía listo con `SELECT 1` aun sin tablas; semillas con IDs explícitos dejaban secuencias atrasadas. | `src/db.js`: verifica esquema y devuelve 503 si falla. `migrate.js`: transacción y ajuste de secuencias; proceso administrativo separado. | 503 antes de migrar, 200 después; fixtures con IDs automáticos; repetir migración conserva matrícula. | Base de datos |
| M5 / Alta | Solo dos pruebas de errores; no había evidencia sobre matrícula y concurrencia. | `test/`, `integration/`, `compose.test.yaml`, scripts PowerShell y documentación. | 22 comprobaciones unitarias/HTTP y 12 de integración pasan. Dos solicitudes/una vacante producen 201+409 y una matrícula. Ejecución de scripts Windows pendiente. | QA + DevOps |

## Brechas que permanecen

Repositorio remoto y commit del equipo; build y despliegue con Docker Desktop; evidencia LAN; capturas de UI; publicación con digest; balanceador para réplicas; autenticación y autorización; HTTPS; roles de base de datos con mínimo privilegio; migraciones versionadas y coordinación; copias de seguridad y restauración; límites de tasa y recursos; monitoreo y manejo seguro de secretos. El usuario `POSTGRES_USER` del contenedor de laboratorio es administrador inicial: no se presenta como un usuario de producción de mínimo privilegio.
