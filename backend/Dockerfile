FROM python:3.11-slim

ARG APP_RELEASE=dev
ARG VNBROKER_GITHUB_TOKEN

LABEL org.opencontainers.image.version=${APP_RELEASE} \
      org.opencontainers.image.revision=${APP_RELEASE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_RELEASE=${APP_RELEASE}

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    : "${VNBROKER_GITHUB_TOKEN:?VNBROKER_GITHUB_TOKEN must be set to install private vnbroker dependency}" && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

# NOTE: .env files are NOT copied into image (in .gitignore)
# They MUST be mounted at runtime via docker-compose volumes
# See: docker-compose.yml - volumes section with ./backend/.env.production:/app/.env.production:ro

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
