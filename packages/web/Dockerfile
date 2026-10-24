FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
# Vendored tarball (registry unpublished 2026-10-22): must exist before npm ci resolves file: deps
COPY vendor ./vendor
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm ci --legacy-peer-deps


# Copy the rest of the application source code
COPY . .

# Build the Vite static bundle
ARG VITE_API_URL=/api
ARG VITE_WS_BASE_URL=
ARG VITE_DISABLE_REALTIME_WEBSOCKET=false
# Turnstile public site key. `TurnstileWidget.js` doc `import.meta.env.VITE_TURNSTILE_SITE_KEY`
# (Vite chi inject bien `VITE_*` co mat luc BUILD — nen phai ARG+ENV o day, khong doc duoc
# o runtime). De trong thi form dang ky hien loi ro rang thay vi im lang dung key test cua
# Cloudflare.
ARG VITE_TURNSTILE_SITE_KEY=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}
ENV VITE_DISABLE_REALTIME_WEBSOCKET=${VITE_DISABLE_REALTIME_WEBSOCKET}
ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
RUN npm run build

# Serve stage using Nginx
FROM nginx:1.27-alpine
ARG APP_RELEASE=dev

LABEL org.opencontainers.image.version=${APP_RELEASE} \
      org.opencontainers.image.revision=${APP_RELEASE}

ENV APP_RELEASE=${APP_RELEASE}

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
