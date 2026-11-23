// Importar Express para construir la API HTTP.
import express from "express";
// Importar utilidades para resolver la ruta pública de la interfaz web.
import path from "node:path";
import { fileURLToPath } from "node:url";
// Importar UUID para correlacionar cada petición.
import { randomUUID } from "node:crypto";
// Importar la operación de matrícula del dominio.
import { createEnrollment } from "./enrollment-service.js";
// Importar consulta de salud de PostgreSQL.
import { checkDatabase, pool } from "./db.js";
// Importar normalización de errores.
import { publicError } from "./errors.js";
// Importar logger estructurado.
import { log } from "./logger.js";
// Rutas de administración de catálogos y reportes exportables.
import { adminRouter } from "./admin-routes.js";
import { reportsRouter } from "./reports.js";

// Crear la instancia principal de Express.
export const app = express();

// Habilitar lectura de cuerpos JSON con un límite pequeño.
app.use(express.json({ limit: "32kb" }));

// Resolver la carpeta public sin depender del directorio desde donde se inicia Node.
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

// Publicar HTML, CSS y JavaScript del navegador desde el mismo servicio.
app.use(express.static(path.resolve(currentDirectory, "../public")));

// Asignar o aceptar un identificador de correlación por petición.
app.use((req, res, next) => {
  // Reutilizar el identificador recibido o generar uno nuevo.
  req.requestId = req.header("x-request-id") || randomUUID();
  // Devolver el identificador para correlación desde el cliente.
  res.setHeader("x-request-id", req.requestId);
  // Continuar con el siguiente middleware o ruta.
  next();
});

// Exponer un endpoint de liveness que confirma que el proceso está activo.
app.get("/health/live", (req, res) => {
  // Responder sin consultar servicios externos.
  res.status(200).json({ status: "alive", requestId: req.requestId });
});

// Exponer un endpoint de readiness que comprueba la base de datos.
app.get("/health/ready", async (req, res, next) => {
  try {
    // Comprobar que PostgreSQL responde.
    await checkDatabase();
    // Informar que el servicio puede recibir tráfico.
    res.status(200).json({ status: "ready", requestId: req.requestId });
  } catch (error) {
    // Delegar el fallo al middleware centralizado.
    next(error);
  }
});

// Entregar los catálogos que alimentan los controles de la interfaz web.
app.get("/api/v1/catalog", async (req, res, next) => {
  try {
    // Consultar estudiantes activos para evitar que el navegador invente identificadores.
    const students = await pool.query(
      "SELECT id, university_code, full_name FROM students WHERE is_active = TRUE ORDER BY id"
    );
    // Consultar secciones con periodo, curso y vacantes disponibles.
    const sections = await pool.query(
      `SELECT s.id, s.course_code, s.section_code, s.vacancies, s.enrolled,
              p.name AS academic_period
       FROM sections s
       JOIN academic_periods p ON p.id = s.academic_period_id
       WHERE p.is_active = TRUE ORDER BY s.id`
    );
    // Consultar el nombre del periodo activo para contextualizar el dashboard.
    const period = await pool.query("SELECT name FROM academic_periods WHERE is_active = TRUE ORDER BY id DESC LIMIT 1");
    // Entregar catálogos y periodo académico con el identificador de correlación.
    res.status(200).json({ data: { students: students.rows, sections: sections.rows, period: period.rows[0]?.name ?? "Sin periodo activo" }, requestId: req.requestId });
  } catch (error) {
    // Enviar fallos de consulta al middleware centralizado.
    next(error);
  }
});

// Entregar indicadores agregados que alimentan el dashboard académico.
app.get("/api/v1/dashboard", async (req, res, next) => {
  try {
    // Obtener el periodo académico actualmente habilitado.
    const periodResult = await pool.query("SELECT name FROM academic_periods WHERE is_active = TRUE ORDER BY id DESC LIMIT 1");
    // Calcular los cuatro indicadores principales del panel.
    const metricsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM students WHERE is_active = TRUE) AS active_students,
        (SELECT COUNT(*)::int FROM enrollments e JOIN sections s ON s.id=e.section_id JOIN academic_periods p ON p.id=s.academic_period_id WHERE p.is_active=TRUE) AS enrollments,
        (SELECT COUNT(*)::int FROM sections s JOIN academic_periods p ON p.id=s.academic_period_id WHERE p.is_active=TRUE) AS active_sections,
        (SELECT COALESCE(SUM(s.vacancies-s.enrolled),0)::int FROM sections s JOIN academic_periods p ON p.id=s.academic_period_id WHERE p.is_active=TRUE) AS available_vacancies`);
    // Consultar métricas de cada escuela profesional dentro de su facultad.
    const rows = await pool.query(`
      SELECT f.id AS faculty_id, f.name AS faculty_name,
             c.id AS career_id, c.name AS career_name, c.level,
             COUNT(DISTINCT st.id) FILTER (WHERE st.is_active=TRUE)::int AS active_students,
             COUNT(DISTINCT e.student_id)::int AS enrolled_students,
             COALESCE((SELECT SUM(sec.vacancies-sec.enrolled) FROM sections sec
               WHERE sec.career_id=c.id AND sec.academic_period_id=(SELECT id FROM academic_periods WHERE is_active=TRUE ORDER BY id DESC LIMIT 1)),0)::int AS available_vacancies
      FROM faculties f JOIN careers c ON c.faculty_id=f.id
      LEFT JOIN students st ON st.career_id=c.id AND st.is_active=TRUE
      LEFT JOIN enrollments e ON e.student_id=st.id AND e.section_id IN (
        SELECT active_section.id FROM sections active_section
        WHERE active_section.academic_period_id=(SELECT id FROM academic_periods WHERE is_active=TRUE ORDER BY id DESC LIMIT 1)
      )
      GROUP BY f.id,f.name,c.id,c.name,c.level ORDER BY f.id,c.id`);
    // Agrupar escuelas profesionales para devolver una estructura jerárquica sencilla.
    const groups = new Map();
    for (const row of rows.rows) {
      if (!groups.has(row.faculty_id)) groups.set(row.faculty_id,{name:row.faculty_name,activeStudents:0,enrolledStudents:0,availableVacancies:0,careers:[]});
      const faculty=groups.get(row.faculty_id);
      const career={name:row.career_name,level:row.level,activeStudents:Number(row.active_students),enrolledStudents:Number(row.enrolled_students),availableVacancies:Number(row.available_vacancies)};
      faculty.careers.push(career); faculty.activeStudents+=career.activeStudents; faculty.enrolledStudents+=career.enrolledStudents; faculty.availableVacancies+=career.availableVacancies;
    }
    // Responder con los indicadores, el resumen académico y el request ID.
    res.status(200).json({data:{period:periodResult.rows[0]?.name??"Sin periodo activo",metrics:{activeStudents:Number(metricsResult.rows[0].active_students),enrollments:Number(metricsResult.rows[0].enrollments),activeSections:Number(metricsResult.rows[0].active_sections),availableVacancies:Number(metricsResult.rows[0].available_vacancies)},faculties:[...groups.values()]},requestId:req.requestId});
  } catch (error) {
    // Delegar cualquier error al middleware centralizado.
    next(error);
  }
});

// Listar las matrículas registradas para visualizar las salidas del proceso.
app.get("/api/v1/enrollments", async (req, res, next) => {
  try {
    // Recuperar matrícula junto con datos académicos de demostración.
    const result = await pool.query(
      `SELECT e.id, e.student_id, st.university_code, st.full_name,
              e.section_id, s.course_code, s.section_code, p.name AS academic_period,
              e.created_at, e.request_id
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
       JOIN sections s ON s.id = e.section_id
       JOIN academic_periods p ON p.id = s.academic_period_id
       ORDER BY e.created_at DESC, e.id DESC LIMIT 100`
    );
    // Responder con las últimas cien matrículas.
    res.status(200).json({ data: result.rows, requestId: req.requestId });
  } catch (error) {
    // Mantener el formato de error común de la API.
    next(error);
  }
});

// Registrar una matrícula mediante el contrato REST del caso SGU.
app.post("/api/v1/enrollments", async (req, res, next) => {
  try {
    // Leer los identificadores enviados por el cliente.
    const { studentId, sectionId } = req.body ?? {};
    // Ejecutar la regla de negocio con el ID de correlación.
    const enrollment = await createEnrollment({
      studentId,
      sectionId,
      requestId: req.requestId
    });
    // Registrar el evento sin escribir datos sensibles del estudiante.
    log("INFO", "enrollment_created", {
      request_id: req.requestId,
      enrollment_id: enrollment.id
    });
    // Responder con HTTP 201 y el recurso creado.
    res.status(201).json({
      data: enrollment,
      requestId: req.requestId
    });
  } catch (error) {
    // Pasar los errores al middleware de manejo centralizado.
    next(error);
  }
});

// CRUD administrativo y reportes académicos.
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/reports", reportsRouter);

// Responder con 404 para rutas no definidas.
app.use((req, res) => {
  // Crear una respuesta de ruta inexistente sin revelar detalles internos.
  res.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "La ruta solicitada no existe."
    },
    requestId: req.requestId
  });
});

// Centralizar la traducción de errores a respuestas HTTP seguras.
app.use((error, req, res, next) => {
  // Obtener el contrato público del error.
  const safe = publicError(error);
  // Registrar el error técnico en stdout con identificador de correlación.
  log("ERROR", "request_failed", {
    request_id: req.requestId,
    error_code: safe.code,
    internal_message: error.message
  });
  // Enviar únicamente el mensaje público y el código controlado.
  res.status(safe.status).json({
    error: {
      code: safe.code,
      message: safe.message
    },
    requestId: req.requestId
  });
});
