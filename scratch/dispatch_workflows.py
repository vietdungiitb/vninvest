#!/usr/bin/env python3
"""Dispatch all 3 build workflows on enterprise branch"""
import urllib.request, json, ssl, time

ctx = ssl.create_default_context()
GH_PAT = "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"
REPO = "vietdungiitb/vninvest"

def gh_post(path, data):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        data=json.dumps(data).encode(),
        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
                 "Accept": "application/vnd.github+json", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

workflows = [
    ("core-api.yml", "Core API"),
    ("web.yml", "Frontend"),
    ("backend.yml", "Backend"),
]

for wf_file, name in workflows:
    status, body = gh_post(
        f"/repos/{REPO}/actions/workflows/{wf_file}/dispatches",
        {"ref": "enterprise"}
    )
    if status == 204:
        print(f"[OK] Dispatched {name} ({wf_file}) on enterprise")
    else:
        print(f"[FAIL] {name}: HTTP {status} — {body.decode()[:200]}")
    time.sleep(2)

print("\nWaiting 10s for jobs to register...")
time.sleep(10)

# Check new runs
req = urllib.request.Request(
    f"https://api.github.com/repos/{REPO}/actions/runs?per_page=10",
    headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
             "Accept": "application/vnd.github+json"}
)
with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
    data = json.loads(r.read())
print("\nLatest runs:")
for run in data.get("workflow_runs", [])[:8]:
    print(f"  [{run['status']}/{run.get('conclusion','pending')}] {run['name']} branch={run['head_branch']} id={run['id']}")
