# Keep this tag in lock-step with the "playwright" version in package.json.
FROM mcr.microsoft.com/playwright:v1.56.0-noble
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY lib ./lib
COPY server.js ./
# Non-root so Chromium's own sandbox can work (see README for the seccomp profile).
USER pwuser
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
