// Importar el ejecutor de pruebas integrado en Node.js.
import test from "node:test";
// Importar las aserciones integradas.
import assert from "node:assert/strict";
// Importar el error de dominio.
import { AppError, publicError } from "../src/errors.js";

// Verificar que los errores de dominio conservan su contrato HTTP.
test("AppError expone estado y código controlados", () => {
  // Crear un error de validación representativo.
  const error = new AppError("Dato inválido.", "INVALID_DATA", 422);
  // Traducir el error a su forma pública.
  const result = publicError(error);
  // Comprobar el estado HTTP esperado.
  assert.equal(result.status, 422);
  // Comprobar el código estable para el cliente.
  assert.equal(result.code, "INVALID_DATA");
  // Comprobar el mensaje seguro.
  assert.equal(result.message, "Dato inválido.");
});

// Verificar que los errores desconocidos no filtran detalles internos.
test("un error desconocido se convierte en respuesta genérica", () => {
  // Simular una excepción que podría contener detalles sensibles.
  const error = new Error("SELECT password FROM private_table");
  // Traducir el error a su forma pública.
  const result = publicError(error);
  // Comprobar que se responde como error interno.
  assert.equal(result.status, 500);
  // Comprobar que no se devuelve el SQL original.
  assert.equal(result.message.includes("SELECT"), false);
});
