FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY patches/ ./patches/
RUN npm ci

COPY . .
ARG REACT_APP_API_BASE_URL=/api
ARG APP_RELEASE=dev
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
ENV APP_RELEASE=${APP_RELEASE}
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

FROM nginx:1.27-alpine
ARG APP_RELEASE=dev

LABEL org.opencontainers.image.version=${APP_RELEASE} \
	org.opencontainers.image.revision=${APP_RELEASE}

ENV APP_RELEASE=${APP_RELEASE}

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
