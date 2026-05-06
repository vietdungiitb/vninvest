#!/usr/bin/env python3
import urllib.request, json, ssl

ctx = ssl.create_default_context()
GH_PAT = "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"

# Check workflow files
req = urllib.request.Request(
    "https://api.github.com/repos/vietdungiitb/vninvest/contents/.github/workflows?ref=enterprise",
    headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy"}
)
try:
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        data = json.loads(r.read())
    if isinstance(data, list):
        print("Workflow files on enterprise:")
        for f in data:
            print(f"  {f['name']}")
    else:
        print("Error:", data.get("message", data))
except Exception as e:
    print("Exception:", e)

# Check Actions permissions
req2 = urllib.request.Request(
    "https://api.github.com/repos/vietdungiitb/vninvest/actions/permissions",
    headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy"}
)
try:
    with urllib.request.urlopen(req2, context=ctx, timeout=15) as r:
        perms = json.loads(r.read())
    print("Actions enabled:", perms.get("enabled"), "| allowed_actions:", perms.get("allowed_actions"))
except Exception as e:
    print("Permissions check:", e)

# Check packages visibility
req3 = urllib.request.Request(
    "https://api.github.com/orgs/vietdungiitb/packages?package_type=container",
    headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy"}
)
try:
    with urllib.request.urlopen(req3, context=ctx, timeout=15) as r:
        pkgs = json.loads(r.read())
    print(f"GHCR packages ({len(pkgs)}):", [p.get("name") for p in pkgs])
except Exception as e:
    print("Packages check:", e)
