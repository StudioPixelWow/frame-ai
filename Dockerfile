# ── PixelFrameAI Render Worker ──────────────────────────────────────
# Runs on Railway (Docker deploy). NOT used by Vercel.
#
# Key: node:20-bookworm = Debian 12 = GLIBC 2.36
# Remotion compositor requires GLIBC >= 2.32 (bullseye only has 2.31)
# ────────────────────────────────────────────────────────────────────

FROM node:20-bookworm

# System dependencies for Remotion (headless Chrome) + FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    # Chrome / Chromium runtime deps
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
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxfixes3 \
    libxext6 \
    libx11-6 \
    libxcb1 \
    libxau6 \
    libxdmcp6 \
    libglib2.0-0 \
    libdbus-1-3 \
    # Fonts
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (Docker cache layer)
COPY package.json package-lock.json* ./
RUN npm install

# Install Chromium for Remotion
RUN npx remotion browser ensure

# Copy project files
COPY . .

# Environment — Railway sets its own env vars; this is the baseline
ENV NODE_ENV=production

# Verify GLIBC version at build time (sanity check)
RUN ldd --version | head -1

# Start the render worker
CMD ["npm", "run", "worker"]
