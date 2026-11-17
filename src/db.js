// Importar Pool para administrar conexiones reutilizables a PostgreSQL.
import pg from "pg";
import { log } from "./logger.js";
// Importar la configuración validada al inicio.
import { config } from "./config.js";

// Crear un pool compartido para evitar abrir una conexión por operación.
export const pool = new pg.Pool({
  // Dirección del backing service PostgreSQL.
  host: config.dbHost,
  // Puerto de PostgreSQL.
  port: config.dbPort,
  // Base de datos de la aplicación.
  database: config.dbDatabase,
  // Usuario configurado; en el laboratorio Compose crea el administrador inicial.
  user: config.dbUsername,
  // Contraseña inyectada en el entorno de ejecución.
  password: config.dbPassword,
  // Tiempo máximo para establecer una conexión.
  connectionTimeoutMillis: config.dbConnectTimeoutMs,
  // Limitar conexiones simultáneas por instancia.
  max: 10
});

// Evitar que un error de una conexión ociosa termine el proceso sin control.
pool.on("error", () => log("ERROR", "database_pool_error"));

// Verificar conectividad ejecutando una consulta simple.
export async function checkDatabase() {
  // Consultar PostgreSQL y verificar el esquema sin modificar datos.
  // También exige el esquema: antes de migrate la API aún no puede atender el dashboard.
  await pool.query(`SELECT s.id, s.career_id, c.faculty_id, f.id, p.is_active, e.id, st.id
    FROM sections s
    JOIN careers c ON c.id = s.career_id
    JOIN faculties f ON f.id = c.faculty_id
    JOIN academic_periods p ON p.id = s.academic_period_id
    LEFT JOIN enrollments e ON e.section_id = s.id
    LEFT JOIN students st ON st.id = e.student_id
    LIMIT 0`);
}
