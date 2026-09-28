#!/usr/bin/env python3
import urllib.request, json, ssl

ctx = ssl.create_default_context()
GH_PAT = "<YOUR_GH_PAT_HERE>"

def gh(path):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
                 "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        raw = r.read()
        scopes = r.headers.get("X-OAuth-Scopes", "")
        return json.loads(raw), scopes

# Get PAT scopes
_, scopes = gh("/user")
print(f"PAT scopes: '{scopes}'")

# Get recent runs
data, _ = gh("/repos/vietdungiitb/vninvest/actions/runs?per_page=10")
runs = data.get("workflow_runs", [])
print(f"\nAll runs ({len(runs)}):")
for r in runs:
    print(f"  [{r['status']}/{r.get('conclusion','?')}] {r['name']} branch={r['head_branch']} id={r['id']}")

# Find core-api failure
core_runs = [r for r in runs if "Core API" in r.get("name","")]
if core_runs:
    run_id = core_runs[0]["id"]
    jobs_data, _ = gh(f"/repos/vietdungiitb/vninvest/actions/runs/{run_id}/jobs")
    print(f"\nCore API jobs (run {run_id}):")
    for job in jobs_data.get("jobs", []):
        print(f"  Job [{job.get('conclusion','?')}]: {job['name']}")
        for step in job.get("steps", []):
            status = step.get("conclusion", step.get("status", "?"))
            if status in ("failure", "skipped"):
                print(f"    [{status}] {step['name']}")

