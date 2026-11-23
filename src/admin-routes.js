import { Router } from "express";
import { pool } from "./db.js";
import { AppError } from "./errors.js";

export const adminRouter = Router();

// Definiciones cerradas: los nombres de tabla, columna y orden nunca proceden del cliente.
const resources = {
  academic_periods: {
    table: "academic_periods",
    fields: ["name", "is_active"],
    required: ["name"],
    searchable: ["name"],
    select: `SELECT ap.id, ap.name, ap.is_active
             FROM academic_periods ap`,
    order: "ap.id DESC",
    idAlias: "ap",
    sort: { id: "ap.id", name: "ap.name", is_active: "ap.is_active" },
    columns: [
      { key: "name", label: "Periodo académico" },
      { key: "is_active", label: "Activo" }
    ]
  },
  faculties: {
    table: "faculties",
    fields: ["name"],
    required: ["name"],
    searchable: ["name"],
    select: `SELECT f.id, f.name FROM faculties f`,
    order: "f.id DESC",
    idAlias: "f",
    sort: { id: "f.id", name: "f.name" },
    columns: [{ key: "name", label: "Facultad" }]
  },
  careers: {
    table: "careers",
    fields: ["faculty_id", "name", "level"],
    required: ["faculty_id", "name", "level"],
    searchable: ["c.name", "f.name", "c.level"],
    select: `SELECT c.id, c.faculty_id, f.name AS faculty_name,
                    c.name, c.level
             FROM careers c JOIN faculties f ON f.id = c.faculty_id`,
    order: "c.id DESC",
    idAlias: "c",
    sort: { id: "c.id", name: "c.name", faculty_name: "f.name", level: "c.level" },
    columns: [
      { key: "name", label: "Escuela profesional" },
      { key: "faculty_name", label: "Facultad" },
      { key: "level", label: "Nivel" }
    ]
  },
  students: {
    table: "students",
    fields: ["university_code", "full_name", "is_active", "career_id"],
    required: ["university_code", "full_name"],
    searchable: ["s.university_code", "s.full_name", "c.name", "f.name"],
    select: `SELECT s.id, s.university_code, s.full_name, s.is_active,
                    s.career_id, c.name AS career_name, f.name AS faculty_name
             FROM students s
             LEFT JOIN careers c ON c.id = s.career_id
             LEFT JOIN faculties f ON f.id = c.faculty_id`,
    order: "s.id DESC",
    idAlias: "s",
    sort: { id: "s.id", university_code: "s.university_code", full_name: "s.full_name", is_active: "s.is_active" },
    columns: [
      { key: "university_code", label: "Código universitario" },
      { key: "full_name", label: "Apellidos y nombres" },
      { key: "career_name", label: "Escuela profesional" },
      { key: "faculty_name", label: "Facultad" },
      { key: "is_active", label: "Activo" }
    ]
  },
  sections: {
    table: "sections",
    fields: ["course_code", "section_code", "academic_period_id", "vacancies", "career_id"],
    required: ["course_code", "section_code", "academic_period_id", "vacancies"],
    searchable: ["s.course_code", "s.section_code", "p.name", "c.name", "f.name"],
    select: `SELECT s.id, s.course_code, s.section_code, s.academic_period_id,
                    p.name AS period_name, s.vacancies, s.enrolled,
                    s.career_id, c.name AS career_name, f.name AS faculty_name
             FROM sections s
             JOIN academic_periods p ON p.id = s.academic_period_id
             LEFT JOIN careers c ON c.id = s.career_id
             LEFT JOIN faculties f ON f.id = c.faculty_id`,
    order: "s.id DESC",
    idAlias: "s",
    sort: { id: "s.id", course_code: "s.course_code", section_code: "s.section_code", vacancies: "s.vacancies", enrolled: "s.enrolled" },
    columns: [
      { key: "course_code", label: "Código asignatura" },
      { key: "section_code", label: "Sección" },
      { key: "period_name", label: "Periodo" },
      { key: "career_name", label: "Escuela profesional" },
      { key: "vacancies", label: "Vacantes" },
      { key: "enrolled", label: "Matriculados" }
    ]
  }
};

function getResource(name) {
  const resource = resources[name];
  if (!resource) throw new AppError("Recurso administrativo no permitido.", "RESOURCE_NOT_FOUND", 404);
  return resource;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new AppError("El identificador debe ser un entero positivo.", "INVALID_ID", 422);
  }
  return id;
}

function normalizePayload(resource, body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("El cuerpo debe ser un objeto JSON.", "INVALID_BODY", 422);
  }
  const data = {};
  const maxLengths = {
    name: 150, level: 10, university_code: 20,
    full_name: 150, course_code: 20, section_code: 10
  };
  for (const field of resource.fields) {
    if (!(field in body)) continue;
    let value = body[field];

    if (["faculty_id", "career_id", "academic_period_id", "vacancies"].includes(field)) {
      if (value === "" || value === null) {
        if (field === "career_id") { data[field] = null; continue; }
        throw new AppError(`El campo ${field} es obligatorio.`, "VALIDATION_ERROR", 422);
      }
      value = Number(value);
      if (!Number.isSafeInteger(value) || value < 0 || (field !== "vacancies" && value === 0)) {
        throw new AppError(`El campo ${field} debe ser un entero válido.`, "VALIDATION_ERROR", 422);
      }
    }

    if (["is_active"].includes(field)) {
      if (typeof value === "string") value = value.toLowerCase() === "true";
      if (typeof value !== "boolean") {
        throw new AppError(`El campo ${field} debe ser booleano.`, "VALIDATION_ERROR", 422);
      }
    }

    if (["name", "level", "university_code", "full_name", "course_code", "section_code"].includes(field)) {
      if (typeof value !== "string") {
        throw new AppError(`El campo ${field} debe ser texto.`, "VALIDATION_ERROR", 422);
      }
      value = value.trim();
      if (!value && resource.required.includes(field)) {
        throw new AppError(`El campo ${field} no puede estar vacío.`, "VALIDATION_ERROR", 422);
      }
      if (maxLengths[field] && value.length > maxLengths[field]) {
        throw new AppError(`El campo ${field} supera el máximo de ${maxLengths[field]} caracteres.`, "VALIDATION_ERROR", 422);
      }
    }
    data[field] = value;
  }

  if (!partial) {
    for (const field of resource.required) {
      if (!(field in data) || data[field] === "") {
        throw new AppError(`Falta el campo obligatorio ${field}.`, "VALIDATION_ERROR", 422);
      }
    }
  }
  if (Object.keys(data).length === 0) {
    throw new AppError("No se recibieron campos editables.", "EMPTY_UPDATE", 422);
  }
  return data;
}

function handleDatabaseError(error) {
  if (error.code === "23505") {
    throw new AppError("Ya existe un registro con esos datos únicos.", "DUPLICATE_RECORD", 409);
  }
  if (error.code === "23503") {
    throw new AppError("No se puede eliminar o modificar el registro porque está relacionado con otros datos.", "RELATED_RECORD", 409);
  }
  if (error.code === "23514" || error.code === "22P02") {
    throw new AppError("Los datos no cumplen las restricciones de la tabla.", "CONSTRAINT_VIOLATION", 422);
  }
  throw error;
}

// GET /api/v1/admin/:resource?page=1&pageSize=10&search=
adminRouter.get("/:resource", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource);
    const requestedPage = Number.parseInt(req.query.page ?? "1", 10);
    const requestedSize = Number.parseInt(req.query.pageSize ?? "10", 10);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = Number.isSafeInteger(requestedSize) ? Math.min(100, Math.max(1, requestedSize)) : 10;
    const search = String(req.query.search ?? "").trim().slice(0, 100);
    const sortKey = String(req.query.sort ?? "id");
    const sortColumn = resource.sort?.[sortKey] ?? resource.sort?.id;
    const sortDirection = String(req.query.direction ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const offset = (page - 1) * pageSize;
    const params = [];
    let where = "";

    if (search && resource.searchable.length) {
      params.push(`%${search}%`);
      const conditions = resource.searchable.map((column) => `${column} ILIKE $1`);
      where = ` WHERE (${conditions.join(" OR ")})`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM (${resource.select}${where}) AS filtered`,
      params
    );
    const dataResult = await pool.query(
      `${resource.select}${where} ORDER BY ${sortColumn} ${sortDirection} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    res.status(200).json({
      data: dataResult.rows,
      pagination: {
        page, pageSize, total: countResult.rows[0].total,
        totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / pageSize))
      },
      columns: resource.columns,
      sorting: { sort: sortKey, direction: sortDirection.toLowerCase() },
      requestId: req.requestId
    });
  } catch (error) { next(error); }
});

// GET /api/v1/admin/:resource/:id
adminRouter.get("/:resource/:id", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource);
    const id = parseId(req.params.id);
    const result = await pool.query(`${resource.select} WHERE ${resource.idAlias}.id = $1`, [id]);
    if (!result.rowCount) throw new AppError("Registro no encontrado.", "RECORD_NOT_FOUND", 404);
    res.json({ data: result.rows[0], requestId: req.requestId });
  } catch (error) { next(error); }
});

// POST /api/v1/admin/:resource
adminRouter.post("/:resource", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource);
    const data = normalizePayload(resource, req.body);
    const fields = Object.keys(data);
    const values = fields.map((field) => data[field]);
    const placeholders = fields.map((_, index) => `$${index + 1}`);
    const result = await pool.query(
      `INSERT INTO ${resource.table} (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    res.status(201).json({ data: result.rows[0], requestId: req.requestId });
  } catch (error) { try { handleDatabaseError(error); } catch (safeError) { next(safeError); } }
});

// PUT /api/v1/admin/:resource/:id
adminRouter.put("/:resource/:id", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource);
    const id = parseId(req.params.id);
    const data = normalizePayload(resource, req.body, true);
    const fields = Object.keys(data);
    const assignments = fields.map((field, index) => `${field} = $${index + 1}`);
    const values = fields.map((field) => data[field]);
    values.push(id);
    const result = await pool.query(
      `UPDATE ${resource.table} SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rowCount) throw new AppError("Registro no encontrado.", "RECORD_NOT_FOUND", 404);
    res.json({ data: result.rows[0], requestId: req.requestId });
  } catch (error) { try { handleDatabaseError(error); } catch (safeError) { next(safeError); } }
});

// DELETE /api/v1/admin/:resource/:id
adminRouter.delete("/:resource/:id", async (req, res, next) => {
  try {
    const resource = getResource(req.params.resource);
    const id = parseId(req.params.id);
    const result = await pool.query(`DELETE FROM ${resource.table} WHERE id = $1 RETURNING id`, [id]);
    if (!result.rowCount) throw new AppError("Registro no encontrado.", "RECORD_NOT_FOUND", 404);
    res.json({ data: { id: result.rows[0].id, deleted: true }, requestId: req.requestId });
  } catch (error) { try { handleDatabaseError(error); } catch (safeError) { next(safeError); } }
});

export const resourceDefinitions = resources;
