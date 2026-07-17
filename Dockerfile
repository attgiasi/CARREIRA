FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    DATABASE_URL=file:/app/storage/jobs.sqlite \
    STORAGE_ROOT=/app/storage \
    DASHBOARD_PORT=8788

COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/src/database/schema.sql ./src/database/schema.sql
COPY --from=build --chown=node:node /app/agent-settings.json ./agent-settings.json

RUN mkdir -p \
      /app/storage \
      /app/logs \
      /app/resumes/users \
      /app/generated/resumes \
      /app/generated/cover-letters \
      /app/generated/application-packets \
      /app/generated/landing-page \
      /app/generated/reports \
    && chown -R node:node /app

USER node

EXPOSE 8788

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8788/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/src/server.js"]
