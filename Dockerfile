# syntax=docker/dockerfile:1
# ============================================================================
# EventFlow frontend image - Vite build served by nginx
# ============================================================================
# VITE_* values are compiled INTO the JavaScript bundle at build time. They are
# therefore build args, not runtime environment variables: changing one means
# rebuilding the image. Everything passed here is public, so never pass a
# database password or JWT secret - those belong to the backend.
#
# Build (from frontend):
#   docker build \
#     --build-arg VITE_API_BASE_URL=https://api.example.com/api/eventflow \
#     --build-arg VITE_FIREBASE_API_KEY=... \
#     --build-arg VITE_FIREBASE_AUTH_DOMAIN=eventflow-8da1b.firebaseapp.com \
#     --build-arg VITE_FIREBASE_PROJECT_ID=eventflow-8da1b \
#     --build-arg VITE_FIREBASE_STORAGE_BUCKET=eventflow-8da1b.firebasestorage.app \
#     --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=... \
#     --build-arg VITE_FIREBASE_APP_ID=... \
#     --build-arg VITE_FIREBASE_VAPID_KEY=... \
#     -t eventflow-frontend .
#
# The six Firebase values and VITE_FIREBASE_VAPID_KEY are REQUIRED: without them
# the build still succeeds, but src/firebase/config.js throws when the app boots.
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1 - build the static bundle
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /build

# Deterministic install from the lockfile (Vite 8 needs Node 20.19+ or 22.12+;
# node:22-alpine satisfies both).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

# Vite reads VITE_* from the process environment during `vite build`, so each
# build arg is promoted to an env var for the build step only.
ARG VITE_API_BASE_URL=""
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_STORAGE_BUCKET=""
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=""
ARG VITE_FIREBASE_APP_ID=""
ARG VITE_FIREBASE_MEASUREMENT_ID=""
ARG VITE_FIREBASE_VAPID_KEY=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_MEASUREMENT_ID=$VITE_FIREBASE_MEASUREMENT_ID \
    VITE_FIREBASE_VAPID_KEY=$VITE_FIREBASE_VAPID_KEY

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 - serve the bundle
# ---------------------------------------------------------------------------
FROM nginx:stable-alpine AS runtime

# Replaces the default server block. Handles SPA routing and the service-worker
# cache rules; see nginx.conf for the details.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80

# The base image already defines the correct ENTRYPOINT/CMD for nginx.
