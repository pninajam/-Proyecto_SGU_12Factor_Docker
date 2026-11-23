# Administración SGU: pgAdmin, CRUD, paginación y reportes

## pgAdmin 4
- URL: `http://localhost:5050`
- Correo y contraseña: `PGADMIN_DEFAULT_EMAIL` y `PGADMIN_DEFAULT_PASSWORD` de `.env`.
- En pgAdmin, registrar servidor: host `db`, puerto `5432`, base `sgu`, usuario y contraseña `DB_USERNAME` / `DB_PASSWORD`.
- No usar `localhost` como host de PostgreSQL desde pgAdmin: ambos son contenedores distintos y se comunican por el DNS interno `db`.

## CRUD incluido
Módulos: periodos académicos, facultades, escuelas profesionales, estudiantes y secciones. Cada módulo tiene búsqueda, paginación, selector de tamaño de página, creación, edición y eliminación con confirmación.

`sections.enrolled` se muestra como dato de lectura, no se modifica manualmente: debe corresponder a las matrículas reales. Las restricciones de claves foráneas impiden borrar catálogos que tengan datos dependientes; la API devuelve HTTP 409.

## API
Base: `/api/v1/admin`

| Método | Ruta | Acción |
|---|---|---|
| GET | `/:resource?page=1&pageSize=10&search=` | Lista paginada |
| GET | `/:resource/:id` | Obtener |
| POST | `/:resource` | Crear |
| PUT | `/:resource/:id` | Actualizar |
| DELETE | `/:resource/:id` | Eliminar |

Recursos: `academic_periods`, `faculties`, `careers`, `students`, `sections`. Las tablas y columnas proceden de una lista blanca del servidor; los valores se parametrizan.

## Reportes
- `GET /api/v1/reports/summary`: totales y agregaciones por facultad y periodo.
- `GET /api/v1/reports/export.xlsx`: descarga un libro Excel con hojas Periodos, Facultades, Escuelas, Estudiantes, Secciones y Matrículas.

## Ejecutar en PowerShell
```powershell
# Crear configuración local desde la plantilla.
Copy-Item .env.example .env

# Cambiar contraseñas de PostgreSQL y pgAdmin.
notepad .env

# Validar Compose y variables.
docker compose config

# Construir e iniciar API, PostgreSQL y pgAdmin.
docker compose up --build -d

# Aplicar tablas y datos iniciales.
docker compose exec api npm run migrate

# Comprobar servicios.
docker compose ps
```

Abrir `http://localhost:8080` para el SGU y `http://localhost:5050` para pgAdmin.

## Seguridad y alcance
Este es un prototipo académico. Las pantallas CRUD todavía no tienen autenticación ni autorización por roles; no exponer a Internet ni usar datos reales. Antes de producción: autenticación, permisos, auditoría de cambios, TLS, gestión de secretos, backups, monitoreo y pruebas de seguridad.


## 7. CRUD mejorado

La lista paginada admite los parámetros:
- `page`: página actual, mínimo 1.
- `pageSize`: 1 a 100 registros.
- `search`: texto de búsqueda.
- `sort`: campo permitido por cada recurso.
- `direction`: `asc` o `desc`.

El servidor valida longitudes máximas y tipos, parametriza los valores SQL y limita los campos de ordenamiento a una lista blanca. Las claves foráneas evitan eliminar registros con dependencias. `sections.enrolled` no se edita desde el formulario porque representa el total de matrículas.

## 8. Visor PDF y reportes individuales

En el dashboard, seleccionar el catálogo y utilizar **Ver PDF**. El documento se muestra en un visor integrado con opción de descarga.

Endpoints:
- `/api/v1/reports/summary.pdf`: reporte ejecutivo general.
- `/api/v1/reports/academic_periods.pdf`
- `/api/v1/reports/faculties.pdf`
- `/api/v1/reports/careers.pdf`
- `/api/v1/reports/students.pdf`
- `/api/v1/reports/sections.pdf`
- `/api/v1/reports/enrollments.pdf`

Por defecto, el navegador visualiza el PDF. Añadir `?download=1` para descargarlo como archivo.

## 9. Exportación Excel individual y consolidada

En la sección Reportes, elegir la entidad y pulsar **Exportar esta tabla a Excel**. Los endpoints individuales son:
- `/api/v1/reports/academic_periods.xlsx`
- `/api/v1/reports/faculties.xlsx`
- `/api/v1/reports/careers.xlsx`
- `/api/v1/reports/students.xlsx`
- `/api/v1/reports/sections.xlsx`
- `/api/v1/reports/enrollments.xlsx`

El enlace **Excel consolidado** genera un libro con una hoja por entidad.

## 10. Actualizar la versión Docker

```powershell
# Validar el archivo Compose.
docker compose config

# Reconstruir la imagen API e iniciar los servicios actualizados.
docker compose up --build -d

# Revisar estado de los servicios.
docker compose ps

# Consultar logs de la API.
docker compose logs --tail 100 api
```

PDFKit y ExcelJS se instalan durante la construcción de la imagen. Los reportes utilizan las tablas existentes; no requieren una migración adicional.
