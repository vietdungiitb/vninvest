FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy the rest of the application source code
COPY . .

# Build the Vite static bundle
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
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
