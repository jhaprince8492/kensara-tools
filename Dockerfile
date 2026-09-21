# One container: the deep scanner API + both frontends (/consent, /gap) + /assets.
# Base carries Chromium + all its OS deps, matched to the "playwright" version.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

WORKDIR /app/scanner

# Install prod deps first for better layer caching.
COPY scanner/package.json scanner/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App code: scanner service + the two static frontends + shared assets.
COPY scanner/ ./
COPY apps/ /app/apps/

# Non-root so Chromium's own sandbox works.
USER pwuser
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
# server.js resolves ../apps relative to /app/scanner, and listens on 0.0.0.0:$PORT.
CMD ["node", "server.js"]
