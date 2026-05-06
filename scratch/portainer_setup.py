#!/usr/bin/env python3
"""
Setup VNInvest on Portainer via API:
1. Add GHCR registry
2. Create vninvest stack with all env vars
"""
import urllib.request
import urllib.error
import json
import ssl
import sys

PORTAINER = "https://localhost:9443"
USER = "admin"
PASS = "ThanhLam@2010"
GH_PAT = "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"
CORE_DB_PASS = "core_db_464393"
CORE_SECRET = "xK8mP3nQ7wR2vT5yJ6dF9hL4bN0cE1aZ8sU6pW3iY7oX"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api(method, path, data=None, token=None):
    url = PORTAINER + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"HTTP {e.code}: {body[:300]}")
        return None

# 1. Login
print("=== Step 1: Login ===")
resp = api("POST", "/api/auth", {"username": USER, "password": PASS})
if not resp or "jwt" not in resp:
    print("Login failed:", resp)
    sys.exit(1)
token = resp["jwt"]
print(f"OK — token {len(token)} chars")

# 2. Get endpoint
print("=== Step 2: Get endpoint ===")
endpoints = api("GET", "/api/endpoints", token=token)
ep_id = endpoints[0]["Id"]
print(f"EndpointID: {ep_id} | {endpoints[0]['Name']}")

# 3. Add GHCR registry (check if already exists)
print("=== Step 3: Add GHCR registry ===")
regs = api("GET", "/api/registries", token=token)
existing = [r for r in (regs or []) if "ghcr" in r.get("URL","").lower()]
if existing:
    print(f"Registry ghcr.io already exists (ID={existing[0]['Id']}), skipping")
else:
    reg = api("POST", "/api/registries", {
        "Name": "ghcr.io",
        "Type": 3,
        "URL": "ghcr.io",
        "Authentication": True,
        "Username": "vietdungiitb",
        "Password": GH_PAT
    }, token=token)
    if reg and "Id" in reg:
        print(f"Registry created: ID={reg['Id']}")
    else:
        print(f"Registry result: {reg}")

# 4. Read compose file
print("=== Step 4: Read compose file ===")
with open("/opt/vninvest/portainer-stack-vninvest.yml") as f:
    compose_content = f.read()
print(f"Compose: {len(compose_content)} chars")

# 5. Check existing stacks
print("=== Step 5: Check existing stacks ===")
stacks = api("GET", "/api/stacks", token=token)
existing_stack = [s for s in (stacks or []) if s.get("Name") == "vninvest"]
if existing_stack:
    print(f"Stack 'vninvest' already exists (ID={existing_stack[0]['Id']}), will update")
    stack_id = existing_stack[0]["Id"]
    # Update stack
    env_vars = [
        {"name": "DOMAIN", "value": "vninvest.edusuccess.vn"},
        {"name": "LETSENCRYPT_EMAIL", "value": "vietdung@edusuccess.vn"},
        {"name": "APP_RELEASE", "value": "latest"},
        {"name": "POSTGRES_DB", "value": "vninvest"},
        {"name": "POSTGRES_USER", "value": "postgres"},
        {"name": "POSTGRES_PASSWORD", "value": "change_me_db_password"},
        {"name": "DJANGO_SECRET_KEY", "value": "change-me-very-long-random-string"},
        {"name": "DJANGO_ALLOWED_HOSTS", "value": "vninvest.edusuccess.vn,localhost,127.0.0.1"},
        {"name": "CORS_ALLOWED_ORIGINS", "value": "https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn"},
        {"name": "CSRF_TRUSTED_ORIGINS", "value": "https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn"},
        {"name": "FRONTEND_BASE_URL", "value": "https://vninvest.edusuccess.vn"},
        {"name": "CORE_DB_PASSWORD", "value": CORE_DB_PASS},
        {"name": "CORE_DJANGO_SECRET_KEY", "value": CORE_SECRET},
        {"name": "CORE_ALLOWED_HOSTS", "value": "vninvest.edusuccess.vn,localhost,127.0.0.1"},
        {"name": "CORE_CORS_ALLOWED_ORIGINS", "value": "https://vninvest.edusuccess.vn"},
    ]
    result = api("PUT", f"/api/stacks/{stack_id}?endpointId={ep_id}", {
        "stackFileContent": compose_content,
        "env": env_vars,
        "prune": False,
        "pullImage": True,
    }, token=token)
    print(f"Update result: {str(result)[:200] if result else 'None'}")
else:
    print("Creating new stack 'vninvest'...")
    env_vars = [
        {"name": "DOMAIN", "value": "vninvest.edusuccess.vn"},
        {"name": "LETSENCRYPT_EMAIL", "value": "vietdung@edusuccess.vn"},
        {"name": "APP_RELEASE", "value": "latest"},
        {"name": "POSTGRES_DB", "value": "vninvest"},
        {"name": "POSTGRES_USER", "value": "postgres"},
        {"name": "POSTGRES_PASSWORD", "value": "change_me_db_password"},
        {"name": "DJANGO_SECRET_KEY", "value": "change-me-very-long-random-string"},
        {"name": "DJANGO_ALLOWED_HOSTS", "value": "vninvest.edusuccess.vn,localhost,127.0.0.1"},
        {"name": "CORS_ALLOWED_ORIGINS", "value": "https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn"},
        {"name": "CSRF_TRUSTED_ORIGINS", "value": "https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn"},
        {"name": "FRONTEND_BASE_URL", "value": "https://vninvest.edusuccess.vn"},
        {"name": "CORE_DB_PASSWORD", "value": CORE_DB_PASS},
        {"name": "CORE_DJANGO_SECRET_KEY", "value": CORE_SECRET},
        {"name": "CORE_ALLOWED_HOSTS", "value": "vninvest.edusuccess.vn,localhost,127.0.0.1"},
        {"name": "CORE_CORS_ALLOWED_ORIGINS", "value": "https://vninvest.edusuccess.vn"},
    ]
    result = api("POST", f"/api/stacks/create/standalone/string?endpointId={ep_id}", {
        "name": "vninvest",
        "stackFileContent": compose_content,
        "env": env_vars,
    }, token=token)
    if result and "Id" in result:
        print(f"Stack created: ID={result['Id']} Status={result.get('Status')}")
    else:
        print(f"Stack result: {str(result)[:400]}")

print("=== Done ===")
