# Cloud Run image for the CityBeat web app (service: citybeat-web).
# Used by `gcloud run deploy citybeat-web --source .` (see scripts/deploy-web.ps1).
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm install

# Public Firebase web config (kerstenblueprint project). These NEXT_PUBLIC_* values
# are shipped to the browser by design, so it is safe to bake them into the image.
# They are inlined into the client bundle at `next build` time. Override with
# --build-arg if the project ever changes.
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

# Public build-time config inlined into the client bundle during `next build`;
# real runtime values come from Cloud Run env.
ARG NEXT_PUBLIC_APP_URL=https://citybeatmag.co
# Public Google Analytics 4 measurement ID — shipped to the browser by design,
# inlined into the client bundle at build time so gtag loads on every page.
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=G-D8V1XC2346
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID

RUN npx turbo run build --filter=web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone output (monorepo): server.js lives at apps/web/server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 8080
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
