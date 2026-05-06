#!/usr/bin/env python3
"""Get test failure log"""
import urllib.request, json, ssl

ctx = ssl.create_default_context()
GH_PAT = "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"

def gh(path):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
                 "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
        return r.read()

# Run 25351607525 — Core API failed
# Get jobs and find the failed job id
jobs_raw = gh("/repos/vietdungiitb/vninvest/actions/runs/25351607525/jobs")
jobs = json.loads(jobs_raw)
for job in jobs["jobs"]:
    if job.get("conclusion") == "failure":
        job_id = job["id"]
        print(f"Failed job: {job['name']} id={job_id}")
        # Get logs
        try:
            import http.client
            conn = http.client.HTTPSConnection("api.github.com")
            conn.request("GET", f"/repos/vietdungiitb/vninvest/actions/jobs/{job_id}/logs",
                        headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy",
                                 "Accept": "application/vnd.github+json"})
            resp = conn.getresponse()
            if resp.status in (301, 302, 303, 307, 308):
                redirect_url = resp.getheader("Location")
                print(f"Redirecting to: {redirect_url[:100]}...")
                # Follow redirect WITHOUT auth header
                log_req = urllib.request.Request(redirect_url)
                with urllib.request.urlopen(log_req, context=ctx, timeout=30) as r:
                    log = r.read().decode(errors='replace')
            else:
                log = resp.read().decode(errors='replace')
                print(f"Direct response {resp.status}")
            lines = log.splitlines()
            print(f"Total lines: {len(lines)}")
            # Show lines 420-560 (where test output would be)
            print("\nLines 420-560:")
            for line in lines[420:560]:
                print(line)
        except urllib.error.HTTPError as e:
            print(f"Log HTTP {e.code}: {e.read().decode()[:200]}")
        break
