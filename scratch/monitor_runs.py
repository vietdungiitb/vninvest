#!/usr/bin/env python3
"""Monitor running workflows"""
import urllib.request, json, ssl

ctx = ssl.create_default_context()
GH_PAT = "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"
REPO = "vietdungiitb/vninvest"

def gh(path):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
                 "Accept": "application/vnd.github+json"}
    )
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        return json.loads(r.read())

# Get recent runs
data = gh(f"/repos/{REPO}/actions/runs?per_page=10")
runs = data.get("workflow_runs", [])
print("Recent runs:")
for run in runs:
    print(f"  [{run['status']}/{run.get('conclusion','?')}] {run['name']} branch={run['head_branch']} id={run['id']}")

# Show detail for enterprise runs
print()
enterprise_runs = [r for r in runs if r['head_branch'] == 'enterprise' and r['status'] != 'completed']
for run in enterprise_runs:
    jobs_data = gh(f"/repos/{REPO}/actions/runs/{run['id']}/jobs")
    print(f"  Jobs for {run['name']} (id={run['id']}):")
    for job in jobs_data.get("jobs", []):
        print(f"    [{job['status']}/{job.get('conclusion','?')}] {job['name']}")
        for step in job.get("steps", []):
            status = step.get("conclusion", step.get("status","?"))
            print(f"      step [{status}] {step['name']}")
