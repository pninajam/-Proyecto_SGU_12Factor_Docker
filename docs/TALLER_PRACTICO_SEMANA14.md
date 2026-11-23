# Taller práctico Semana 14 — SGU Cloud-Ready

Guía didáctica completa: `Guia_Taller_Practico_Semana14_SGU_12Factor_Docker_Didactica.docx` (entregada por separado).

## Inicio (PowerShell)
```powershell
Copy-Item .env.example .env
notepad .env
docker compose config
docker compose up --build -d
docker compose ps
docker compose exec api npm run migrate
```
Abrir `http://localhost:8080`; desde otra PC de la LAN `http://IPV4_DEL_SERVIDOR:8080` (permitir TCP 8080 en firewall).

## Endpoints
```powershell
curl.exe -i http://localhost:8080/health/ready
curl.exe -i http://localhost:8080/api/v1/dashboard
curl.exe -i -X POST http://localhost:8080/api/v1/enrollments -H "Content-Type: application/json" -d "{\"studentId\":1,\"sectionId\":1}"
```
Matrícula válida: HTTP 201; duplicada: HTTP 409; ID inválido: HTTP 422.

## Logs y cierre
```powershell
docker compose logs -f api
docker compose down
```
`docker compose down` conserva el volumen. `docker compose down -v` elimina también los datos de laboratorio.

## Lockfile
El proyecto no contiene `package-lock.json`. Con acceso a npm, ejecutar `npm install`, versionar el lockfile y sustituir instalaciones del Dockerfile por `npm ci`.
