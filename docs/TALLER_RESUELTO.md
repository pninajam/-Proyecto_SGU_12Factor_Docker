# Taller práctico Semana 14 - SGU-UNJBG

**Curso:** Ingeniería de Software I. **Periodo:** 2026-II. **Fecha:** 16/11/2026.
**Base:** ZIP Proyecto_SGU_12Factor_Docker y guía didáctica adjunta. Datos ficticios.
**Producto:** código corregido, auditoría, cinco mejoras, pruebas, evidencias locales y procedimiento Windows reproducible. No publicado en registry.

## A1. Reconocer el dashboard

| Elemento | Respuesta a la pregunta guía |
|---|---|
| Estudiantes activos | Proviene de `/api/v1/dashboard`; no es un número fijo escrito en HTML. La semilla aporta 5 estudiantes activos. |
| Matrículas | Incrementa cuando un POST válido confirma la transacción. El panel vuelve a consultar los datos persistidos. |
| Vacantes | Es la suma de capacidad menos ocupación; inicialmente 100 (30+25+20+25). `FOR UPDATE`, validación y restricciones de BD evitan exceder el aforo por esta operación. |
| Formulario | Requiere `studentId` y `sectionId` enteros positivos; opciones del catálogo. |
| Consola JSON | Muestra request, estado HTTP, body y requestId. 201 significa recurso creado. |
| Tabla | GET de matrículas persistidas. Vuelve a consultar porque el servidor es la fuente de verdad y puede haber otros clientes. |

Flujo resuelto: navegador envía POST con JSON → Express asigna requestId y valida → servicio abre transacción → PostgreSQL bloquea sección, inserta matrícula y aumenta ocupación → COMMIT → API responde 201 → navegador refresca KPI y tabla. La base y sus credenciales permanecen en el servidor. El navegador solo conoce la API y los datos de demostración que recibe.

## A2. Explorar endpoints

| Método y ruta | Salida / función |
|---|---|
| GET `/health/live` | 200, `status: alive`; proceso HTTP vivo, no depende de PostgreSQL. |
| GET `/health/ready` | 200, `status: ready` cuando base y esquema están disponibles; 503 si faltan. |
| GET `/api/v1/catalog` | Estudiantes activos, secciones y periodo para el formulario. |
| GET `/api/v1/dashboard` | Indicadores y resumen por facultad/carrera. |
| GET `/api/v1/enrollments` | Hasta las últimas 100 matrículas persistidas. |
| POST `/api/v1/enrollments` | Crea matrícula; GET nunca la crea. |

Los resultados reales están en `evidencias/http-postgresql-real.json`; incluyen requestId. La semilla usa 2026-II. Tras una matrícula, quedan 1 matrícula y 99 vacantes, con 5 estudiantes y 4 secciones.

## A3. Auditoría

La matriz completa está en `12-factor-audit.md`: ocho factores cumplen en el alcance comprobado y cuatro son parciales. Faltan evidencia de repositorio, release Docker, escalado y paridad con producción. No se confunde código existente con una ejecución demostrada.

## A4. Priorizar brechas

Se aplicaron cinco mejoras: dependencias reproducibles; configuración estricta; errores y correlación seguros; readiness/migración consistente; cobertura de pruebas y procedimiento de evidencias. `MEJORAS_PRIORIZADAS.md` detalla problema, riesgo, archivo, responsable por rol y aceptación.

## B1. Configuración externa

`src/config.js` lee `process.env`. `required` exige valores no vacíos; `readInteger` valida cadena completa y límites. Puertos: 1 a 65535. Timeout: 1 a 2147483647 ms. `Object.freeze` impide modificar la configuración cargada. `DB_PASSWORD` se inyecta por `.env`, que está excluido de Git y de Docker.

En Compose, `DB_HOST=db` apunta al servicio PostgreSQL; `localhost` dentro de la API apuntaría al propio contenedor. `PORT` es el puerto interno y `HOST_PORT` el publicado en Windows. La contraseña ausente impide iniciar y el error menciona solo el nombre de la variable. Las pruebas automatizadas verificaron este comportamiento. El README contiene la demostración con `.env` y recreación del servicio.

## B2. Contrato HTTP y errores

| Caso | HTTP | Código / comportamiento |
|---|---|---|
| Matrícula creada | 201 | `data` con el registro y `requestId`. |
| ID inválido | 422 | `INVALID_STUDENT_ID` o `INVALID_SECTION_ID`. |
| Recurso inexistente | 404 | `STUDENT_NOT_FOUND` / `SECTION_NOT_FOUND`. |
| Duplicado | 409 | `DUPLICATE_ENROLLMENT`; conflicto previsto. |
| Sección llena / periodo cerrado | 409 | `NO_VACANCIES` / `PERIOD_CLOSED`. |
| Error inesperado | 500 | `INTERNAL_ERROR`, sin SQL ni stack en respuesta. |
| JSON malformado | 400 | `INVALID_JSON`, conserva requestId. |
| Cuerpo mayor a 32 KB | 413 | `PAYLOAD_TOO_LARGE`. |
| Base/esquema no disponible | 503 | `NOT_READY` en readiness. |

`AppError` conserva mensaje controlado, código y estado. `publicError()` oculta detalles de errores desconocidos. El middleware genera/valida el ID antes de parsear JSON. El log usa `request_id`, la respuesta `requestId` y la cabecera `x-request-id` con el mismo valor. El cliente puede enviar un ID seguro de hasta 100 caracteres; los demás se sustituyen por un UUID.

## B3. Transacción de matrícula

1. Validar ambos IDs antes de consultar.
2. Reservar conexión con `pool.connect()` y ejecutar BEGIN.
3. Consultar sección y periodo; `FOR UPDATE OF s` bloquea la fila de sección.
4. Verificar sección, periodo activo y estudiante activo.
5. Comprobar duplicado y vacantes disponibles.
6. INSERT de matrícula y UPDATE de ocupación en la misma transacción.
7. COMMIT confirma ambas escrituras.
8. Ante error, ROLLBACK revierte; finally libera la conexión.

Si INSERT se confirma sin UPDATE, el contador quedaría incorrecto. La transacción los hace atómicos. Dos solicitudes por la misma sección se serializan al adquirir el bloqueo; con una sola vacante, una obtiene 201 y la otra 409. La restricción UNIQUE de estudiante/sección protege además la unicidad en BD. Se verificó este escenario con PostgreSQL real; no es una prueba de escalado horizontal.

## B4. Pruebas ejecutadas

| Grupo | Resultado real | Evidencia |
|---|---|---|
| Configuración | 11 casos aprobados | `pruebas-unitarias.txt` |
| Contrato AppError | 2 casos aprobados | `pruebas-unitarias.txt` |
| HTTP sin BD (dobles) | 8 subcasos + test contenedor aprobados | `pruebas-unitarias.txt` |
| HTTP con PostgreSQL real | 11 subcasos + test contenedor aprobados | `pruebas-integracion.txt` |

El ejecutor reporta 22 + 12 = 34 comprobaciones aprobadas, cero fallos. Los dos tests contenedores también cuentan en el total de Node. La integración prueba matrícula válida, duplicada, estudiante/sección inexistentes, estudiante inactivo, sección llena, periodo cerrado, concurrencia por vacante, duplicados concurrentes, ID inválido y readiness.

Se utilizó Node 24.22.1 y PostgreSQL 17.11 local. Docker no estaba disponible. La prueba de 500 inyecta un error en el doble de conexión; no se añadió una ruta insegura para provocar errores en producción.

## C1. Configuración local

En PowerShell: `Copy-Item .env.example .env` y `notepad .env`; cambiar contraseña. Como alternativa, `scripts/iniciar.ps1` genera una local al crear `.env`. No adjuntar el archivo de secretos al informe ni a Git.

## C2. Construir y levantar

Ejecutar `docker compose config --quiet`, `docker compose up --build -d` y `docker compose ps`. El Dockerfile usa Node 24 Alpine, etapas build/runtime, `npm ci`, pruebas durante build y `USER node`. La imagen final incluye código y dashboard. `.dockerignore` excluye secretos, dependencias locales y evidencias.

Compose define API y PostgreSQL 17, espera el healthcheck de DB y configura volumen `sgu_data`. La API no se declara lista hasta que se ejecuta la migración. No usar `up --wait` antes de migrar una base vacía. Build y arranque Docker quedan pendientes de ejecución en Windows; no se adjunta una salida ficticia.

## C3. Migración

`docker compose exec -T api npm run migrate`. Es una tarea administrativa independiente que crea esquema, periodo, facultades, carreras, estudiantes y secciones. La mejora envuelve la operación en transacción y alinea secuencias de IDs con la semilla. Volver a ejecutarla no borra matrículas ni reinicia el contador de ocupación; se comprobó localmente. No sustituye un gestor de migraciones de producción.

## C4. Acceso por IP

`ipconfig` permite obtener la IPv4 del servidor. En él se usa `http://localhost:8080`; desde otra PC de la misma LAN, `http://IPV4:8080`. El README detalla la regla de firewall limitada al laboratorio. Prueba desde segunda PC pendiente; no hay IP inventada.

## C5. Entrada y salida

Entrada del POST: `{"studentId":1,"sectionId":1}`. En una base limpia produce 201 y un objeto `data` con `id`, `student_id`, `section_id`, `created_at`, más `requestId` fuera de data. Los IDs BIGINT se serializan como cadenas por el driver PostgreSQL: es esperado. La consola del dashboard permite mostrar request/response. La evidencia HTTP real conserva los valores generados por el servidor.

## C6. Errores previstos

Repetir la pareja produce 409 porque el conflicto de negocio está previsto. Usar ID 0 produce 422. Ambos escenarios se ejecutaron y guardaron, además de estar en las pruebas. El README usa `curl.exe --data-binary @solicitud.json` para evitar problemas de comillas en Windows.

## C7. Logs, apagado y persistencia

El logger escribe JSON a stdout con fecha, nivel, servicio y correlación. El apagado SIGTERM cierra HTTP y pool antes de terminar, con máximo de 10 segundos. La evidencia real contiene `shutdown_started` y `shutdown_completed`.

Se creó una matrícula, se repitió la migración, se detuvo/reinició Node y PostgreSQL usando el mismo directorio de datos y se recuperó la misma matrícula. **Esto demuestra persistencia local; no demuestra el volumen Docker.** Para ese requisito, ejecutar el script `scripts/evidencias.ps1`, que hace `down` y `up` sin `-v` y comprueba el ID. `down -v` borraría el volumen y los datos.

## C8. Registry

**No publicado.** No se proporcionó namespace ni cuenta. URL y digest: no disponibles. El tag configurado para build local es `sgu-unjbg/matricula-api:1.0.0`, pero no se ha construido aquí ni identifica una publicación. El README contiene login/build/push/inspect para registrar valores reales después. También queda pendiente el build local solicitado por la guía cuando no hay registry.

## Checklist P01-P12

| ID | Estado de esta entrega | Evidencia / siguiente acción |
|---|---|---|
| P01 Compose válido | Pendiente Docker | YAML inspeccionado; falta `docker compose config --quiet`. |
| P02 Build y arranque | Pendiente Docker | Dockerfile listo; no hay motor instalado aquí. |
| P03 API/DB saludables | Pendiente Docker | Salud local aprobada; falta `docker compose ps`. |
| P04 Readiness 200 | Aprobado local | Evidencia HTTP después de migrar; repetir en Docker. |
| P05 Dashboard abierto | Parcial | Archivos y endpoints entregados; captura visual pendiente. |
| P06 Matrícula 201 | Aprobado local | Evidencia HTTP + integración. |
| P07 Duplicado 409 | Aprobado local | Evidencia HTTP + integración. |
| P08 ID inválido 422 | Aprobado local | Evidencia HTTP + pruebas. |
| P09 Logs seguros | Aprobado local | JSON real y pruebas de ausencia de secretos; falta captura Compose. |
| P10 Volumen conserva datos | Parcial | Reinicio local aprobado; volumen Docker pendiente. |
| P11 Acceso LAN | Pendiente | Ejecutar desde segunda PC. |
| P12 Registry | No publicado | Sin cuenta/namespace; sin URL/digest. |

## Preguntas de cierre resueltas

**1. ¿Por qué la URL de BD no debe estar fija?** Porque host, puerto y credenciales cambian entre entornos. La configuración externa permite cambiar el servicio sin modificar código y evita incluir secretos en el repositorio.

**2. ¿Liveness y readiness?** Liveness indica que el proceso responde. Readiness comprueba si está preparado para atender funcionalmente, incluyendo base y esquema. Puede estar vivo y no listo.

**3. ¿Por qué el navegador no se conecta a PostgreSQL?** Expondría credenciales y permitiría omitir reglas y controles. La API valida entradas, ejecuta el negocio y limita los datos que devuelve.

**4. ¿Qué significan 201, 409, 422 y 500?** 201: recurso creado. 409: conflicto de negocio, como duplicado o falta de vacantes. 422: entrada no válida para la operación. 500: fallo inesperado interno con respuesta segura.

**5. ¿Qué garantiza la transacción y FOR UPDATE?** La transacción confirma o revierte conjuntamente matrícula y ocupación. FOR UPDATE bloquea la sección mientras se decide, evitando que solicitudes simultáneas usen la misma vacante con datos desactualizados.

**6. ¿Por qué logs a stdout/stderr?** Para que Docker o la plataforma los recolecte sin depender de archivos locales que se pierden al recrear el contenedor. JSON facilita búsqueda y correlación.

**7. ¿Qué conserva el volumen con down?** Los datos físicos de PostgreSQL, incluidas tablas y matrículas. Se eliminan contenedores y red de Compose, pero el volumen nombrado se mantiene. `down -v` sí lo elimina.

**8. ¿Por qué tag y digest son más trazables que latest?** Un tag de versión expresa la release, aunque puede reasignarse. El digest identifica exactamente el contenido. `latest` es mutable y no explica qué versión se ejecutó; fijar digest da identidad precisa.

**9. ¿Qué falta antes de datos reales y exposición?** Autenticación y autorización, HTTPS, mínimos privilegios, protección y rotación de secretos, validación de reglas institucionales, auditoría de accesos, backups probados, monitoreo, límites de recursos y tasa, análisis de dependencias, migraciones versionadas y evaluación de protección de datos. Este laboratorio no cubre esos requisitos de producción.

## Guion de sustentación (cinco minutos)

| Minuto | Qué mostrar / explicar |
|---|---|
| 0-1 | Caso SGU: navegador → API Node → PostgreSQL. Datos ficticios y límites del MVP. |
| 1-2 | Dashboard, cinco estudiantes iniciales y JSON de entrada. Catálogo desde API. |
| 2-3 | Enviar matrícula y repetir: 201/409; relacionar requestId con log. |
| 3-4 | Compose, readiness, volumen y resultado de reinicio, cuando se ejecute en Windows. |
| 4-5 | Auditoría, cinco mejoras y pendientes: release, escalado, LAN y seguridad productiva. |

## Conclusiones

1. Las variables externas permiten cambiar el entorno sin editar la lógica del sistema.
2. Los códigos HTTP distinguen errores de entrada, conflictos previstos y fallos internos.
3. La transacción y el bloqueo de sección evitan duplicados y sobrecupo en las pruebas ejecutadas.
4. Los logs con requestId permiten relacionar lo que recibe el cliente con lo que procesó la API.
5. La preparación para contenedores necesita demostrarse con el motor real; no basta con tener Dockerfile y Compose escritos.
