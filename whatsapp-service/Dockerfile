# WhatsApp QR service — runs whatsapp-web.js with a system Chromium.
FROM node:20-slim

# Chromium + the libraries it needs (so puppeteer doesn't download its own).
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ca-certificates fonts-liberation \
    libnss3 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 libgbm1 \
    libasound2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxkbcommon0 \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 8080
CMD ["node", "index.js"]
