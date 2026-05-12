# packages/core/backend/Dockerfile
# SM-P0.3: Production-grade immutable image for vninvest-core services.
# No source mounts. All code baked in at build time.
#
# Multi-stage build:
#   builder  — installs Python deps
#   runtime  — minimal final image

ARG PYTHON_VERSION=3.13
ARG VNBROKER_GITHUB_TOKEN

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS builder

ARG VNBROKER_GITHUB_TOKEN

WORKDIR /build

# Install build deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && : "${VNBROKER_GITHUB_TOKEN:?VNBROKER_GITHUB_TOKEN must be set to install private vnbroker dependency}" \
    && mkdir -p /install \
    && pip install --ignore-installed --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS runtime

WORKDIR /app

# Runtime deps (libpq for psycopg2)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY src/ /app/src/
COPY manage.py /app/src/manage.py
COPY entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

ENV PYTHONPATH=/app/src
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8100

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["api"]
