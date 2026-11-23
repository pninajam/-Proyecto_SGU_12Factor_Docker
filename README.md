# Sistema de Gestión Universitaria UNJBG – Módulo de Matrícula

Proyecto didáctico de la Semana 14 de Ingeniería de Software I. Implementa un servicio REST mínimo para aplicar 12-Factor App, manejo de errores, logs, Docker, Compose y Container Registry.

## 1. Requisitos

- Docker Engine o Docker Desktop con Docker Compose.
- Git.
- Acceso a un Container Registry para el ejercicio de publicación.
- Node.js 24 solo si se desea ejecutar pruebas fuera de Docker.

## 2. Preparación local

1. Copiar `.env.example` a `.env`.
2. Cambiar `DB_PASSWORD` por una contraseña local de laboratorio.
3. No subir `.env` al repositorio.
4. Construir y levantar el entorno:

```bash
docker compose up --build -d
```

5. Ejecutar la migración:

```bash
docker compose exec api npm run migrate
```

6. Consultar readiness:

```bash
curl http://localhost:8080/health/ready

# Abrir la interfaz visual
# http://localhost:8080
```

## 3. Interfaz visual en el navegador

Con los contenedores iniciados y la migración ejecutada, abrir:

- En el mismo equipo: `http://localhost:8080`
- Desde otro equipo de la misma red: `http://IP_DEL_SERVIDOR:8080`

La IP debe ser la dirección LAN del equipo donde corre Docker. El firewall debe permitir TCP/8080 y Docker debe publicar el puerto (Compose ya configura `8080:8080`). No usar `localhost` desde otro equipo: allí `localhost` apunta al propio equipo cliente. Si ya ejecutaste una versión anterior, vuelve a correr `docker compose exec api npm run migrate` para incorporar las tablas académicas y catálogos demostrativos.

El dashboard presenta navegación lateral, cuatro KPI (estudiantes activos, matrículas registradas, vacantes disponibles y secciones activas), resumen por facultad y escuela profesional, formulario de matrícula, inspección de JSON request/response y tabla de trazabilidad. Los indicadores se obtienen mediante `GET /api/v1/dashboard`; la interfaz consume la API REST y no accede directamente a PostgreSQL. Los nombres y cantidades son datos ficticios de laboratorio.

Rutas visuales/API:

- `GET /` — interfaz HTML.
- `GET /health/ready` — disponibilidad de API y PostgreSQL.
- `GET /api/v1/catalog` — estudiantes y secciones activas.
- `GET /api/v1/dashboard` — KPI y resumen por facultad/escuela profesional.
- `GET /api/v1/enrollments` — últimas matrículas registradas.
- `POST /api/v1/enrollments` — crear matrícula.

## 4. Crear una matrícula

```bash
curl -X POST http://localhost:8080/api/v1/enrollments \
  -H "Content-Type: application/json" \
  -d '{"studentId":1,"sectionId":1}'
```

La primera matrícula debe responder HTTP 201. Una segunda matrícula del mismo estudiante y sección debe responder HTTP 409.

## 5. Operación y diagnóstico

```bash
docker compose ps
docker compose logs -f api
docker compose logs db
docker compose down
```

`docker compose down` conserva el volumen de PostgreSQL. Para borrar también los datos de laboratorio, ejecutar `docker compose down -v`.

## 6. Pruebas

Con Node.js 24 instalado localmente:

```bash
npm install
npm test
```

La etapa `build` del Dockerfile ejecuta las pruebas antes de generar la imagen final.

## 7. Publicación en registry

Reemplazar `REGISTRY_HOST/ORGANIZACION` por el namespace real al que el equipo tiene acceso:

```bash
docker login REGISTRY_HOST
docker build -t REGISTRY_HOST/ORGANIZACION/sgu-matricula-api:1.0.0 .
docker push REGISTRY_HOST/ORGANIZACION/sgu-matricula-api:1.0.0
docker image inspect REGISTRY_HOST/ORGANIZACION/sgu-matricula-api:1.0.0
```

Registrar en el informe la URL, tag y digest real. Nunca colocar credenciales en Dockerfile, compose.yaml, repositorio o argumentos de build.

## 8. Alcance didáctico y limitaciones

- Los estudiantes y la sección son datos ficticios de laboratorio.
- La migración crea datos de demostración; no es un mecanismo de migraciones de producción.
- La API es un MVP educativo, no un sistema institucional listo para producción.
- Antes de producción se requieren autenticación, autorización, auditoría formal, protección contra abuso, migraciones versionadas, observabilidad completa, gestión de secretos y revisión de seguridad.
- La lógica de matrícula usa una transacción y bloqueo de fila para proteger la disponibilidad de vacantes.

## 9. Lockfile y reproducibilidad

Para completar la práctica de dependencias reproducibles, ejecutar `npm install` con acceso al registro npm. Esto genera `package-lock.json`. Versionar ese archivo y cambiar las instrucciones `npm install` del Dockerfile por `npm ci` (en ambas etapas). Así la instalación queda fijada por el lockfile. El entorno de generación de este material no tuvo acceso al registro npm para resolver las dependencias transitivas y, por eso, el proyecto no incluye un lockfile inventado.

## Guía de ejecución del taller

Consulta `docs/TALLER_PRACTICO_SEMANA14.md` para comandos rápidos. La guía docente completa desarrolla actividades, explicación de código, resultados esperados, puntos de control, solución de problemas y rúbrica.


## Administración académica ampliada

Esta versión incorpora pgAdmin 4 (`http://localhost:5050`), CRUD paginado para periodos, facultades, escuelas, estudiantes y secciones, reportes agregados y exportación Excel (`.xlsx`). Consulta `docs/ADMINISTRACION_PGADMIN_CRUD_REPORTES.md`.

**Seguridad:** prototipo académico sin autenticación/autorización en los módulos CRUD. No publicar en Internet ni cargar datos personales reales.


## Mejora de CRUD y reportes PDF/Excel

### CRUD mejorado
Los módulos de periodos académicos, facultades, escuelas profesionales, estudiantes y secciones incorporan búsqueda, paginación, ordenamiento por campos permitidos, formularios de alta/edición, confirmación de eliminación y validaciones de longitudes/tipos. Las restricciones de integridad referencial de PostgreSQL se mantienen vigentes.

### Visor PDF
El dashboard incorpora un visor PDF integrado mediante un cuadro de diálogo con `iframe`. Permite previsualizar los reportes sin salir de la interfaz y descargar el mismo documento.

### Reportes PDF
- `GET /api/v1/reports/summary.pdf`: reporte ejecutivo general.
- `GET /api/v1/reports/:resource.pdf`: reporte de una entidad.
- Añadir `?download=1` para forzar descarga; por defecto se visualiza en el navegador.

### Exportación Excel por entidad
- `GET /api/v1/reports/:resource.xlsx`: libro XLSX individual.
- `GET /api/v1/reports/export.xlsx`: libro consolidado, una hoja por entidad.

Recursos de reporte: `academic_periods`, `faculties`, `careers`, `students`, `sections` y `enrollments`.

### Actualizar contenedores
```powershell
# Verificar la configuración de Docker Compose.
docker compose config

# Reconstruir la API con PDFKit y las mejoras de reportes.
docker compose up --build -d

# Verificar el estado de API, PostgreSQL y pgAdmin.
docker compose ps

# Revisar los registros de la API si fuera necesario.
docker compose logs --tail 100 api
```

No se requiere una migración nueva para los reportes: reutilizan las tablas existentes. Si la base de datos todavía no fue inicializada, ejecutar `docker compose exec api npm run migrate`.

### Dependencias agregadas
- `pdfkit`: generación de documentos PDF en el servidor.
- `exceljs`: generación de libros Excel.

---

## Semana 15 — APIs dinámicas con OpenAPI (Design-First)

Esta versión incorpora el contrato formal de la API y la guía de laboratorio:

- `docs/openapi.yaml`: contrato OpenAPI 3.0.3 de las rutas existentes.
- `docs/SEMANA15_API_OPENAPI_DESIGN_FIRST.md`: explicación de conceptos, relación contrato-código, validación, documentación, generación de stub, pruebas y actividad evaluada.

### Validar y generar documentación del contrato

Desde la raíz del proyecto:

```powershell
npx --yes @redocly/cli lint docs/openapi.yaml
npx --yes @redocly/cli build-docs docs/openapi.yaml -o docs/api-reference.html
```

Abrir `docs/api-reference.html` para explorar las operaciones de la API.

### Relación con el backend

El contrato documenta `src/app.js`, `src/enrollment-service.js`, `src/admin-routes.js` y `src/reports.js`. No reemplaza estos archivos. Si se experimenta con OpenAPI Generator, generar en `generated-server/` y nunca encima de `src/`.

**Importante:** el CRUD administrativo no tiene autenticación/autorización. El endpoint PUT actual realiza actualización parcial; la guía documenta esta diferencia y propone PATCH como mejora futura.

