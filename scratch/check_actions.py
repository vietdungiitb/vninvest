#!/usr/bin/env python3
import urllib.request, json, ssl

ctx = ssl.create_default_context()
GH_PAT = "<YOUR_GH_PAT_HERE>"

req = urllib.request.Request(
    "https://api.github.com/repos/vietdungiitb/vninvest/actions/runs?branch=enterprise&per_page=10",
    headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy"}
)
with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
    data = json.loads(r.read())

runs = data.get("workflow_runs", [])
print(f"Total runs: {len(runs)}")
for run in runs:
    print(f"  [{run['status']}/{run.get('conclusion','...')}] {run['name']} — {run['created_at']}")
