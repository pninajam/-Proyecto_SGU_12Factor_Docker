// Definir un error de aplicación con código y estado HTTP controlados.
export class AppError extends Error {
  // Recibir mensaje seguro, código estable y estado HTTP.
  constructor(message, code, status = 400) {
    // Inicializar la clase Error con el mensaje.
    super(message);
    // Identificar la clase para diagnóstico y pruebas.
    this.name = "AppError";
    // Guardar un código interno que el cliente puede interpretar.
    this.code = code;
    // Guardar el estado HTTP que debe devolver la API.
    this.status = status;
  }
}

// Traducir errores desconocidos a una respuesta genérica segura.
export function publicError(error) {
  // Si es un error conocido, exponer solo su mensaje controlado.
  if (error instanceof AppError) {
    // Devolver estado, código y mensaje permitidos para el consumidor.
    return { status: error.status, code: error.code, message: error.message };
  }
  // Ocultar detalles internos de errores inesperados.
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Ocurrió un error interno. Consulte el identificador de solicitud."
  };
}
