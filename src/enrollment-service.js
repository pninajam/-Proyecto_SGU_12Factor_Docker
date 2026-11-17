// Importar el pool que gestiona las conexiones a PostgreSQL.
import { pool } from "./db.js";
// Importar errores controlados del dominio.
import { AppError } from "./errors.js";

// Crear una matrícula para un estudiante en una sección.
export async function createEnrollment({ studentId, sectionId, requestId }) {
  // Rechazar identificadores que no sean enteros positivos.
  if (!Number.isInteger(studentId) || studentId <= 0) {
    // Comunicar una validación de entrada sin consultar la base de datos.
    throw new AppError("studentId debe ser un entero positivo.", "INVALID_STUDENT_ID", 422);
  }
  // Validar el identificador de la sección.
  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    // Comunicar el error de validación de sección.
    throw new AppError("sectionId debe ser un entero positivo.", "INVALID_SECTION_ID", 422);
  }

  // Obtener una conexión exclusiva para la transacción.
  const client = await pool.connect();
  // Inicializar una variable para conocer si la transacción comenzó.
  let transactionStarted = false;

  try {
    // Iniciar la transacción para evitar escrituras parciales.
    await client.query("BEGIN");
    // Marcar que la transacción ya puede requerir rollback.
    transactionStarted = true;

    // Bloquear la sección mientras se verifica y registra la matrícula.
    const sectionResult = await client.query(
      `SELECT s.id, s.academic_period_id, s.vacancies, s.enrolled,
              p.is_active
       FROM sections s
       JOIN academic_periods p ON p.id = s.academic_period_id
       WHERE s.id = $1
       FOR UPDATE OF s`,
      [sectionId]
    );

    // Rechazar una sección inexistente.
    if (sectionResult.rowCount === 0) {
      throw new AppError("La sección solicitada no existe.", "SECTION_NOT_FOUND", 404);
    }

    // Obtener los datos bloqueados de la sección y su periodo.
    const section = sectionResult.rows[0];

    // Verificar que el periodo académico permita matrículas.
    if (!section.is_active) {
      throw new AppError("El periodo académico no está habilitado.", "PERIOD_CLOSED", 409);
    }

    // Comprobar que el estudiante exista antes de registrar la matrícula.
    const studentResult = await client.query(
      "SELECT id FROM students WHERE id = $1 AND is_active = TRUE",
      [studentId]
    );

    // Rechazar estudiantes inexistentes o inactivos.
    if (studentResult.rowCount === 0) {
      throw new AppError("El estudiante no existe o está inactivo.", "STUDENT_NOT_FOUND", 404);
    }

    // Evitar que el mismo estudiante se matricule dos veces en la misma sección.
    const duplicateResult = await client.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND section_id = $2",
      [studentId, sectionId]
    );

    // Devolver conflicto si ya existe la matrícula.
    if (duplicateResult.rowCount > 0) {
      throw new AppError("El estudiante ya está matriculado en esta sección.", "DUPLICATE_ENROLLMENT", 409);
    }

    // Verificar que la sección tenga vacantes disponibles.
    if (section.enrolled >= section.vacancies) {
      throw new AppError("La sección no tiene vacantes disponibles.", "NO_VACANCIES", 409);
    }

    // Insertar la matrícula y recuperar el identificador generado.
    const enrollmentResult = await client.query(
      `INSERT INTO enrollments (student_id, section_id, request_id)
       VALUES ($1, $2, $3)
       RETURNING id, student_id, section_id, created_at`,
      [studentId, sectionId, requestId]
    );

    // Incrementar el contador de vacantes ocupadas dentro de la misma transacción.
    await client.query(
      "UPDATE sections SET enrolled = enrolled + 1 WHERE id = $1",
      [sectionId]
    );

    // Confirmar las dos escrituras como una sola unidad atómica.
    await client.query("COMMIT");
    // Marcar la transacción como finalizada.
    transactionStarted = false;

    // Devolver el registro creado al controlador HTTP.
    return enrollmentResult.rows[0];
  } catch (error) {
    // Revertir cualquier escritura si la transacción sigue abierta.
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    // Propagar el error para que el middleware lo traduzca.
    throw error;
  } finally {
    // Devolver siempre la conexión al pool, incluso si hubo error.
    client.release();
  }
}
