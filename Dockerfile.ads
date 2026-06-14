FROM node:20-alpine AS base

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY sanity ./sanity
RUN npm install
RUN npx turbo run build --filter=ads

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV PORT 8080

COPY --from=builder /app/apps/ads/public ./apps/ads/public
COPY --from=builder /app/apps/ads/.next/standalone ./
COPY --from=builder /app/apps/ads/.next/static ./apps/ads/.next/static

EXPOSE 8080
CMD ["node", "apps/ads/server.js"]
