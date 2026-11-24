# syntax=docker/dockerfile:1.7
# ---------- deps ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

# ---------- runtime ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    LOG_FORMAT=json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/start.mjs ./scripts/start.mjs
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir -p /app/uploads /app/private-uploads && chown node:node /app/uploads /app/private-uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "scripts/start.mjs"]
