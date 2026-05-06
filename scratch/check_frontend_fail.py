#!/usr/bin/env python3
"""Check frontend failure"""
import urllib.request, json, ssl, http.client

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

run_id = 25356073066  # Backend enterprise latest
jobs_data = gh(f"/repos/{REPO}/actions/runs/{run_id}/jobs")
print(f"Frontend run {run_id} jobs:")
failed_job_id = None
for job in jobs_data.get("jobs", []):
    print(f"  [{job['status']}/{job.get('conclusion','?')}] {job['name']} id={job['id']}")
    for step in job.get("steps", []):
        status = step.get("conclusion", step.get("status","?"))
        if status not in ("success", "skipped", "pending", "in_progress"):
            print(f"    [FAIL] {step['name']}")
    if job.get("conclusion") == "failure":
        failed_job_id = job["id"]

if failed_job_id:
    print(f"\nGetting log for failed job {failed_job_id}...")
    conn = http.client.HTTPSConnection("api.github.com")
    conn.request("GET", f"/repos/{REPO}/actions/jobs/{failed_job_id}/logs",
                headers={"Authorization": f"Bearer {GH_PAT}", "User-Agent": "vninvest-deploy"})
    resp = conn.getresponse()
    redirect = resp.getheader("Location")
    if redirect:
        log_req = urllib.request.Request(redirect)
        with urllib.request.urlopen(log_req, context=ctx, timeout=30) as r:
            log = r.read().decode(errors='replace')
        lines = log.splitlines()
        print(f"Log total: {len(lines)} lines")
        # Find npm error lines
        error_lines = [(i,l) for i,l in enumerate(lines) if any(w in l for w in ["npm ERR","error TS","Error:","failed","FAIL","exit code"])]
        print(f"Error lines ({len(error_lines)}):")
        for i, line in error_lines[:30]:
            print(f"  L{i+1}: {line.strip()}")
        # Show last 30 lines
        print("\nLast 30 lines:")
        for line in lines[-30:]:
            print(f"  {line.strip()}")
