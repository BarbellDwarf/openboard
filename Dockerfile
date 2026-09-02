# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY server.js ./server.js
# Applies pending SQL migrations, then starts the server.
COPY scripts/migrate.mjs ./scripts/migrate.mjs
# server.js loads these modules directly at runtime, outside the Vite bundle.
# This copy also ships the SQL migration files under src/lib/server/db/migrations/.
COPY --from=build /app/src/lib/server/ ./src/lib/server/
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
