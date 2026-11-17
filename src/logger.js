// Crear un logger pequeño que escribe eventos JSON a stdout.
export function log(level, event, context = {}) {
  // Crear un registro con fecha, nivel, servicio y contexto.
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: "sgu-matricula-api",
    environment: process.env.APP_ENV ?? "development",
    event,
    ...context
  };
  // Escribir una línea JSON para que Docker y la plataforma la recolecten.
  process.stdout.write(`${JSON.stringify(record)}\n`);
}
