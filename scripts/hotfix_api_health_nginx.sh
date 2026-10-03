#!/usr/bin/env bash
set -euo pipefail

CONTAINER="vninvest-frontend"
CONF="/etc/nginx/conf.d/default.conf"

if docker exec "$CONTAINER" sh -lc "grep -q 'location = /api/health/' '$CONF'"; then
  echo "Health compat location already exists, validating and reloading only."
  docker exec "$CONTAINER" sh -lc "nginx -t && nginx -s reload"
  exit 0
fi

docker exec "$CONTAINER" sh -lc "cp '$CONF' '$CONF.bak.$(date +%s)'"

docker exec "$CONTAINER" sh -lc "perl -0777 -i -pe 's#\n    location /api/ \{#\n    location = /api/health {\n        proxy_pass http://\$core_api_upstream/core/v1/health;\n        proxy_redirect off;\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$proxy_forwarded_proto;\n        proxy_set_header X-Forwarded-Port \$proxy_forwarded_port;\n        proxy_set_header X-Forwarded-Host \$host;\n        proxy_read_timeout 120s;\n    }\n\n    location = /api/health/ {\n        proxy_pass http://\$core_api_upstream/core/v1/health;\n        proxy_redirect off;\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$proxy_forwarded_proto;\n        proxy_set_header X-Forwarded-Port \$proxy_forwarded_port;\n        proxy_set_header X-Forwarded-Host \$host;\n        proxy_read_timeout 120s;\n    }\n\n    location /api/ {#s' '$CONF'"

docker exec "$CONTAINER" sh -lc "nginx -t && nginx -s reload"

echo "Patched and reloaded nginx in $CONTAINER"
