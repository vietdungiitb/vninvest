#!/usr/bin/env python3
"""Dispatch backend workflow and monitor all runs"""
import urllib.request, json, ssl, time

ctx = ssl.create_default_context()
GH_PAT = "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"
REPO = "vietdungiitb/vninvest"

def gh_post(path, data=None, method="POST"):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        data=json.dumps(data).encode() if data else None,
        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
                 "Accept": "application/vnd.github+json", "Content-Type": "application/json"},
        method=method
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:200]}

# List all workflows first
status, wfs = gh_post(f"/repos/{REPO}/actions/workflows", method="GET")
print("Available workflows:")
for wf in wfs.get("workflows", []):
    print(f"  [{wf['state']}] {wf['name']} — {wf['path']} (id={wf['id']})")

print()

# Try to dispatch backend
status, resp = gh_post(
    f"/repos/{REPO}/actions/workflows/backend.yml/dispatches",
    {"ref": "enterprise"}
)
if status == 204:
    print("[OK] Dispatched Backend on enterprise")
else:
    print(f"[FAIL] Backend: HTTP {status} — {resp}")
