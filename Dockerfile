FROM node:18-bullseye

# System dependencies for headless Chrome (Remotion/Puppeteer) + FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libxshmfence1 \
    fonts-noto \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* ./
RUN npm install

# Install Chromium for Remotion
RUN npx remotion browser ensure

# Copy project files
COPY . .

# Environment
ENV NODE_ENV=production

# Start the render worker
CMD ["npx", "tsx", "src/lib/render-worker/worker.ts"]
