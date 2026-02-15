# Open LLM Orchestrator UI - production image
# Multi-stage: build frontend, then run server + static assets

# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8002

# Production deps only (no devDependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Server and built frontend
COPY server ./server
COPY --from=builder /app/dist ./dist

EXPOSE 8002

USER node
CMD ["node", "server/index.js"]
