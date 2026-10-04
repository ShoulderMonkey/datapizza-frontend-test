# syntax=docker/dockerfile:1

# ---- deps: install dependencies from the lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The lockfile is generated locally with npm 11.6.2; the npm 10 bundled in
# node:22 considers it out of sync (missing @emnapi/*), so align the version.
RUN npm install -g npm@11.6.2 && npm ci

# ---- builder: next build (output: 'standalone') ----
FROM node:22-alpine AS builder
WORKDIR /app
# Rewrites in next.config.ts are evaluated at BUILD time and serialized into
# the routes manifest: BACKEND_URL must be available here, not only at runtime.
# Default targets the backend service name on the docker compose network.
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# No public/ directory exists in this repo: create it (inside the image only) so
# the runner stage can copy it unconditionally.
RUN mkdir -p public

# ---- runner: minimal image, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S -g 1001 nextjs && adduser -S -u 1001 -G nextjs nextjs
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
