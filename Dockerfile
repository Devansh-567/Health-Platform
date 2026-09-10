# syntax=docker/dockerfile:1

# --- 1. Build the frontend ---------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# VITE_* vars are baked into the JS bundle at build time, not read at
# runtime, so they must be passed as Docker build args (not just env vars
# on the running container). Set these in your host's "build args" UI —
# same values as frontend/.env.example.
ARG VITE_MQTT_URL
ARG VITE_MQTT_USERNAME
ARG VITE_MQTT_PASSWORD
ENV VITE_MQTT_URL=$VITE_MQTT_URL
ENV VITE_MQTT_USERNAME=$VITE_MQTT_USERNAME
ENV VITE_MQTT_PASSWORD=$VITE_MQTT_PASSWORD

COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. Build the backend ------------------------------------------------
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
# Alpine's base image ships no OpenSSL at all, so `prisma generate`'s
# postinstall step below can't detect a version and silently downloads the
# wrong query engine (defaults to a guess, per its own warning) — installing
# openssl first lets it detect correctly and match what the runtime stage
# actually has available.
RUN apk add --no-cache openssl
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci
COPY backend/ ./
RUN npm run build

# --- 3. Runtime -----------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Same reason as backend-build: without this, the query engine binary that
# *did* get generated correctly still fails to load at runtime with
# "Error loading shared library libssl.so.1.1: No such file or directory".
RUN apk add --no-cache openssl
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --omit=dev

COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./dist/public

EXPOSE 4000
CMD ["node", "dist/server.js"]
