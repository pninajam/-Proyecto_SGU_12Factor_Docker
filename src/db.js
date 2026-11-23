// Importar Pool para administrar conexiones reutilizables a PostgreSQL.
import pg from "pg";
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
  // Usuario de mínimo privilegio para el servicio.
  user: config.dbUsername,
  // Contraseña inyectada en el entorno de ejecución.
  password: config.dbPassword,
  // Tiempo máximo para establecer una conexión.
  connectionTimeoutMillis: config.dbConnectTimeoutMs,
  // Limitar conexiones simultáneas por instancia.
  max: 10
});

// Verificar conectividad ejecutando una consulta simple.
export async function checkDatabase() {
  // Consultar PostgreSQL sin modificar datos.
  await pool.query("SELECT 1");
}
