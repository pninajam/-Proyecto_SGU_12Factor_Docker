import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { pool } from "./db.js";
import { AppError } from "./errors.js";

export const reportsRouter = Router();

// Definiciones de consultas controladas por el servidor.
const reportDefinitions = {
  academic_periods: {
    title: "Periodos académicos", sheet: "Periodos",
    columns: [["id","ID"],["name","Periodo académico"],["is_active","Activo"]],
    sql: `SELECT id, name, is_active FROM academic_periods ORDER BY id DESC`
  },
  faculties: {
    title: "Facultades", sheet: "Facultades",
    columns: [["id","ID"],["name","Facultad"]],
    sql: `SELECT id, name FROM faculties ORDER BY name`
  },
  careers: {
    title: "Escuelas profesionales", sheet: "Escuelas",
    columns: [["id","ID"],["faculty_name","Facultad"],["name","Escuela profesional"],["level","Nivel"]],
    sql: `SELECT c.id, f.name AS faculty_name, c.name, c.level
          FROM careers c JOIN faculties f ON f.id=c.faculty_id ORDER BY f.name,c.name`
  },
  students: {
    title: "Estudiantes", sheet: "Estudiantes",
    columns: [["id","ID"],["university_code","Código universitario"],["full_name","Apellidos y nombres"],
      ["faculty_name","Facultad"],["career_name","Escuela profesional"],["is_active","Activo"]],
    sql: `SELECT s.id, s.university_code, s.full_name, f.name AS faculty_name,
                 c.name AS career_name, s.is_active
          FROM students s LEFT JOIN careers c ON c.id=s.career_id
          LEFT JOIN faculties f ON f.id=c.faculty_id ORDER BY s.full_name`
  },
  sections: {
    title: "Secciones", sheet: "Secciones",
    columns: [["id","ID"],["course_code","Código asignatura"],["section_code","Sección"],
      ["period_name","Periodo"],["faculty_name","Facultad"],["career_name","Escuela profesional"],
      ["vacancies","Vacantes"],["enrolled","Matriculados"],["available","Vacantes disponibles"]],
    sql: `SELECT s.id, s.course_code, s.section_code, p.name AS period_name,
                 f.name AS faculty_name, c.name AS career_name, s.vacancies, s.enrolled,
                 (s.vacancies-s.enrolled) AS available
          FROM sections s JOIN academic_periods p ON p.id=s.academic_period_id
          LEFT JOIN careers c ON c.id=s.career_id LEFT JOIN faculties f ON f.id=c.faculty_id
          ORDER BY p.id DESC,s.course_code,s.section_code`
  },
  enrollments: {
    title: "Matrículas registradas", sheet: "Matrículas",
    columns: [["id","ID"],["university_code","Código universitario"],["full_name","Estudiante"],
      ["course_code","Asignatura"],["section_code","Sección"],["period_name","Periodo"],
      ["created_at","Fecha de registro"],["request_id","Request ID"]],
    sql: `SELECT e.id, st.university_code, st.full_name, s.course_code,
                 s.section_code, p.name AS period_name, e.created_at, e.request_id
          FROM enrollments e JOIN students st ON st.id=e.student_id
          JOIN sections s ON s.id=e.section_id
          JOIN academic_periods p ON p.id=s.academic_period_id
          ORDER BY e.created_at DESC`
  }
};

function getDefinition(resource) {
  const definition = reportDefinitions[resource];
  if (!definition) throw new AppError("No existe un reporte para el recurso solicitado.", "REPORT_NOT_FOUND", 404);
  return definition;
}
function displayValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (value instanceof Date) return value.toLocaleString("es-PE");
  return String(value);
}
function createWorkbook(title, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SGU–UNJBG";
  workbook.created = new Date();
  workbook.title = title;
  const sheet = workbook.addWorksheet("Reporte");
  sheet.columns = columns.map(([key, header]) => ({
    header, key, width: Math.max(14, Math.min(34, header.length + 7))
  }));
  if (rows.length) sheet.addRows(rows);
  else sheet.addRow(Object.fromEntries(columns.map(([key]) => [key, "Sin registros"])));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244D76" } };
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(sheet.columnCount).letter}1` };
  return workbook;
}
function sendPdf(res, { title, subtitle, columns, rows, filename, inline }) {
  const pdf = new PDFDocument({
    size: "A4", layout: "landscape",
    margins: { top: 46, right: 32, bottom: 42, left: 32 },
    bufferPages: true
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${filename}"`);
  pdf.pipe(res);
  const width = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
  const colWidth = width / columns.length;
  const rowHeight = 24;

  const drawPageHeading = () => {
    pdf.font("Helvetica-Bold").fontSize(15).fillColor("#173B63").text("SGU–UNJBG");
    pdf.moveDown(0.2);
    pdf.font("Helvetica-Bold").fontSize(11).fillColor("#244D76").text(title);
    pdf.font("Helvetica").fontSize(8).fillColor("#52677F").text(subtitle);
    pdf.moveDown(0.8);
    const y = pdf.y;
    pdf.rect(pdf.page.margins.left, y, width, 23).fill("#244D76");
    columns.forEach((column, index) => {
      pdf.font("Helvetica-Bold").fontSize(7).fillColor("#FFFFFF")
        .text(column[1], pdf.page.margins.left + index * colWidth + 3, y + 7,
          { width: colWidth - 6, height: 12, ellipsis: true });
    });
    pdf.y = y + 23;
  };

  drawPageHeading();
  rows.forEach((row, index) => {
    if (pdf.y + rowHeight > pdf.page.height - pdf.page.margins.bottom) {
      pdf.addPage();
      drawPageHeading();
    }
    const y = pdf.y;
    if (index % 2 === 0) pdf.rect(pdf.page.margins.left, y, width, rowHeight).fill("#F1F5F9");
    columns.forEach((column, columnIndex) => {
      pdf.font("Helvetica").fontSize(7).fillColor("#26384B")
        .text(displayValue(row[column[0]]), pdf.page.margins.left + columnIndex * colWidth + 3,
          y + 7, { width: colWidth - 6, height: 12, ellipsis: true });
    });
    pdf.y = y + rowHeight;
  });

  const pages = pdf.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    pdf.switchToPage(page);
    pdf.font("Helvetica").fontSize(7).fillColor("#718096")
      .text(`Generado: ${new Date().toLocaleString("es-PE")} · Página ${page + 1} de ${pages.count}`,
        pdf.page.margins.left, pdf.page.height - 25, { width, align: "right" });
  }
  pdf.end();
}

reportsRouter.get("/summary", async (req, res, next) => {
  try {
    const [counts, byFaculty, byPeriod] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM academic_periods) AS academic_periods,
        (SELECT COUNT(*)::int FROM faculties) AS faculties,
        (SELECT COUNT(*)::int FROM careers) AS careers,
        (SELECT COUNT(*)::int FROM students) AS students,
        (SELECT COUNT(*)::int FROM sections) AS sections,
        (SELECT COUNT(*)::int FROM enrollments) AS enrollments`),
      pool.query(`SELECT f.id, f.name AS faculty,
        COUNT(DISTINCT c.id)::int AS careers, COUNT(DISTINCT s.id)::int AS students
        FROM faculties f LEFT JOIN careers c ON c.faculty_id=f.id
        LEFT JOIN students s ON s.career_id=c.id GROUP BY f.id,f.name ORDER BY f.name`),
      pool.query(`SELECT p.id, p.name AS period, p.is_active,
        COUNT(DISTINCT sec.id)::int AS sections, COUNT(DISTINCT e.id)::int AS enrollments
        FROM academic_periods p LEFT JOIN sections sec ON sec.academic_period_id=p.id
        LEFT JOIN enrollments e ON e.section_id=sec.id
        GROUP BY p.id,p.name,p.is_active ORDER BY p.id DESC`)
    ]);
    res.json({ data: { totals: counts.rows[0], faculties: byFaculty.rows, periods: byPeriod.rows }, requestId: req.requestId });
  } catch (error) { next(error); }
});

// Reporte ejecutivo general para el visor PDF del dashboard.
reportsRouter.get("/summary.pdf", async (req, res, next) => {
  try {
    const [counts, faculties, periods] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM academic_periods) AS academic_periods,
        (SELECT COUNT(*)::int FROM faculties) AS faculties,
        (SELECT COUNT(*)::int FROM careers) AS careers,
        (SELECT COUNT(*)::int FROM students) AS students,
        (SELECT COUNT(*)::int FROM sections) AS sections,
        (SELECT COUNT(*)::int FROM enrollments) AS enrollments`),
      pool.query(`SELECT f.name AS faculty, COUNT(DISTINCT c.id)::int AS careers,
        COUNT(DISTINCT s.id)::int AS students
        FROM faculties f LEFT JOIN careers c ON c.faculty_id=f.id
        LEFT JOIN students s ON s.career_id=c.id GROUP BY f.id,f.name ORDER BY f.name`),
      pool.query(`SELECT p.name AS period, p.is_active,
        COUNT(DISTINCT sec.id)::int AS sections, COUNT(DISTINCT e.id)::int AS enrollments
        FROM academic_periods p LEFT JOIN sections sec ON sec.academic_period_id=p.id
        LEFT JOIN enrollments e ON e.section_id=sec.id
        GROUP BY p.id,p.name,p.is_active ORDER BY p.id DESC`)
    ]);
    const totals = counts.rows[0];
    const rows = [
      ...Object.entries(totals).map(([key, value]) => ({
        category: "Indicador general", name: key.replaceAll("_", " "), metric_one: value, metric_two: ""
      })),
      ...faculties.rows.map((item) => ({
        category: "Facultad", name: item.faculty, metric_one: `${item.careers} escuelas`, metric_two: `${item.students} estudiantes`
      })),
      ...periods.rows.map((item) => ({
        category: "Periodo", name: item.period, metric_one: `${item.sections} secciones`,
        metric_two: `${item.enrollments} matrículas · ${item.is_active ? "Activo" : "Inactivo"}`
      }))
    ];
    sendPdf(res, {
      title: "Reporte ejecutivo académico",
      subtitle: "Indicadores generales, distribución por facultad y actividad por periodo",
      columns: [["category","Tipo"],["name","Descripción"],["metric_one","Indicador 1"],["metric_two","Indicador 2"]],
      rows,
      filename: `SGU_Reporte_General_${new Date().toISOString().slice(0,10)}.pdf`,
      inline: req.query.download !== "1"
    });
  } catch (error) { next(error); }
});

// El PDF se abre en el visor del navegador; ?download=1 fuerza su descarga.
reportsRouter.get("/:resource.pdf", async (req, res, next) => {
  try {
    const definition = getDefinition(req.params.resource);
    const result = await pool.query(definition.sql);
    sendPdf(res, {
      title: definition.title,
      subtitle: `Registros: ${result.rowCount} · Reporte generado por el SGU–UNJBG`,
      columns: definition.columns, rows: result.rows,
      filename: `SGU_${req.params.resource}_${new Date().toISOString().slice(0,10)}.pdf`,
      inline: req.query.download !== "1"
    });
  } catch (error) { next(error); }
});

// Libro consolidado: una hoja por cada catálogo.
reportsRouter.get("/export.xlsx", async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SGU–UNJBG";
    workbook.created = new Date();
    workbook.title = "Reporte académico SGU–UNJBG";
    for (const [resource, definition] of Object.entries(reportDefinitions)) {
      const result = await pool.query(definition.sql);
      const sheet = workbook.addWorksheet(definition.sheet);
      sheet.columns = definition.columns.map(([key, header]) => ({
        header, key, width: Math.max(14, Math.min(34, header.length + 7))
      }));
      if (result.rows.length) sheet.addRows(result.rows);
      else sheet.addRow(Object.fromEntries(definition.columns.map(([key]) => [key, "Sin registros"])));
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF244D76" } };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(sheet.columnCount).letter}1` };
    }
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="SGU_Reporte_Academico_${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.setHeader("Content-Length", buffer.byteLength);
    res.send(Buffer.from(buffer));
  } catch (error) { next(error); }
});

// Generar un archivo Excel independiente para cada catálogo.
reportsRouter.get("/:resource.xlsx", async (req, res, next) => {
  try {
    const definition = getDefinition(req.params.resource);
    const result = await pool.query(definition.sql);
    const workbook = createWorkbook(`SGU – ${definition.title}`, definition.columns, result.rows);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="SGU_${req.params.resource}_${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.setHeader("Content-Length", buffer.byteLength);
    res.send(Buffer.from(buffer));
  } catch (error) { next(error); }
});

