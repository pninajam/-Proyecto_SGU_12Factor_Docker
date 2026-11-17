// Importar el pool compartido con la configuración de entorno.
import { pool } from "../db.js";
// Importar el logger para registrar el proceso administrativo.
import { log } from "../logger.js";

// Definir el esquema inicial del módulo de matrícula.
const schema = `
  BEGIN;
  CREATE TABLE IF NOT EXISTS academic_periods (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS faculties (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS careers (
    id BIGSERIAL PRIMARY KEY,
    faculty_id BIGINT NOT NULL REFERENCES faculties(id),
    name VARCHAR(150) NOT NULL,
    level VARCHAR(10) NOT NULL DEFAULT 'S1',
    UNIQUE (faculty_id, name)
  );

  CREATE TABLE IF NOT EXISTS students (
    id BIGSERIAL PRIMARY KEY,
    university_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    career_id BIGINT REFERENCES careers(id)
  );
  ALTER TABLE students ADD COLUMN IF NOT EXISTS career_id BIGINT REFERENCES careers(id);

  CREATE TABLE IF NOT EXISTS sections (
    id BIGSERIAL PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL,
    section_code VARCHAR(10) NOT NULL,
    academic_period_id BIGINT NOT NULL REFERENCES academic_periods(id),
    vacancies INTEGER NOT NULL CHECK (vacancies >= 0),
    enrolled INTEGER NOT NULL DEFAULT 0 CHECK (enrolled >= 0),
    career_id BIGINT REFERENCES careers(id),
    UNIQUE (course_code, section_code, academic_period_id),
    CHECK (enrolled <= vacancies)
  );

  ALTER TABLE sections ADD COLUMN IF NOT EXISTS career_id BIGINT REFERENCES careers(id);

  CREATE TABLE IF NOT EXISTS enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id),
    section_id BIGINT NOT NULL REFERENCES sections(id),
    request_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, section_id)
  );

  INSERT INTO academic_periods (id, name, is_active)
  VALUES (1, '2026-II', TRUE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO faculties (id, name) VALUES
    (1, 'Facultad de Ingeniería'),
    (2, 'Facultad de Ciencias'),
    (3, 'Facultad de Ciencias Jurídicas y Empresariales')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO careers (id, faculty_id, name, level) VALUES
    (1, 1, 'Ingeniería en Informática y Sistemas', 'S1'),
    (2, 1, 'Ingeniería Civil', 'S1'),
    (3, 2, 'Matemática', 'S1'),
    (4, 3, 'Administración', 'S1')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO students (id, university_code, full_name, is_active, career_id) VALUES
    (1, '20260001', 'Ana Torres Quispe', TRUE, 1),
    (2, '20260002', 'Luis Mamani Flores', TRUE, 1),
    (3, '20260003', 'María Choque Apaza', TRUE, 2),
    (4, '20260004', 'Carlos Condori Rojas', TRUE, 3),
    (5, '20260005', 'Valeria Nina Cárdenas', TRUE, 4)
  ON CONFLICT (id) DO UPDATE SET career_id = EXCLUDED.career_id;

  INSERT INTO sections (id, course_code, section_code, academic_period_id, vacancies, enrolled, career_id) VALUES
    (1, 'ESIS-101', 'A', 1, 30, 0, 1),
    (2, 'ICIV-201', 'A', 1, 25, 0, 2),
    (3, 'MATE-110', 'A', 1, 20, 0, 3),
    (4, 'ADMI-120', 'A', 1, 25, 0, 4)
  ON CONFLICT (id) DO UPDATE SET career_id = EXCLUDED.career_id;
  -- Los IDs de la semilla son explícitos; avanzar secuencias evita futuros duplicados.
  SELECT setval(pg_get_serial_sequence('academic_periods','id'), (SELECT MAX(id) FROM academic_periods));
  SELECT setval(pg_get_serial_sequence('faculties','id'), (SELECT MAX(id) FROM faculties));
  SELECT setval(pg_get_serial_sequence('careers','id'), (SELECT MAX(id) FROM careers));
  SELECT setval(pg_get_serial_sequence('students','id'), (SELECT MAX(id) FROM students));
  SELECT setval(pg_get_serial_sequence('sections','id'), (SELECT MAX(id) FROM sections));
  COMMIT;
`;

// Ejecutar la migración como proceso puntual, no como parte de cada petición HTTP.
try {
  // Aplicar el esquema y los datos de demostración.
  await pool.query(schema);
  // Registrar la finalización de la migración.
  log("INFO", "migration_completed");
} catch (error) {
  // Registrar el fallo de la tarea administrativa.
  log("ERROR", "migration_failed", { code: "MIGRATION_FAILED" });
  // Propagar un código de salida distinto de cero al shell/CI.
  process.exitCode = 1;
} finally {
  // Cerrar el pool porque este proceso puntual ya terminó.
  await pool.end();
}
