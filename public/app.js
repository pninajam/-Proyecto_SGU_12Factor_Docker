// Usar rutas relativas para que la interfaz funcione con localhost o una IP LAN.
const API = "";
// Obtener los controles HTML que actualizará el navegador.
const form = document.querySelector("#enrollmentForm");
const studentSelect = document.querySelector("#studentId");
const sectionSelect = document.querySelector("#sectionId");
const submitButton = document.querySelector("#submitButton");
const feedback = document.querySelector("#feedback");
const jsonOutput = document.querySelector("#jsonOutput");
const httpStatus = document.querySelector("#httpStatus");
const requestIdOutput = document.querySelector("#requestId");
const enrollmentRows = document.querySelector("#enrollmentRows");

// Mostrar objetos request/response como JSON legible.
function showJson(value) { jsonOutput.textContent = JSON.stringify(value, null, 2); }
// Mostrar mensajes de estado de forma segura usando textContent.
function showFeedback(message, type = "neutral") { feedback.textContent = message; feedback.className = `feedback ${type}`; }
// Ejecutar GET, convertir respuesta a JSON y validar el estado HTTP.
async function getJson(url) {
  const response = await fetch(`${API}${url}`, { headers: { Accept: "application/json" } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `Error HTTP ${response.status}`);
  return body;
}
// Consultar la disponibilidad conjunta de API y PostgreSQL.
async function loadHealth() {
  const result = await getJson("/health/ready");
  const online = result.status === "ready";
  document.querySelector("#connectionDot").classList.toggle("online", online);
  document.querySelector("#sidebarDot").classList.toggle("online", online);
  document.querySelector("#connectionText").textContent = online ? "Servicios operativos" : "Servicio no disponible";
  document.querySelector("#sidebarStatus").textContent = online ? "API y PostgreSQL conectados" : "Servicio no disponible";
  document.querySelector("#apiStatus").textContent = online ? "Operativa" : "No disponible";
}
// Cargar estudiantes y secciones activas en los controles del formulario.
async function loadCatalog() {
  const result = await getJson("/api/v1/catalog");
  const { students, sections } = result.data;
  studentSelect.replaceChildren(new Option("Selecciona un estudiante", ""));
  students.forEach((student) => studentSelect.add(new Option(`${student.university_code} · ${student.full_name}`, student.id)));
  sectionSelect.replaceChildren(new Option("Selecciona una asignatura / sección", ""));
  sections.forEach((section) => {
    const available = Number(section.vacancies) - Number(section.enrolled);
    sectionSelect.add(new Option(`${section.course_code}-${section.section_code} · ${section.academic_period} · ${available} vacantes`, section.id));
  });
}
// Obtener los KPI y el resumen agrupado por facultad y carrera.
async function loadDashboard() {
  const result = await getJson("/api/v1/dashboard");
  const dashboard = result.data;
  document.querySelector("#studentCount").textContent = dashboard.metrics.activeStudents;
  document.querySelector("#enrollmentCount").textContent = dashboard.metrics.enrollments;
  document.querySelector("#vacancyCount").textContent = dashboard.metrics.availableVacancies;
  document.querySelector("#sectionCount").textContent = dashboard.metrics.activeSections;
  document.querySelector("#periodLabel").textContent = dashboard.period;
  document.querySelector("#summaryPeriod").textContent = `Periodo ${dashboard.period}`;
  document.querySelector("#lastUpdated").textContent = new Date().toLocaleTimeString();
  const tbody = document.querySelector("#summaryRows");
  tbody.replaceChildren();
  dashboard.faculties.forEach((faculty, index) => {
    const group = tbody.insertRow(); group.className = "faculty-row";
    group.insertCell().textContent = String(index + 1);
    group.insertCell().textContent = faculty.name;
    group.insertCell().textContent = "";
    [faculty.activeStudents, faculty.enrolledStudents, faculty.availableVacancies].forEach((value) => { const cell = group.insertCell(); cell.textContent = value; cell.className = "numeric"; });
    faculty.careers.forEach((career) => {
      const row = tbody.insertRow(); row.insertCell().textContent = "–";
      const name = row.insertCell(); name.textContent = career.name; name.className = "indent";
      const level = row.insertCell(); const chip = document.createElement("span"); chip.className = "level-chip"; chip.textContent = career.level; level.append(chip);
      [career.activeStudents, career.enrolledStudents, career.availableVacancies].forEach((value) => { const cell = row.insertCell(); cell.textContent = value; cell.className = "numeric"; });
    });
  });
}
// Consultar matrículas persistidas y construir la tabla sin insertar HTML externo.
async function loadEnrollments() {
  const result = await getJson("/api/v1/enrollments");
  const enrollments = result.data;
  document.querySelector("#recordCount").textContent = `${enrollments.length} registros`;
  enrollmentRows.replaceChildren();
  if (enrollments.length === 0) {
    const row = enrollmentRows.insertRow(); const cell = row.insertCell(); cell.colSpan = 6; cell.className = "empty-cell"; cell.textContent = "Todavía no hay matrículas registradas."; return;
  }
  enrollments.forEach((item) => {
    const row = enrollmentRows.insertRow();
    [item.id, item.university_code, item.full_name, `${item.course_code}-${item.section_code}`, item.academic_period, new Date(item.created_at).toLocaleString()].forEach((value) => { row.insertCell().textContent = value; });
  });
}
// Actualizar todos los componentes que dependen de datos del servidor.
async function refreshDashboard() { await loadHealth(); await loadCatalog(); await loadDashboard(); await loadEnrollments(); }
// Inicializar el dashboard y presentar un diagnóstico si falla la conexión.
async function initialize() {
  try { await refreshDashboard(); showFeedback("Conexión correcta. El panel lee datos del backend y PostgreSQL.", "success"); }
  catch (error) { document.querySelector("#connectionText").textContent = "API no disponible"; document.querySelector("#sidebarStatus").textContent = "No se pudo conectar"; showFeedback(error.message, "error"); showJson({ error: error.message, recommendation: "Comprueba docker compose ps y docker compose logs -f api." }); }
}
// Interceptar el formulario y enviar una petición POST en formato JSON.
form.addEventListener("submit", async (event) => {
  event.preventDefault(); submitButton.disabled = true; showFeedback("Enviando solicitud al servicio REST…", "neutral");
  const payload = { studentId: Number(studentSelect.value), sectionId: Number(sectionSelect.value) };
  try {
    const response = await fetch(`${API}/api/v1/enrollments`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    httpStatus.textContent = `HTTP ${response.status}`; httpStatus.className = `http-pill ${response.ok ? "ok" : "fail"}`;
    requestIdOutput.textContent = body.requestId || response.headers.get("x-request-id") || "—";
    showJson({ request: { method: "POST", url: "/api/v1/enrollments", headers: { "Content-Type": "application/json" }, body: payload }, response: { status: response.status, statusText: response.statusText, body } });
    if (!response.ok) throw new Error(body.error?.message || `Error HTTP ${response.status}`);
    showFeedback(`Matrícula ${body.data.id} registrada. El servidor respondió HTTP 201 Created.`, "success"); await refreshDashboard();
  } catch (error) { showFeedback(error.message, "error"); if (!jsonOutput.textContent.includes('"response"')) showJson({ request: { method: "POST", body: payload }, error: error.message }); }
  finally { submitButton.disabled = false; }
});
// Permitir refrescar los indicadores y las tablas sin recargar la página.
document.querySelector("#refreshButton").addEventListener("click", async () => { try { await refreshDashboard(); showFeedback("Dashboard actualizado correctamente.", "success"); } catch (error) { showFeedback(error.message, "error"); } });
// Arrancar la carga de datos al analizar el documento.
initialize();
