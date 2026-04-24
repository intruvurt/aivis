FROM node:22.22.2-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ----------------------------
# Dependency isolation layer
# ----------------------------
COPY package*.json tsconfig.json ./
RUN mkdir -p server client
COPY server/package.json server/package.json
COPY client/package.json client/package.json
COPY shared/ shared/
RUN test -f /app/server/package.json && test -f /app/client/package.json

# Clean deterministic install (fixes Vite + motion-dom + Rollup issues)
RUN npm cache clean --force

RUN npm --prefix server install --legacy-peer-deps \
    && (npm --prefix server ls bullmq >/dev/null 2>&1 || npm --prefix server install bullmq@^5.76.1 --legacy-peer-deps)
RUN CYPRESS_INSTALL_BINARY=0 npm --prefix client install --legacy-peer-deps

# ----------------------------
# Source layer
# ----------------------------
COPY . .

# ----------------------------
# Build client first (Vite safety)
# ----------------------------
ENV NODE_ENV=production
ENV VITE_BUILD=true

RUN npm --prefix client run build

# ----------------------------
# Build server
# ----------------------------
RUN npm --prefix server run build


# ----------------------------
# RUNTIME
# ----------------------------
FROM node:22.22.2-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    libatk1.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 \
    libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
    libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxss1 libxtst6 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN groupadd --system aivis && useradd --system --gid aivis --create-home aivis

ENV NODE_ENV=production
ENV PORT=3000

# ----------------------------
# App artifacts only
# ----------------------------
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY server/package.json ./server/package.json

# ----------------------------
# Clean install (production only)
# ----------------------------
RUN npm --prefix server install --omit=dev --legacy-peer-deps \
    && (npm --prefix server ls bullmq >/dev/null 2>&1 || npm --prefix server install bullmq@^5.76.1 --omit=dev --legacy-peer-deps)

# ----------------------------
# Permissions
# ----------------------------
RUN chown -R aivis:aivis /app

EXPOSE 3000

USER aivis

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server/dist/index.js"]
