# Use the official Puppeteer image — includes Node 20 + Chromium pre-installed
# https://github.com/puppeteer/puppeteer/pkgs/container/puppeteer
FROM ghcr.io/puppeteer/puppeteer:24.3.0

# Cloud Run sets PORT; default to 8080
ENV PORT=8080 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
