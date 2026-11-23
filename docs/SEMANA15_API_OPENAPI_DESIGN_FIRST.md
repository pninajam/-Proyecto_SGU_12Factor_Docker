# Integración de Semana 15: APIs dinámicas con OpenAPI (Design-First)

## 1. Propósito de esta integración

Este documento incorpora al proyecto SGU–UNJBG los aprendizajes de la Semana 15: diseño de APIs mediante contrato OpenAPI, validación estática, generación de código, documentación y pruebas.

La integración parte del proyecto que ya existe. No reemplaza Express, PostgreSQL ni Docker Compose. Añade una especificación formal de la API y explica cómo relacionarla con el código implementado.

**Archivo principal del contrato:** `docs/openapi.yaml`

**Versión del contrato:** OpenAPI 3.0.3, API SGU–UNJBG 1.1.0.

> Alcance académico: el proyecto utiliza información ficticia para laboratorio. No debe conectarse a datos personales reales ni publicarse en Internet sin implementar autenticación, autorización, controles de seguridad y revisión operativa.

## 2. ¿Qué había en el proyecto y qué se agrega?

El proyecto ya tenía una API implementada en Express 5 con PostgreSQL 17. Sus rutas se encontraban principalmente en `src/app.js`, `src/admin-routes.js` y `src/reports.js`.

La Semana 15 agrega el enfoque Design-First:

1. Definir el contrato antes de cambiar o crear endpoints.
2. Describir rutas, métodos, parámetros, cuerpos, respuestas y modelos.
3. Validar el contrato con una herramienta de linting.
4. Generar documentación legible para consumidores.
5. Generar un esqueleto de servidor en un directorio separado, cuando sea útil.
6. Comparar el contrato con el código real mediante pruebas.

### Archivos nuevos

| Archivo | Propósito |
|---|---|
| `docs/openapi.yaml` | Contrato formal de las rutas actuales del SGU. |
| `docs/SEMANA15_API_OPENAPI_DESIGN_FIRST.md` | Esta guía: conceptos, arquitectura, ejemplos y laboratorio. |

No se reemplazan los controladores ni se sobrescribe `src/`. La especificación describe la API existente y sirve como base para su evolución.

## 3. Arquitectura actual del proyecto y relación con OpenAPI

```text
Cliente web / Postman / curl
            |
            | HTTP + JSON
            v
      Express 5 (API)
      src/app.js
            |
   +--------+--------------------+
   |             |               |
   v             v               v
Matrículas   Administración   Reportes
src/         src/             src/
enrollment-  admin-routes.js  reports.js
service.js
   |             |               |
   +-------------+---------------+
                 |
                 v
           PostgreSQL 17
              servicio db
                 |
           Docker Compose
```

OpenAPI no sustituye esta arquitectura. Describe el contrato externo que el cliente puede consumir. El contrato permite que frontend, backend, QA y documentación trabajen con un acuerdo común.

### Correspondencia entre contrato y código

| Parte de OpenAPI | Código del proyecto |
|---|---|
| `GET /health/live` | `src/app.js` |
| `GET /health/ready` | `src/app.js` y `src/db.js` |
| `GET /api/v1/catalog` | `src/app.js` |
| `GET /api/v1/dashboard` | `src/app.js` |
| `GET/POST /api/v1/enrollments` | `src/app.js` |
| Reglas transaccionales de matrícula | `src/enrollment-service.js` |
| `/api/v1/admin/...` | `src/admin-routes.js` |
| `/api/v1/reports/...` | `src/reports.js` |
| Errores HTTP | `src/errors.js` y middleware final de `src/app.js` |
| Correlación `requestId` | Middleware de `src/app.js` |
| Puerto y configuración | `src/config.js`, `.env` y `compose.yaml` |

## 4. Conceptos de Semana 15 aplicados al SGU

### 4.1 API, recurso y endpoint

Una API es una interfaz que permite que un cliente utilice servicios de otro componente. Un recurso es una entidad del dominio. Un endpoint es la combinación de método HTTP y ruta.

Ejemplos del proyecto:

- `GET /api/v1/catalog`: obtiene catálogos para el formulario.
- `GET /api/v1/dashboard`: consulta indicadores.
- `POST /api/v1/enrollments`: registra una matrícula.
- `GET /api/v1/admin/students`: lista estudiantes administrativamente.

### 4.2 Contrato API

El contrato define qué puede enviar el consumidor y qué puede esperar como respuesta. En este proyecto, `docs/openapi.yaml` describe:

- Métodos y rutas.
- Parámetros de ruta y query.
- Cuerpos JSON.
- Códigos de estado HTTP.
- Tipos y esquemas de respuesta.
- Parámetros de paginación y filtros.
- Tipos de contenido PDF y XLSX.

El contrato es una especificación verificable; no ejecuta por sí solo las reglas de negocio.

### 4.3 Design-First y Code-First

**Design-First:** contrato → revisión → validación → implementación/generación → pruebas.

**Code-First:** implementación → documentación derivada → validación.

Este proyecto ya tenía código. Para incorporar Design-First sin romperlo, primero se documentó el comportamiento actual en OpenAPI. En los cambios siguientes, el equipo debe actualizar primero el contrato y después implementar la modificación, verificando que ambos permanezcan sincronizados.

### 4.4 `operationId`

Cada operación tiene un identificador estable, por ejemplo:

- `createEnrollment`
- `listEnrollments`
- `getDashboard`
- `listAdminResource`

Se utiliza para identificar operaciones en herramientas, generación de código y documentación. Debe ser único dentro de la API.

### 4.5 Parámetros

- `path`: parte de la ruta, por ejemplo `{resource}` o `{id}`.
- `query`: opciones de consulta, por ejemplo `page`, `pageSize`, `search`, `sort` y `direction`.
- `header`: metadatos enviados en encabezados HTTP.
- `requestBody`: objeto JSON enviado al servidor.

### 4.6 Schemas y `$ref`

Los schemas definen estructura, tipo, obligatoriedad y restricciones de datos. `$ref` permite reutilizar modelos y evitar duplicación. En `docs/openapi.yaml`, por ejemplo, `EnrollmentCreate` describe la entrada de matrícula y `EnrollmentResponse` describe la respuesta.

### 4.7 Stub y generación

Un stub es una estructura inicial de código generada desde el contrato. No equivale a una API terminada. El equipo debe implementar reglas de negocio, persistencia, seguridad, transacciones y manejo de errores.

**Regla de seguridad del repositorio:** nunca generar encima de `src/`. Si se desea experimentar con OpenAPI Generator, utilizar una carpeta aislada como `generated/` o `generated-server/`, comparar el resultado y decidir manualmente qué incorporar.

## 5. Lectura guiada del contrato del proyecto

Abrir `docs/openapi.yaml` en Visual Studio Code.

### 5.1 Cabecera

```yaml
openapi: 3.0.3
info:
  title: API SGU–UNJBG
  version: 1.1.0
servers:
  - url: http://localhost:8080
```

- `openapi`: versión de la especificación.
- `info`: identidad y versión del contrato.
- `servers`: dirección base del servicio en el laboratorio.

### 5.2 Operación de matrícula

El contrato define `POST /api/v1/enrollments` con `EnrollmentCreate`, que requiere `studentId` y `sectionId`.

Solicitud:

```http
POST /api/v1/enrollments
Content-Type: application/json
```

```json
{
  "studentId": 1,
  "sectionId": 1
}
```

Respuesta exitosa esperada:

```json
{
  "data": {
    "id": 1,
    "student_id": 1,
    "section_id": 1,
    "created_at": "2026-11-23T14:00:00.000Z",
    "request_id": "identificador-de-solicitud"
  },
  "requestId": "identificador-de-solicitud"
}
```

Los valores concretos de `id`, fecha y `requestId` los genera el sistema; el ejemplo es ilustrativo.

### 5.3 Códigos HTTP que utiliza el caso de matrícula

| Código | Interpretación en el proyecto |
|---|---|
| 201 | Matrícula creada. |
| 404 | Sección inexistente o estudiante inexistente/inactivo. |
| 409 | Periodo cerrado, matrícula duplicada o vacantes agotadas. |
| 422 | Identificadores inválidos. |
| 500 | Error inesperado del servidor. |

El servicio `src/enrollment-service.js` ejecuta una transacción, bloquea la fila de la sección con `FOR UPDATE`, comprueba vacantes, inserta la matrícula y actualiza el contador. OpenAPI documenta el contrato HTTP; la transacción implementa la regla de negocio.

### 5.4 Administración genérica

El backend expone una ruta genérica `/api/v1/admin/{resource}`. El parámetro `resource` se restringe en el contrato a:

- `academic_periods`
- `faculties`
- `careers`
- `students`
- `sections`

Ejemplo de listado:

```http
GET /api/v1/admin/students?page=1&pageSize=10&search=Ana&sort=full_name&direction=asc
```

La respuesta contiene `data`, `pagination`, `columns`, `sorting` y `requestId`.

Ejemplo de creación de estudiante:

```http
POST /api/v1/admin/students
Content-Type: application/json
```

```json
{
  "university_code": "20269999",
  "full_name": "Estudiante de Prueba",
  "is_active": true,
  "career_id": 1
}
```

Ejemplo de creación de escuela profesional:

```http
POST /api/v1/admin/careers
Content-Type: application/json
```

```json
{
  "faculty_id": 1,
  "name": "Ingeniería de Software",
  "level": "S1"
}
```

El backend mantiene una lista cerrada de recursos y columnas permitidas. No se debe permitir que el cliente envíe nombres arbitrarios de tablas o columnas SQL.

### 5.5 Reportes

| Endpoint | Resultado |
|---|---|
| `GET /api/v1/reports/summary` | Resumen estadístico JSON. |
| `GET /api/v1/reports/summary.pdf` | Reporte ejecutivo PDF. |
| `GET /api/v1/reports/{resource}.pdf` | PDF por recurso. |
| `GET /api/v1/reports/{resource}.xlsx` | Excel por recurso. |
| `GET /api/v1/reports/export.xlsx` | Libro consolidado Excel. |

Recursos de reportes: `academic_periods`, `faculties`, `careers`, `students`, `sections` y `enrollments`.

Para el PDF, `?download=1` fuerza la descarga; sin ese parámetro el navegador puede visualizarlo inline.

## 6. Laboratorio: validar y visualizar el contrato

Ejecutar los comandos desde la raíz del proyecto.

### 6.1 Validar YAML con Redocly CLI

No es necesario agregar la herramienta como dependencia de producción. Se puede ejecutar mediante `npx`:

```powershell
npx --yes @redocly/cli lint docs/openapi.yaml
```

Qué revisar:

1. Errores de sintaxis YAML.
2. Referencias `$ref` inexistentes.
3. Parámetros de ruta no declarados.
4. `operationId` repetidos.
5. Respuestas sin descripción o contenido.
6. Advertencias de consistencia y documentación.

Un lint correcto no garantiza que el código real cumpla el contrato. Para eso se requieren pruebas de integración o pruebas de contrato.

### 6.2 Generar documentación HTML

```powershell
npx --yes @redocly/cli build-docs docs/openapi.yaml -o docs/api-reference.html
```

Abrir `docs/api-reference.html` en el navegador. La documentación permite explorar las operaciones, parámetros, esquemas y respuestas sin leer directamente todo el YAML.

### 6.3 Flujo esperado

```text
docs/openapi.yaml
       |
       v
Redocly lint
       |
       v
Contrato validado
       |
       +------> Documentación HTML
       |
       +------> Generación opcional de stub
       |
       v
Comparación con Express
       |
       v
Pruebas HTTP / contrato
```

## 7. Generación opcional de un servidor base

La API real ya está implementada en Express. Por ello, la generación es una práctica complementaria para aprender el flujo de la Semana 15, no un paso necesario para iniciar el proyecto.

Desde PowerShell, en la raíz:

```powershell
docker run --rm openapitools/openapi-generator-cli version
```

Generar en una carpeta separada:

```powershell
docker run --rm `
  -v "${PWD}:/local" `
  openapitools/openapi-generator-cli generate `
  -i /local/docs/openapi.yaml `
  -g nodejs-express-server `
  -o /local/generated-server
```

Inspeccionar el resultado:

```powershell
Get-ChildItem .\generated-server
```

**No copiar automáticamente el código generado sobre `src/`.** El proyecto actual tiene decisiones específicas: transacciones PostgreSQL, middlewares, logs, `requestId`, exportaciones y estructura de carpetas. El código generado puede tener otra estructura y no incluir esas reglas.

Actividad de análisis: comparar un controlador generado con `src/app.js` y explicar qué partes del servicio actual no pueden obtenerse solamente del contrato.

## 8. Ejecutar el proyecto y probar los endpoints

### 8.1 Iniciar el entorno

Si todavía no existe `.env`, copiar la plantilla:

```powershell
Copy-Item .env.example .env
notepad .env
```

Cambiar las contraseñas de laboratorio antes de iniciar. Luego:

```powershell
docker compose config
docker compose up --build -d
docker compose ps
docker compose exec api npm run migrate
```

Direcciones locales:

- API y aplicación: `http://localhost:8080`
- pgAdmin: `http://localhost:5050`

### 8.2 Probar salud

```powershell
curl.exe -i http://localhost:8080/health/live
curl.exe -i http://localhost:8080/health/ready
```

### 8.3 Probar catálogo y dashboard

```powershell
curl.exe -i http://localhost:8080/api/v1/catalog
curl.exe -i http://localhost:8080/api/v1/dashboard
```

### 8.4 Probar matrícula

Primera solicitud:

```powershell
curl.exe -i -X POST http://localhost:8080/api/v1/enrollments `
  -H "Content-Type: application/json" `
  -d '{ "studentId": 1, "sectionId": 1 }'
```

Repetir exactamente la misma solicitud para verificar el conflicto por matrícula duplicada. Según los datos de demostración y el estado actual de la base, la primera operación válida devuelve 201 y la duplicada 409.

### 8.5 Probar administración

```powershell
curl.exe -i "http://localhost:8080/api/v1/admin/students?page=1&pageSize=5"
curl.exe -i "http://localhost:8080/api/v1/admin/faculties"
```

### 8.6 Probar reportes

```powershell
curl.exe -I http://localhost:8080/api/v1/reports/summary
curl.exe -o resumen.pdf "http://localhost:8080/api/v1/reports/summary.pdf?download=1"
curl.exe -o estudiantes.xlsx http://localhost:8080/api/v1/reports/students.xlsx
curl.exe -o consolidado.xlsx http://localhost:8080/api/v1/reports/export.xlsx
```

## 9. Hallazgos de consistencia entre REST y el código actual

La revisión del código identificó una diferencia didácticamente importante:

### PUT está implementado como actualización parcial

En `src/admin-routes.js`, la operación `PUT /api/v1/admin/:resource/:id` llama a `normalizePayload(..., true)`, por lo que acepta y actualiza únicamente los campos recibidos.

En semántica HTTP habitual:

- `PUT` representa el reemplazo de la representación del recurso.
- `PATCH` representa una modificación parcial.

Por eso, el contrato documenta expresamente el comportamiento actual y señala la deuda semántica. Como mejora posterior del curso se recomienda:

1. Introducir `PATCH /api/v1/admin/{resource}/{id}` para actualización parcial.
2. Hacer que `PUT` exija la representación completa de los campos editables.
3. Añadir pruebas que comprueben ambos comportamientos.
4. Actualizar el contrato OpenAPI antes de liberar el cambio.

No se modifica silenciosamente esta lógica en el laboratorio porque puede afectar a la interfaz administrativa existente.

### Otros límites identificados

- El proyecto no incorpora autenticación ni autorización para el CRUD administrativo. No exponerlo a Internet.
- El contrato describe las rutas y respuestas actuales; algunas estructuras dinámicas de administración se representan con objetos abiertos porque sus campos dependen del recurso.
- La validación Redocly comprueba el contrato, no las consultas SQL ni las reglas de negocio.
- La generación de stub no reemplaza las capas existentes ni crea automáticamente la lógica transaccional.
- Se debe revisar la coherencia del contrato cada vez que cambien rutas, respuestas o reglas.

## 10. Pruebas de contrato: matriz de trazabilidad

| Requisito | Operación OpenAPI | Código principal | Prueba sugerida |
|---|---|---|---|
| Comprobar proceso activo | `GET /health/live` | `src/app.js` | T01: respuesta 200. |
| Comprobar PostgreSQL | `GET /health/ready` | `src/app.js`, `src/db.js` | T02: 200 con DB disponible. |
| Obtener catálogos | `GET /api/v1/catalog` | `src/app.js` | T03: estructura `data`. |
| Obtener indicadores | `GET /api/v1/dashboard` | `src/app.js` | T04: métricas y facultades. |
| Listar matrículas | `GET /api/v1/enrollments` | `src/app.js` | T05: arreglo de matrículas. |
| Crear matrícula | `POST /api/v1/enrollments` | `src/app.js`, `src/enrollment-service.js` | T06: 201; T07: duplicado 409. |
| Listar estudiantes | `GET /api/v1/admin/students` | `src/admin-routes.js` | T08: paginación y datos. |
| Crear registro administrativo | `POST /api/v1/admin/{resource}` | `src/admin-routes.js` | T09: 201 o error de validación. |
| Obtener resumen | `GET /api/v1/reports/summary` | `src/reports.js` | T10: JSON de totales. |
| Exportar PDF/Excel | Rutas `/reports/...` | `src/reports.js` | T11: content-type y archivo válido. |

### Criterio de aceptación de cada prueba

Registrar para cada caso:

- ID y requisito.
- Solicitud enviada.
- Código HTTP esperado.
- Código HTTP observado.
- Campos obligatorios de la respuesta.
- Evidencia (captura o salida de consola).
- Estado: aprobado / fallido.
- Incidencia y responsable, si corresponde.

## 11. Actividad evaluada de Semana 15

**Reto:** ampliar el SGU incorporando un endpoint de consulta de detalle de matrícula.

Requisitos:

1. Diseñar `GET /api/v1/enrollments/{id}` en `docs/openapi.yaml`.
2. Definir el parámetro `id` como entero positivo obligatorio.
3. Documentar respuesta 200 con datos de matrícula y respuesta 404 si no existe.
4. Asignar un `operationId` único.
5. Ejecutar `npx --yes @redocly/cli lint docs/openapi.yaml`.
6. Implementar la ruta en `src/app.js` usando consultas parametrizadas.
7. Probar matrícula existente, inexistente e identificador inválido.
8. Registrar la trazabilidad requisito → endpoint → código → prueba.

**Extensión intermedia:** diseñar `PATCH /api/v1/admin/students/{id}` y justificar la diferencia frente al `PUT` actual. Implementar la ruta en una rama de trabajo, añadir pruebas y actualizar el contrato.

## 12. Entregables

Cada equipo debe entregar:

1. `docs/openapi.yaml` actualizado.
2. `docs/api-reference.html` generado.
3. Reporte o salida de lint.
4. Evidencias de solicitudes y respuestas.
5. Matriz de trazabilidad completada.
6. Código implementado para el reto.
7. README o informe breve con decisiones y hallazgos.

## 13. Rúbrica sugerida

| Criterio | Peso |
|---|---:|
| Diseño del contrato OpenAPI y schemas | 25 % |
| Uso correcto de HTTP y códigos de estado | 15 % |
| Validación y documentación | 15 % |
| Correspondencia contrato–código | 20 % |
| Pruebas positivas y negativas | 15 % |
| Trazabilidad y explicación técnica | 10 % |
| **Total** | **100 %** |

## 14. Glosario breve

- **API:** interfaz para que sistemas intercambien servicios o datos.
- **REST:** estilo arquitectónico para sistemas distribuidos.
- **Endpoint:** combinación de método HTTP y ruta.
- **Contrato:** acuerdo formal de operaciones, datos y respuestas.
- **OpenAPI:** especificación para describir APIs HTTP.
- **Schema:** estructura y restricciones de un dato.
- **`$ref`:** referencia reutilizable a una definición.
- **`operationId`:** identificador único de una operación.
- **Stub:** esqueleto de código generado desde el contrato.
- **Lint:** análisis estático de la especificación.
- **DTO:** objeto de transferencia de datos.
- **Idempotencia:** repetición de una operación con el mismo efecto final.
- **Paginación:** entrega de resultados en bloques.
- **Trazabilidad:** relación verificable entre requisito, endpoint, código y prueba.

## 15. Referencias

- Fielding, R. T. (2000). *Architectural styles and the design of network-based software architectures* [Doctoral dissertation, University of California, Irvine].
- Fielding, R., Nottingham, M., & Reschke, J. (Eds.). (2022). *HTTP semantics* (RFC 9110). Internet Engineering Task Force. https://www.rfc-editor.org/rfc/rfc9110
- OpenAPI Initiative. (s. f.). *OpenAPI Specification 3.0.3*. https://spec.openapis.org/oas/v3.0.3
- OpenAPI Generator. (s. f.). *OpenAPI Generator documentation*. https://openapi-generator.tech/
- Redocly. (s. f.). *Redocly CLI documentation*. https://redocly.com/docs/cli/
- Richardson, L., Amundsen, M., & Ruby, S. (2013). *RESTful web APIs*. O’Reilly Media.
