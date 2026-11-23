# Guía de lectura línea por línea del código

El código ejecutable contiene comentarios junto a las instrucciones relevantes. Este documento complementa los archivos que no admiten comentarios nativos (por ejemplo, JSON) y explica el propósito de cada bloque.

## package.json

- `name`: nombre técnico del paquete/API.
- `version`: versión del MVP que se publicará.
- `private`: evita publicar accidentalmente el paquete en npm.
- `description`: propósito académico del servicio.
- `type: module`: habilita sintaxis ES Modules (`import`/`export`).
- `engines.node`: exige Node.js 24 o superior.
- `scripts.start`: inicia el proceso HTTP.
- `scripts.test`: ejecuta pruebas integradas de Node.
- `scripts.migrate`: ejecuta la tarea administrativa de creación del esquema.
- `dependencies.express`: framework HTTP.
- `dependencies.pg`: cliente PostgreSQL para Node.

## .env.example

Cada línea representa una variable de configuración inyectada en ejecución:
- `APP_ENV`: etiqueta del entorno.
- `PORT`: puerto HTTP interno.
- `DB_HOST`: hostname del servicio de base de datos; en Compose es `db`.
- `DB_PORT`: puerto TCP de PostgreSQL.
- `DB_DATABASE`: nombre de base de datos.
- `DB_USERNAME`: usuario de conexión.
- `DB_PASSWORD`: secreto local de ejemplo; debe reemplazarse.
- `DB_CONNECT_TIMEOUT_MS`: límite de espera al abrir conexión.

## Dockerfile

- `FROM node:24-alpine AS build`: crea la etapa que instala dependencias y prueba el código.
- `WORKDIR /app`: fija el directorio de trabajo.
- `COPY package*.json ./`: copia manifiestos antes del código para aprovechar caché.
- `RUN npm ci`: instala versiones exactas del lockfile.
- `COPY src ./src`: copia el código fuente.
- `RUN npm test`: impide producir imagen si las pruebas fallan.
- Segundo `FROM`: inicia una etapa limpia de runtime.
- `ENV NODE_ENV=production`: configura comportamiento productivo.
- `COPY package*.json ./`: permite instalar dependencias de runtime.
- `RUN npm ci --omit=dev`: excluye dependencias de desarrollo.
- `COPY --from=build`: copia código validado desde builder.
- `EXPOSE 8080`: documenta el puerto del servicio.
- `USER node`: evita ejecutar como root.
- `CMD`: inicia el proceso principal y permite recibir señales.

## compose.yaml

- `services`: agrupa contenedores del entorno.
- `api`: define el servicio HTTP.
- `build.context`: raíz enviada al motor de Docker.
- `build.dockerfile`: archivo de construcción.
- `image`: nombre y tag local de la imagen.
- `ports`: mapea puerto del host al contenedor.
- `env_file`: inyecta configuración al arranque.
- `depends_on.condition`: espera la salud de PostgreSQL.
- `restart`: política de reinicio ante fallos.
- `healthcheck`: ejecuta comprobación de readiness.
- `db`: backing service PostgreSQL.
- `environment`: inicializa base, usuario y contraseña desde variables.
- `volumes`: conserva datos fuera del ciclo de vida del contenedor.
- `healthcheck` de db: usa `pg_isready`.
- `volumes.sgu_data`: volumen nombrado persistente.

## src/config.js

Lee y valida la configuración una sola vez al inicio. `required()` evita que el proceso arranque con variables obligatorias vacías; `readInteger()` rechaza valores que no sean enteros. `Object.freeze()` evita que otro módulo modifique accidentalmente la configuración compartida.

## src/logger.js

Construye un evento JSON con fecha, nivel, servicio, entorno, nombre del evento y contexto. Escribe a stdout, no a un archivo local, para que Docker/infraestructura recolecte el flujo. No deben agregarse contraseñas ni payloads sensibles al contexto.

## src/errors.js

`AppError` representa errores esperados del dominio y conserva estado/código HTTP. `publicError()` expone mensajes controlados para errores conocidos y una respuesta genérica para excepciones desconocidas, evitando filtrar SQL o stack traces.

## src/db.js

Crea un pool compartido de PostgreSQL con host, puerto, base, usuario y contraseña provenientes de la configuración. `checkDatabase()` ejecuta `SELECT 1` para readiness.

## src/enrollment-service.js

1. Valida `studentId` y `sectionId`.
2. Obtiene una conexión del pool.
3. Inicia una transacción.
4. Bloquea la sección con `FOR UPDATE` para serializar la asignación de vacantes.
5. Verifica sección, periodo activo y estudiante activo.
6. Evita duplicados y comprueba vacantes.
7. Inserta matrícula e incrementa `enrolled` dentro de la misma transacción.
8. Confirma con `COMMIT`; ante error ejecuta `ROLLBACK`.
9. Libera la conexión en `finally`.

## src/app.js

Configura Express, parser JSON, `requestId`, endpoints de liveness/readiness, endpoint de creación de matrícula, respuesta 404 y middleware central de errores. El identificador de petición permite correlacionar la respuesta con los logs.

## src/server.js

Crea el servidor HTTP, escucha en `0.0.0.0`, registra el arranque y atiende `SIGTERM`/`SIGINT`. El cierre deja de aceptar conexiones y cierra el pool para no abandonar conexiones abiertas.

## src/scripts/migrate.js

Es un proceso administrativo puntual. Crea tablas con claves, restricciones y unicidad, además de datos ficticios. Se ejecuta manualmente o desde CI; no se ejecuta en cada petición HTTP.

## test/domain.test.js

Prueba el contrato público de errores conocidos y verifica que un error inesperado con texto SQL no filtre ese contenido al consumidor.

## Limitación de JSON

`package.json` y `package-lock.json` son JSON estricto y no permiten comentarios. Por ello, su explicación está aquí, en vez de introducir comentarios que invalidarían los archivos.

## Nota de reproducibilidad de dependencias

El manifiesto fija versiones exactas de Express y pg. El archivo `package-lock.json` debe generarse con `npm install` y versionarse antes de considerar el build plenamente reproducible. Una vez creado, el equipo debe cambiar `npm install` por `npm ci` en las dos etapas del Dockerfile. No se debe fabricar manualmente un lockfile sin metadatos e integridades verificables.


## Interfaz web: carpeta public

La carpeta `public` contiene los recursos que Express entrega al navegador. Se sirve desde el mismo origen y puerto de la API, por lo que no hace falta configurar CORS para este laboratorio.

### public/index.html

- `<!doctype html>`: declara un documento HTML5.
- `<html lang="es">`: informa que el contenido está en español.
- `meta charset`: habilita tildes y caracteres especiales.
- `meta viewport`: adapta el ancho al dispositivo.
- `meta description`: agrega una descripción de la página.
- `title`: establece el título de la pestaña.
- `link rel="stylesheet"`: carga el diseño desde `styles.css`.
- `script defer`: carga `app.js` después de analizar el HTML.
- `main.shell`: contiene toda la pantalla.
- `header.topbar`: presenta el nombre del SGU y la conexión.
- `section.metrics`: muestra salud, estudiantes, secciones y matrículas.
- `form#enrollmentForm`: recibe `studentId` y `sectionId`.
- `pre#jsonOutput`: muestra la solicitud y respuesta JSON con formato.
- `table#enrollmentRows`: presenta las matrículas persistidas.
- `section.flow-panel`: ilustra navegador, API, base de datos y respuesta.

### public/styles.css

El archivo CSS está comentado por bloques. `:root` define tipografía y fondo; `.shell` centra la pantalla; `.metrics` y `.workspace` crean cuadrículas; `.panel` aplica tarjetas; `.json-view` simula una consola; `.table-wrap` permite desplazamiento horizontal; `.flow-panel` dibuja el flujo de arquitectura; y `@media` adapta la interfaz a dispositivos pequeños.

### public/app.js

- `API`: usa cadena vacía para llamar al mismo host/IP que sirvió la página.
- `querySelector`: obtiene los controles HTML que se actualizarán.
- `showJson`: serializa objetos con sangría para visualizar el contrato JSON.
- `showFeedback`: muestra el resultado de cada operación.
- `getJson`: ejecuta GET, interpreta JSON y comprueba `response.ok`.
- `loadHealth`: consulta `/health/ready` y actualiza el indicador de conexión.
- `loadCatalog`: consulta `/api/v1/catalog` y llena los selectores con datos reales.
- `loadEnrollments`: consulta `/api/v1/enrollments` y dibuja la tabla usando `textContent`.
- `initialize`: carga salud, catálogos y registros al abrir la página.
- `form.addEventListener`: intercepta el envío, prepara el JSON, ejecuta POST y presenta status, request ID y cuerpo de respuesta.
- `finally`: vuelve a habilitar el botón aunque ocurra un error.
- `refreshButton`: actualiza los registros sin recargar el navegador.
- `initialize()`: inicia el panel.

### Endpoints adicionales de lectura

`GET /api/v1/catalog` consulta estudiantes activos y secciones de periodos activos. `GET /api/v1/enrollments` consulta matrículas unidas a estudiante, curso y periodo. Ambos devuelven `{ data, requestId }` y pasan los errores al middleware central.

### Prueba desde otra computadora

1. Ejecutar `docker compose up --build -d` en el servidor.
2. Ejecutar `docker compose exec api npm run migrate` una vez.
3. Identificar la IP LAN del servidor (`ipconfig` en Windows o `ip addr` en Linux).
4. Autorizar TCP/8080 en el firewall del servidor.
5. En un equipo de la misma red abrir `http://IP_DEL_SERVIDOR:8080`.
6. Registrar una matrícula y observar el JSON, HTTP 201 y la fila agregada.
7. Repetir la misma matrícula: debe observarse HTTP 409 por duplicidad.

La IP no se fija en el código. Se accede mediante la IP o DNS del host Docker, lo que permite mover el proyecto sin reconstruir la interfaz. Para exponerlo fuera de una red controlada se requiere HTTPS, autenticación, autorización y controles de seguridad; este prototipo no implementa esos controles.


## Dashboard académico: explicación de los componentes

### `public/index.html`
- `.app-shell`: organiza navegación lateral y área principal.
- `.sidebar`: identidad institucional de demostración, perfil y navegación.
- `.kpi-grid`: presenta estudiantes activos, matrículas, vacantes y secciones.
- `#resumen`: tabla jerárquica por facultad y escuela profesional.
- `#enrollmentForm`: recoge estudiante y sección para el POST.
- `#jsonOutput`: presenta el objeto enviado y la respuesta del servidor.
- `#enrollmentRows`: lista registros persistidos.
- `#arquitectura`: resume el flujo cliente, API, dominio y PostgreSQL.

### `public/styles.css`
- `:root`: tipografía y paleta académica.
- `.app-shell` y `.sidebar`: composición de la navegación lateral.
- `.kpi-card`: tarjetas de indicadores con acentos de color.
- `.academic-table`: tabla de resumen y registros.
- `.two-column`: disposición de entrada y salida.
- `.json-console`: consola de inspección JSON.
- `@media`: adaptación a resoluciones menores.

### `public/app.js`
- `getJson()`: ejecuta GET, interpreta JSON y valida el estado HTTP.
- `loadHealth()`: consulta readiness de API y PostgreSQL.
- `loadCatalog()`: carga estudiantes y secciones en los selectores.
- `loadDashboard()`: consume `/api/v1/dashboard`, actualiza KPI y dibuja facultades/carreras.
- `loadEnrollments()`: recupera matrículas persistidas.
- `refreshDashboard()`: coordina la actualización de todos los paneles.
- Listener `submit`: crea el objeto de entrada, envía POST y muestra status, request ID y JSON.

### `GET /api/v1/dashboard`
1. Obtiene el periodo activo.
2. Calcula estudiantes activos, matrículas, secciones y vacantes.
3. Agrupa escuelas profesionales bajo cada facultad.
4. Convierte los resultados numéricos de PostgreSQL a `Number`.
5. Devuelve `data` y `requestId` para mantener trazabilidad.

### Tablas agregadas para la demostración
- `faculties`: facultades ficticias.
- `careers`: escuelas profesionales asociadas a facultades.
- `students.career_id`: carrera del estudiante.
- `sections.career_id`: carrera a la que pertenece la sección.

### Guion sugerido de demostración
1. Explicar los KPI y el periodo académico.
2. Consultar `/api/v1/dashboard` y observar su JSON.
3. Registrar una matrícula y mostrar HTTP 201.
4. Explicar cómo cambian matrículas y vacantes.
5. Repetir la misma matrícula y explicar HTTP 409.
6. Relacionar `requestId` con `docker compose logs -f api`.

Los datos de facultades, carreras, estudiantes y secciones son ficticios y no representan cifras oficiales de la UNJBG.
