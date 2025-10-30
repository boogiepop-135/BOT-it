FROM node:18-bullseye-slim AS build

WORKDIR /app
COPY package*.json ./
# Instalar dependencias completas (incluye dev) para poder construir
RUN npm ci
COPY . .
RUN npm run build

# Runtime
FROM node:18-bullseye-slim

# Dependencias del SO para Puppeteer/Chromium + ffmpeg
RUN apt-get update && apt-get install -y \
    chromium ffmpeg ca-certificates fonts-liberation \
    libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 \
    libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
    libgtk-3-0 libnss3 libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
    libxrandr2 libxrender1 libxss1 libxtst6 wget xdg-utils \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
# Instalar solo dependencias de producción para un contenedor más liviano
RUN npm ci --omit=dev

# Copiar artefactos construidos
COPY --from=build /app/build ./build
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node","build/index.js"]


