# Cloud Run image for the CityBeat ads portal (service: citybeat-ads).
# Node 22: firebase-admin@14 requires >=22 and puppeteer@25 requires >=22.12;
# building on Node 20 (unsupported engine) caused intermittent build failures.
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm install

# Public Firebase web config (kerstenblueprint) — shipped to the browser; safe to bake.
ARG NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA1O_4vViQX2yheYTibS_vw0qppTnSM8BU
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kerstenblueprint.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=kerstenblueprint
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kerstenblueprint.firebasestorage.app
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=854761587817
ARG NEXT_PUBLIC_FIREBASE_APP_ID=1:854761587817:web:423272ca9e8daee48a8ef8
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

# Extra heap headroom — next build was getting killed mid-compile under the
# default ~2GB limit on the build worker.
RUN NODE_OPTIONS=--max-old-space-size=4096 npx turbo run build --filter=@citybeat/ads

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/ads/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/ads/.next/static ./apps/ads/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/ads/public ./apps/ads/public

USER nextjs
EXPOSE 8080
CMD ["node", "apps/ads/server.js"]
