# Usar sintaxis moderna de Dockerfile.
FROM node:24-alpine AS build
# Definir el directorio de trabajo del builder.
WORKDIR /app
# Copiar los manifiestos antes del código para aprovechar la caché.
COPY package*.json ./
# Instalar las dependencias exactas declaradas en package.json.
# En el taller, generar package-lock.json y sustituir este comando por npm ci.
RUN npm install --no-audit --no-fund
# Copiar el código de la aplicación.
COPY src ./src
# Copiar las pruebas para que npm test pueda ejecutarlas.
COPY test ./test
# Ejecutar pruebas antes de crear la imagen de runtime.
RUN npm test

# Crear una etapa limpia para ejecución.
FROM node:24-alpine AS runtime
# Establecer el directorio de trabajo del servicio.
WORKDIR /app
# Marcar el entorno como producción.
ENV NODE_ENV=production
# Copiar manifiestos para instalar solo dependencias de runtime.
COPY package*.json ./
# Instalar únicamente dependencias de producción.
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
# Copiar el código fuente desde la etapa ya probada.
COPY --from=build /app/src ./src
# Copiar los archivos HTML, CSS y JavaScript que consume el navegador.
COPY public ./public
# Documentar el puerto interno de la API.
EXPOSE 8080
# Ejecutar el contenedor con un usuario sin privilegios.
USER node
# Iniciar el proceso HTTP como proceso principal.
CMD ["node", "src/server.js"]
