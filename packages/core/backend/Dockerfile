# syntax=docker/dockerfile:1.7
# packages/core/backend/Dockerfile
# SM-P0.3: Production-grade immutable image for vninvest-core services.
# No source mounts. All code baked in at build time.
#
# Multi-stage build:
#   builder  — installs Python deps
#   runtime  — minimal final image

ARG PYTHON_VERSION=3.13

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS builder

WORKDIR /build

# Install build deps (BL-01: libxmlsec1-dev + pkg-config for python3-saml)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev git pkg-config libxmlsec1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# vnbroker is a PRIVATE GitHub dep (requires VNBROKER_GITHUB_TOKEN).
# All `import vnbroker` in src/ are lazy + degrade gracefully, so local
# runtime testing works WITHOUT the token: the private line is skipped and
# only DB-backed APIs are verified (live market fetch / broker trading need
# the real token). With token: full install, behaviour unchanged.
RUN --mount=type=secret,id=vnbroker_github_token \
    set -eu; \
    token_file='/run/secrets/vnbroker_github_token'; \
    token=''; \
    if [ -f "$token_file" ]; then token="$(cat "$token_file")"; fi; \
    cp requirements.txt requirements.build.txt; \
    if [ -n "$token" ]; then \
      echo '[build] vnbroker token present - installing full requirements'; \
      export GIT_CONFIG_COUNT=1; \
      export GIT_CONFIG_KEY_0=url."https://x-access-token:${token}@github.com/".insteadOf; \
      export GIT_CONFIG_VALUE_0=https://github.com/; \
      sed 's#x-access-token:[^@]*@github.com#github.com#' requirements.build.txt > requirements.build.tmp && mv requirements.build.tmp requirements.build.txt; \
    else \
      echo '[build] WARNING: no vnbroker token - skipping private vnbroker dep (live market/broker disabled, DB-backed APIs unaffected)'; \
      grep -v 'vnbroker @ git+' requirements.build.txt > requirements.build.tmp || true; \
      mv requirements.build.tmp requirements.build.txt; \
    fi; \
    pip install --upgrade pip; \
    mkdir -p /install; \
    pip install --ignore-installed --prefix=/install --no-cache-dir -r requirements.build.txt; \
    rm -f requirements.build.txt requirements.build.tmp


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS runtime

WORKDIR /app

# Runtime deps (libpq for psycopg2, xmlsec1 for SAML verification — BL-01)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl xmlsec1 \
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
