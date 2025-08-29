# syntax=docker.io/docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i; \
  else echo "Lockfile not found." && exit 1; \
  fi

ENV HOSTNAME=0.0.0.0 \
    PORT=3000 \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=1 \
    CHOKIDAR_INTERVAL=500

EXPOSE 3000

CMD sh -c '\
  if [ -f yarn.lock ]; then yarn dev; \
  elif [ -f package-lock.json ]; then npm run dev; \
  else corepack enable pnpm && pnpm dev; \
  fi'
