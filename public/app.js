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


// -----------------------------------------------------------------------------
// Administración de catálogos: CRUD genérico con lista blanca de entidades.
// -----------------------------------------------------------------------------
const adminMeta = {
  academic_periods: {
    title: "Periodos académicos",
    sort: [["id","Más recientes"],["name","Nombre"],["is_active","Estado"]],
    fields: [
      { name: "name", label: "Nombre del periodo", type: "text", required: true, placeholder: "2027-I" },
      { name: "is_active", label: "Periodo activo", type: "checkbox", defaultValue: false }
    ]
  },
  faculties: {
    title: "Facultades",
    sort: [["id","Más recientes"],["name","Nombre"]],
    fields: [{ name: "name", label: "Nombre de la facultad", type: "text", required: true }]
  },
  careers: {
    title: "Escuelas profesionales",
    sort: [["id","Más recientes"],["name","Nombre"],["faculty_name","Facultad"],["level","Nivel"]],
    fields: [
      { name: "faculty_id", label: "Facultad", type: "select", source: "faculties", required: true },
      { name: "name", label: "Nombre de la escuela", type: "text", required: true },
      { name: "level", label: "Nivel", type: "text", required: true, defaultValue: "S1" }
    ]
  },
  students: {
    title: "Estudiantes",
    sort: [["id","Más recientes"],["university_code","Código"],["full_name","Apellidos y nombres"],["is_active","Estado"]],
    fields: [
      { name: "university_code", label: "Código universitario", type: "text", required: true },
      { name: "full_name", label: "Apellidos y nombres", type: "text", required: true },
      { name: "career_id", label: "Escuela profesional", type: "select", source: "careers", optional: true },
      { name: "is_active", label: "Estudiante activo", type: "checkbox", defaultValue: true }
    ]
  },
  sections: {
    title: "Secciones",
    sort: [["id","Más recientes"],["course_code","Asignatura"],["section_code","Sección"],["vacancies","Vacantes"],["enrolled","Matriculados"]],
    fields: [
      { name: "course_code", label: "Código de asignatura", type: "text", required: true },
      { name: "section_code", label: "Código de sección", type: "text", required: true },
      { name: "academic_period_id", label: "Periodo académico", type: "select", source: "academic_periods", required: true },
      { name: "career_id", label: "Escuela profesional", type: "select", source: "careers", optional: true },
      { name: "vacancies", label: "Vacantes", type: "number", required: true, min: 0 }
    ]
  }
};

const adminResource = document.querySelector("#adminResource");
const adminSearch = document.querySelector("#adminSearch");
const adminPageSize = document.querySelector("#adminPageSize");
const adminSort = document.querySelector("#adminSort");
const adminDirection = document.querySelector("#adminDirection");
const adminHead = document.querySelector("#adminHead");
const adminBody = document.querySelector("#adminBody");
const adminFormContainer = document.querySelector("#adminFormContainer");
let adminPage = 1;
let adminTotalPages = 1;
let adminEditingId = null;

async function adminRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const body = contentType.includes("application/json") ? await response.json() : {};
    throw new Error(body.error?.message || `Error HTTP ${response.status}`);
  }
  return contentType.includes("application/json") ? response.json() : response;
}

function appendCell(row, value) {
  const cell = row.insertCell();
  cell.textContent = value === null || value === undefined ? "—" :
    typeof value === "boolean" ? (value ? "Sí" : "No") : String(value);
  return cell;
}

async function loadAdminRows() {
  const resource = adminResource.value;
  const query = new URLSearchParams({
    page: String(adminPage),
    pageSize: adminPageSize.value,
    search: adminSearch.value.trim(),
    sort: adminSort?.value || "id",
    direction: adminDirection?.value || "desc"
  });
  try {
    const result = await adminRequest(`/api/v1/admin/${resource}?${query}`);
    adminHead.replaceChildren();
    const header = adminHead.insertRow();
    appendCell(header, "ID");
    result.columns.forEach((column) => appendCell(header, column.label));
    appendCell(header, "ACCIONES");
    adminBody.replaceChildren();

    if (!result.data.length) {
      const row = adminBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = result.columns.length + 2;
      cell.className = "empty-cell";
      cell.textContent = "No se encontraron registros para los criterios indicados.";
    } else {
      result.data.forEach((item) => {
        const row = adminBody.insertRow();
        appendCell(row, item.id);
        result.columns.forEach((column) => appendCell(row, item[column.key]));
        const actions = row.insertCell();
        actions.className = "action-cell";
        const edit = document.createElement("button");
        edit.className = "secondary-button";
        edit.type = "button";
        edit.textContent = "Editar";
        edit.addEventListener("click", () => openAdminForm(item));
        const remove = document.createElement("button");
        remove.className = "secondary-button";
        remove.type = "button";
        remove.textContent = "Eliminar";
        remove.addEventListener("click", () => deleteAdminRow(item.id));
        actions.append(edit, remove);
      });
    }
    adminTotalPages = result.pagination.totalPages;
    document.querySelector("#adminPageInfo").textContent =
      `Página ${result.pagination.page} de ${result.pagination.totalPages} · ${result.pagination.total} registros`;
    document.querySelector("#adminPrev").disabled = adminPage <= 1;
    document.querySelector("#adminNext").disabled = adminPage >= adminTotalPages;
  } catch (error) {
    adminBody.replaceChildren();
    const row = adminBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 8;
    cell.className = "empty-cell";
    cell.textContent = `No se pudo cargar el catálogo: ${error.message}`;
  }
}

async function getSelectOptions(source) {
  const result = await adminRequest(`/api/v1/admin/${source}?page=1&pageSize=100`);
  return result.data;
}

async function openAdminForm(item = null) {
  adminEditingId = item?.id ?? null;
  const resource = adminResource.value;
  const meta = adminMeta[resource];
  adminFormContainer.hidden = false;
  adminFormContainer.replaceChildren();

  const formElement = document.createElement("form");
  formElement.className = "admin-form";
  const title = document.createElement("h3");
  title.textContent = `${adminEditingId ? "Editar" : "Nuevo registro"} · ${meta.title}`;
  formElement.append(title);

  const grid = document.createElement("div");
  grid.className = "admin-form-grid";
  for (const field of meta.fields) {
    const wrapper = document.createElement("div");
    wrapper.className = field.type === "checkbox" ? "admin-field checkbox-field" : "admin-field";
    const label = document.createElement("label");
    label.htmlFor = `admin-${field.name}`;
    label.textContent = field.label;
    let input;

    if (field.type === "select") {
      input = document.createElement("select");
      const options = await getSelectOptions(field.source);
      input.add(new Option(field.optional ? "— Sin asignar —" : "Seleccione…", ""));
      options.forEach((option) => {
        const labelValue = option.name || option.full_name || option.university_code || option.period_name;
        const display = field.source === "faculties" ? option.name :
          field.source === "careers" ? `${option.name} · ${option.faculty_name || ""}` :
          field.source === "academic_periods" ? option.name : labelValue;
        input.add(new Option(display, option.id));
      });
      if (item?.[field.name] !== undefined && item[field.name] !== null) input.value = item[field.name];
      input.required = Boolean(field.required);
      wrapper.append(label, input);
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = item ? Boolean(item[field.name]) : Boolean(field.defaultValue);
      wrapper.append(input, label);
    } else {
      input = document.createElement("input");
      input.type = field.type;
      input.placeholder = field.placeholder || "";
      input.required = Boolean(field.required);
      if (field.min !== undefined) input.min = String(field.min);
      input.value = item?.[field.name] ?? field.defaultValue ?? "";
      wrapper.append(label, input);
    }
    input.id = `admin-${field.name}`;
    input.name = field.name;
    if (field.type === "checkbox") input.setAttribute("aria-label", field.label);
    grid.append(wrapper);
  }
  formElement.append(grid);

  const actions = document.createElement("div");
  actions.className = "admin-form-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary-button";
  cancel.textContent = "Cancelar";
  cancel.addEventListener("click", () => { adminFormContainer.hidden = true; });
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "primary-button";
  save.textContent = adminEditingId ? "Guardar cambios" : "Crear registro";
  actions.append(cancel, save);
  formElement.append(actions);

  formElement.addEventListener("submit", async (event) => {
    event.preventDefault();
    save.disabled = true;
    const payload = {};
    for (const field of meta.fields) {
      const control = formElement.elements.namedItem(field.name);
      if (field.type === "checkbox") payload[field.name] = control.checked;
      else if (field.type === "number") payload[field.name] = Number(control.value);
      else if (field.type === "select") payload[field.name] = control.value === "" && field.optional ? null :
        (control.value === "" ? "" : Number(control.value));
      else payload[field.name] = control.value.trim();
    }
    try {
      const url = `/api/v1/admin/${resource}${adminEditingId ? `/${adminEditingId}` : ""}`;
      await adminRequest(url, {
        method: adminEditingId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      adminFormContainer.hidden = true;
      await loadAdminRows();
      await refreshDashboard();
      await loadReports();
      showFeedback("Registro guardado correctamente.", "success");
    } catch (error) {
      showFeedback(error.message, "error");
    } finally {
      save.disabled = false;
    }
  });

  adminFormContainer.append(formElement);
  formElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function deleteAdminRow(id) {
  const resource = adminResource.value;
  if (!window.confirm(`¿Confirma eliminar el registro ${id}? Esta acción respeta las relaciones académicas.`)) return;
  try {
    await adminRequest(`/api/v1/admin/${resource}/${id}`, { method: "DELETE" });
    await loadAdminRows();
    await refreshDashboard();
    await loadReports();
    showFeedback("Registro eliminado correctamente.", "success");
  } catch (error) {
    showFeedback(error.message, "error");
  }
}

async function loadReports() {
  const result = await adminRequest("/api/v1/reports/summary");
  const totals = result.data.totals;
  const labels = [
    ["Periodos", totals.academic_periods], ["Facultades", totals.faculties],
    ["Escuelas", totals.careers], ["Estudiantes", totals.students],
    ["Secciones", totals.sections], ["Matrículas", totals.enrollments]
  ];
  const totalContainer = document.querySelector("#reportTotals");
  totalContainer.replaceChildren();
  labels.forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "report-kpi";
    const caption = document.createElement("span");
    caption.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    card.append(caption, number);
    totalContainer.append(card);
  });

  const facultyBody = document.querySelector("#reportFacultyRows");
  facultyBody.replaceChildren();
  result.data.faculties.forEach((item) => {
    const row = facultyBody.insertRow();
    appendCell(row, item.faculty);
    appendCell(row, item.careers);
    appendCell(row, item.students);
  });

  const periodBody = document.querySelector("#reportPeriodRows");
  periodBody.replaceChildren();
  result.data.periods.forEach((item) => {
    const row = periodBody.insertRow();
    appendCell(row, item.period);
    appendCell(row, item.is_active ? "Activo" : "Inactivo");
    appendCell(row, item.sections);
    appendCell(row, item.enrollments);
  });
}

// Eventos de navegación, búsqueda, paginación y exportación.
adminResource?.addEventListener("change", () => {
  adminPage = 1;
  adminFormContainer.hidden = true;
  updateSelectedResourceExports();
  loadAdminRows();
});
document.querySelector("#adminSearchButton")?.addEventListener("click", () => { adminPage = 1; loadAdminRows(); });
adminSearch?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); adminPage = 1; loadAdminRows(); }
});
adminPageSize?.addEventListener("change", () => { adminPage = 1; loadAdminRows(); });
adminSort?.addEventListener("change", () => { adminPage = 1; loadAdminRows(); });
adminDirection?.addEventListener("change", () => { adminPage = 1; loadAdminRows(); });
document.querySelector("#adminCreateButton")?.addEventListener("click", () => openAdminForm());
document.querySelector("#adminPrev")?.addEventListener("click", () => { if (adminPage > 1) { adminPage--; loadAdminRows(); } });
document.querySelector("#adminNext")?.addEventListener("click", () => { if (adminPage < adminTotalPages) { adminPage++; loadAdminRows(); } });

// Cargar el primer catálogo y los reportes al iniciar el dashboard.
updateSelectedResourceExports();
loadAdminRows();
loadReports().catch((error) => {
  document.querySelector("#reportTotals").textContent = `No se pudieron cargar los reportes: ${error.message}`;
});

// -----------------------------------------------------------------------------
// Visor PDF y exportación individual del catálogo seleccionado.
// -----------------------------------------------------------------------------
const pdfViewer = document.querySelector("#pdfViewerDialog");
const pdfFrame = document.querySelector("#pdfViewerFrame");
const pdfTitle = document.querySelector("#pdfViewerTitle");
const pdfDownload = document.querySelector("#pdfDownloadLink");

function showPdfReport(url, title) {
  pdfTitle.textContent = title;
  pdfFrame.src = url;
  pdfDownload.href = `${url}${url.includes("?") ? "&" : "?"}download=1`;
  if (typeof pdfViewer.showModal === "function") pdfViewer.showModal();
  else window.open(url, "_blank", "noopener");
}

function updateSelectedResourceExports() {
  const resource = adminResource.value;
  const title = adminMeta[resource]?.title || "Reporte académico";
  if (adminSort) {
    const previousSort = adminSort.value;
    adminSort.replaceChildren();
    (adminMeta[resource]?.sort || [["id","ID"]]).forEach(([value,label]) => {
      adminSort.add(new Option(`Ordenar: ${label}`, value));
    });
    if ([...adminSort.options].some((option) => option.value === previousSort)) adminSort.value = previousSort;
  }
  const excelLink = document.querySelector("#adminExcelButton");
  if (excelLink) excelLink.href = `/api/v1/reports/${encodeURIComponent(resource)}.xlsx`;
  const pdfButton = document.querySelector("#adminPdfButton");
  if (pdfButton) pdfButton.dataset.title = title;
}

document.querySelector("#adminPdfButton")?.addEventListener("click", () => {
  const resource = adminResource.value;
  showPdfReport(`/api/v1/reports/${encodeURIComponent(resource)}.pdf`, `Reporte · ${adminMeta[resource].title}`);
});
document.querySelector("#summaryPdfButton")?.addEventListener("click", () => {
  showPdfReport("/api/v1/reports/summary.pdf", "Reporte ejecutivo académico SGU–UNJBG");
});
document.querySelector("#pdfViewerClose")?.addEventListener("click", () => {
  pdfViewer.close();
  pdfFrame.src = "about:blank";
});
pdfViewer?.addEventListener("click", (event) => {
  if (event.target === pdfViewer) {
    pdfViewer.close();
    pdfFrame.src = "about:blank";
  }
});


// Exportación individual desde el panel de reportes (incluye matrículas).
const reportResourceSelect = document.querySelector("#reportResource");
const reportExcelButton = document.querySelector("#reportExcelButton");
function updateReportExportLink() {
  if (reportResourceSelect && reportExcelButton) {
    reportExcelButton.href = `/api/v1/reports/${encodeURIComponent(reportResourceSelect.value)}.xlsx`;
  }
}
reportResourceSelect?.addEventListener("change", updateReportExportLink);
document.querySelector("#reportPreviewButton")?.addEventListener("click", () => {
  const resource = reportResourceSelect.value;
  const label = reportResourceSelect.options[reportResourceSelect.selectedIndex].text;
  showPdfReport(`/api/v1/reports/${encodeURIComponent(resource)}.pdf`, `Reporte · ${label}`);
});
updateReportExportLink();
