// Importar el módulo nativo para acceder al entorno del proceso.
const env = process.env;

// Convertir una variable a entero y rechazar valores inválidos.
function readInteger(name, fallback) {
  // Obtener el valor de entorno o usar el valor predeterminado.
  const raw = env[name] ?? String(fallback);
  // Convertir el texto recibido a número entero.
  const value = Number.parseInt(raw, 10);
  // Comprobar que el resultado sea un entero válido.
  if (!Number.isInteger(value)) {
    // Detener el arranque porque la configuración es inválida.
    throw new Error(`La variable ${name} debe ser un número entero.`);
  }
  // Devolver el valor validado.
  return value;
}

// Leer una variable obligatoria y evitar que se inicie con un valor vacío.
function required(name) {
  // Leer y limpiar espacios al inicio y al final.
  const value = (env[name] ?? "").trim();
  // Rechazar variables ausentes o vacías.
  if (!value) {
    // Informar únicamente el nombre de la variable, nunca su contenido.
    throw new Error(`Falta la variable obligatoria ${name}.`);
  }
  // Entregar el valor para construir la configuración.
  return value;
}

// Construir la configuración una sola vez al iniciar el proceso.
export const config = Object.freeze({
  // Identificar el entorno sin incluir secretos.
  appEnv: env.APP_ENV ?? "development",
  // Definir el puerto HTTP y permitir su modificación por entorno.
  port: readInteger("PORT", 8080),
  // Resolver el host del servicio PostgreSQL.
  dbHost: required("DB_HOST"),
  // Resolver el puerto TCP de PostgreSQL.
  dbPort: readInteger("DB_PORT", 5432),
  // Resolver el nombre de la base de datos.
  dbDatabase: required("DB_DATABASE"),
  // Resolver el usuario de conexión.
  dbUsername: required("DB_USERNAME"),
  // Resolver la contraseña desde el entorno de ejecución.
  dbPassword: required("DB_PASSWORD"),
  // Configurar el tiempo máximo de espera de conexión.
  dbConnectTimeoutMs: readInteger("DB_CONNECT_TIMEOUT_MS", 3000)
});
