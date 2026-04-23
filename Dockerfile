FROM node:22.12.0-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY server/package*.json server/
COPY client/package*.json client/
COPY shared/ shared/

RUN npm --prefix server ci
RUN CYPRESS_INSTALL_BINARY=0 npm --prefix client ci

COPY . .

RUN npm --prefix client run build
RUN npm --prefix server run build

RUN npx puppeteer browsers install chrome


FROM node:22.12.0-bookworm-slim AS runtime

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
ENV PUPPETEER_CACHE_DIR=/home/aivis/.cache/puppeteer

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/package.json ./server/package.json

RUN mkdir -p /home/aivis/.cache/puppeteer \
    && chown -R aivis:aivis /home/aivis

RUN npm --prefix server ci --omit=dev

EXPOSE 3000

USER aivis

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server/dist/index.js"]
