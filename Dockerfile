FROM oven/bun:1.4.4-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ARG SPA=false
RUN case "$SPA" in \
      true) bun run build:spa ;; \
      false) bun run build ;; \
      *) echo "SPA must be true or false" >&2; exit 1 ;; \
    esac

# Production stage
FROM oven/bun:1.4.4-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3000
USER bun

CMD ["bun", "start"]
