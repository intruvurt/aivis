# ── Stage 1: Build dependencies & compile ────────────────────────────────
FROM node:24-bookworm-slim AS builder

# Install build essentials + Chrome dependencies (cached layer)
RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	fonts-liberation \
	libasound2 \
	libatk-bridge2.0-0 \
	libatk1.0-0 \
	libcairo2 \
	libcups2 \
	libdbus-1-3 \
	libdrm2 \
	libexpat1 \
	libfontconfig1 \
	libgbm1 \
	libglib2.0-0 \
	libgtk-3-0 \
	libnspr4 \
	libnss3 \
	libpango-1.0-0 \
	libpangocairo-1.0-0 \
	libx11-6 \
	libx11-xcb1 \
	libxcb1 \
	libxcomposite1 \
	libxcursor1 \
	libxdamage1 \
	libxext6 \
	libxfixes3 \
	libxi6 \
	libxrandr2 \
	libxrender1 \
	libxss1 \
	libxtst6 \
	xdg-utils \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better Docker layer caching)
COPY package*.json tsconfig.json ./
COPY server/package*.json server/
COPY client/package*.json client/
COPY shared/ shared/

# Install dependencies (cached unless package.json changes)
RUN npm --prefix server install --include=dev
RUN npm --prefix client install --include=dev

# Copy source code (this layer updates frequently)
COPY . /app/.

# Build client
RUN npm --prefix client run build

# Build server
RUN npm --prefix server run build

# Pre-install Chrome for Puppeteer (cached)
RUN cd server && npx puppeteer browsers install chrome

# ── Stage 2: Production runtime (minimal image) ────────────────────────────
FROM node:24-bookworm-slim AS runtime

# Install only runtime Chrome dependencies (smaller than builder)
RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	fonts-liberation \
	libasound2 \
	libatk-bridge2.0-0 \
	libatk1.0-0 \
	libcairo2 \
	libcups2 \
	libdbus-1-3 \
	libdrm2 \
	libexpat1 \
	libfontconfig1 \
	libgbm1 \
	libglib2.0-0 \
	libgtk-3-0 \
	libnspr4 \
	libnss3 \
	libpango-1.0-0 \
	libpangocairo-1.0-0 \
	libx11-6 \
	libx11-xcb1 \
	libxcb1 \
	libxcomposite1 \
	libxcursor1 \
	libxdamage1 \
	libxext6 \
	libxfixes3 \
	libxi6 \
	libxrandr2 \
	libxrender1 \
	libxss1 \
	libxtst6 \
	xdg-utils \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only production node_modules and dist files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/.puppeteerrc.cjs ./.puppeteerrc.cjs
COPY --from=builder /root/.cache/puppeteer /root/.cache/puppeteer

# Copy minimal runtime files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server/package.json ./server/package.json

ENV NODE_ENV=production

CMD ["npm", "--prefix", "server", "run", "start:prod"]