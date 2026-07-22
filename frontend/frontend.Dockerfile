FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

ENV HOSTNAME=0.0.0.0 \
    PORT=3000 \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=1 \
    CHOKIDAR_INTERVAL=500

EXPOSE 3000

CMD ["sh", "-c", "DEPS_HASH_FILE=node_modules/.deps-hash; CURRENT_HASH=$(sha256sum package.json package-lock.json | sha256sum | awk '{print $1}'); if [ ! -f \"$DEPS_HASH_FILE\" ] || [ \"$(cat $DEPS_HASH_FILE)\" != \"$CURRENT_HASH\" ]; then npm ci && echo \"$CURRENT_HASH\" > \"$DEPS_HASH_FILE\"; fi; npm run dev"]
