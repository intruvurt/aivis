FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY index.js ./index.js
CMD ["node", "index.js"]
