FROM ghcr.io/puppeteer/puppeteer:24.3.0

ENV PORT=8080 \
    PUPPETEER_EXECUTABLE_PATH=/home/pptruser/.cache/puppeteer/chrome/linux-133.0.6943.126/chrome-linux64/chrome

USER root

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

RUN chown -R pptruser:pptruser /app

USER pptruser

EXPOSE 8080

CMD ["node", "index.js"]