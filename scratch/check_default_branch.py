#!/usr/bin/env python3
import urllib.request, json, ssl

ctx = ssl.create_default_context()
GH_PAT = "<YOUR_GH_PAT_HERE>"
REPO = "vietdungiitb/vninvest"

def gh(path):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
                 "Accept": "application/vnd.github+json"}
    )
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        return json.loads(r.read())

# Check repo default branch
repo = gh(f"/repos/{REPO}")
print(f"Default branch: {repo['default_branch']}")
print(f"Repo: {repo['full_name']}")

# List branches
branches = gh(f"/repos/{REPO}/branches?per_page=20")
print(f"\nBranches ({len(branches)}):")
for b in branches:
    print(f"  {b['name']}")

# Check if backend.yml exists on default branch
default_branch = repo['default_branch']
try:
    content = gh(f"/repos/{REPO}/contents/.github/workflows/backend.yml?ref={default_branch}")
    print(f"\nbackend.yml ON {default_branch}: {content.get('type','?')} ({content.get('size',0)} bytes)")
except Exception as e:
    print(f"\nbackend.yml NOT on {default_branch}: {e}")

# All workflows including inactive
wfs = gh(f"/repos/{REPO}/actions/workflows?per_page=50")
print(f"\nAll workflows ({wfs.get('total_count',0)}):")
for wf in wfs.get("workflows", []):
    print(f"  [{wf['state']}] {wf['name']} — {wf['path']} (id={wf['id']})")
