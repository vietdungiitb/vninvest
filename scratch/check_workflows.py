#!/usr/bin/env python3
"""Check all workflow runs and diagnose why workflows don't trigger"""
import urllib.request, json, ssl

ctx = ssl.create_default_context()
GH_PAT = "<YOUR_GH_PAT_HERE>"

def gh(path):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy"}
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()[:200]}, e.code

# Check all runs (not branch-filtered)
data, status = gh("/repos/vietdungiitb/vninvest/actions/runs?per_page=5")
runs = data.get("workflow_runs", [])
print(f"All recent runs ({status}): {len(runs)}")
for r in runs:
    print(f"  [{r['status']}/{r.get('conclusion','...')}] {r['name']} branch={r['head_branch']} — {r['created_at']}")

# Check PAT scopes
data2, _ = gh("/user")
print(f"\nPAT user: {data2.get('login')} | scopes need: workflow, write:packages")

# Check each workflow
print("\nWorkflow files:")
data3, _ = gh("/repos/vietdungiitb/vninvest/actions/workflows")
for wf in data3.get("workflows", []):
    print(f"  [{wf.get('state')}] {wf['name']} — {wf['path']}")
