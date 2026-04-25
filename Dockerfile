FROM node:22.22.2-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package.json server/package.json
COPY server/package-lock.json server/package-lock.json
COPY client/package.json client/package.json
COPY client/package-lock.json client/package-lock.json
COPY shared/ shared/

RUN npm --prefix server ci \
    && CYPRESS_INSTALL_BINARY=0 npm --prefix client ci

COPY . .

ENV NODE_ENV=production
ENV VITE_BUILD=true

RUN npm --prefix client run build \
    && npm --prefix server run build:server

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

COPY --from=builder /app/server/dist /app/server/dist
COPY --from=builder /app/client/dist /app/client/dist
COPY --from=builder /app/server/package.json /app/server/package.json
COPY --from=builder /app/server/package-lock.json /app/server/package-lock.json

RUN npm --prefix server ci --omit=dev

RUN chown -R aivis:aivis /app/server/dist /app/client/dist /app/server/node_modules

EXPOSE 3000

USER aivis

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/health" || exit 1

CMD ["node", "--import", "./server/dist/server/src/instrument.js", "server/dist/server/src/server.js"]
