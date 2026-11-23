// Importar el servidor HTTP nativo para controlar su ciclo de vida.
import { createServer } from "node:http";
// Importar la aplicación Express.
import { app } from "./app.js";
// Importar configuración validada.
import { config } from "./config.js";
// Importar el pool para cerrarlo al finalizar.
import { pool } from "./db.js";
// Importar logger estructurado.
import { log } from "./logger.js";

// Crear el servidor HTTP a partir de la aplicación.
const server = createServer(app);

// Iniciar el servicio en todas las interfaces del contenedor.
server.listen(config.port, "0.0.0.0", () => {
  // Registrar el arranque sin exponer credenciales.
  log("INFO", "service_started", {
    port: config.port,
    environment: config.appEnv
  });
});

// Definir una función de cierre ordenado ante señales del sistema operativo.
async function shutdown(signal) {
  // Registrar qué señal inició el apagado.
  log("INFO", "shutdown_started", { signal });
  // Dejar de aceptar nuevas conexiones HTTP.
  server.close(async () => {
    try {
      // Cerrar las conexiones del pool de PostgreSQL.
      await pool.end();
      // Registrar que el apagado finalizó correctamente.
      log("INFO", "shutdown_completed", { signal });
      // Finalizar el proceso con código de éxito.
      process.exit(0);
    } catch (error) {
      // Registrar un error resumido de cierre.
      log("ERROR", "shutdown_failed", { message: error.message });
      // Finalizar con código de error.
      process.exit(1);
    }
  });
  // Establecer un límite máximo de espera para evitar cierre infinito.
  setTimeout(() => process.exit(1), 10000).unref();
}

// Atender la señal de terminación habitual de contenedores.
process.on("SIGTERM", () => shutdown("SIGTERM"));
// Atender la señal de interrupción usada en desarrollo local.
process.on("SIGINT", () => shutdown("SIGINT"));
