FROM ghcr.io/railwayapp/nixpacks:ubuntu-1745885067

WORKDIR /app

COPY . /app/.

RUN npm --prefix server install --include=dev
RUN npm --prefix server run build
RUN cd server && npx puppeteer browsers install chrome

CMD ["npm", "--prefix", "server", "run", "start:prod"]