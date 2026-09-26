---
name: multi-agent-workflow
description: >-
  Use when running multiple agents in parallel on this repo or when the user says
  "multi-agent", "chạy song song", "audit độc lập", "phân công agent", "nhiều
  agent cùng lúc", "delegate", "test nghiệm thu". VNInvest-specific 8-gate
  pipeline Isolate → Plan → Audit Plan → Claim → Code → Audit Code → Test →
  Merge, wired to this repo's own tooling (docs/AGENT_PROTOCOL.md,
  docs/CLAIMS.md, scripts/new-agent.ps1, scripts/agent-sync.ps1, .githooks,
  check:multi-agent) and to the deny list already in AGENTS.md. Prevents the four
  conflicts that actually break this build — committing shared files, duplicate
  migration numbers, stale file:line citations, and reporting PASS for gates that
  were never run.
license: MIT
metadata:
  version: "2.0.0"
  author: "Hermes Agent + User"
  project: "vninvest"
  tooling: "docs/AGENT_PROTOCOL.md + scripts/agent-*.ps1 + .githooks"
---

# Multi-Agent Workflow — VNInvest

Project-scoped companion to the global `multi-agent-workflow` skill.

> **`docs/AGENT_PROTOCOL.md` is authoritative for this repo.** Read it before
> editing anything. This skill is the operating summary; the protocol has the
> full rationale. On any conflict, the protocol wins.

## Everything is already built here

Do not improvise isolation — the repo has tooling for it.

| Need | Command |
|---|---|
| Provision an agent (worktree + branch + DB + junction + hook + claim) | `pwsh -File scripts/new-agent.ps1 -Agent <ten> -Slice "<viec>"` |
| List running agents, worktrees, databases | `pwsh -File scripts/new-agent.ps1 -List` |
| Install hooks in a worktree (first time only) | `sh scripts/agent-install-hooks.sh` |
| Sync + migration check + gates | `pwsh -File scripts/agent-sync.ps1` |
| Open a PR with a review checklist | `pwsh -File scripts/agent-pr.ps1 -Title "..."` |
| Remove a worktree after merge | `pwsh -File scripts/agent-cleanup.ps1 -Branch <b> -Execute` |
| Multi-agent invariant gate | `node packages/web/scripts/check-multi-agent.mjs` |

## Current layout

| Path | Branch | Agent | Hooks | Database |
|---|---|---|---|---|
| main checkout | `dev` | core-team (integration) | `.husky` | `vninvest_core` |
| `../agent-ai-cc` | `feat/ai-cc-r0` | ai-cc-agent | `.githooks` | `aicc_r0` |
| `../advisory-audit` | `feat/advisory-audit` | advisory-audit | `.githooks` | `ag_advisory_audit` |

**`dev` is the integration branch and gets no direct commits.** While that rule is
violated there is no merge point, so nothing is reviewable and nobody can sync —
which is exactly how a duplicate migration number shipped on 2026-09-26.

## The eight gates, repo-specific

| # | Stage | Exit condition | Enforced by |
|---|---|---|---|
| 0 | Isolate | `new-agent.ps1` exited 0; hook present in worktree | `new-agent.ps1` refuses if `.githooks/pre-commit` is not in `HEAD` |
| 1 | Plan | `docs/IMPLEMENTATION_PLAN_*.md` with `file:line` + AC + non-goals | review |
| 2 | Audit Plan | `PASS` or `AGREE` | supervisor refuses to start Stage 3 |
| 3 | Claim | row appended to `docs/CLAIMS.md`, committed alone | `git status` **before** claiming — see trap below |
| 4 | Code | `git diff dev...HEAD` non-empty; no migration collisions | `check:multi-agent` + `.githooks/pre-commit` |
| 5 | Audit Code | `0 lỗi còn lại` + `confidence: high` | supervisor |
| 6 | Test | every gate `Pass` or explicitly `CHƯA CHẠY` | `agent-sync.ps1` |
| 7 | Merge | rebase onto `origin/dev` → **re-check migration numbers** → re-run gates → PR | `agent-sync.ps1` step 4 |

## Deny list — never commit these during parallel work

From `AGENTS.md` and `docs/AGENT_PROTOCOL.md` §2. The hook blocks them:

```
AGENTS.md
docs/CODE_CHANGE_AUDIT_LEDGER.md
packages/web/package.json
pyproject.toml · requirements.txt · package-lock.json
docker-compose*.yml · .env · .env.example
```

These are edited by everyone, so an append-only ledger ends up as **one single
hunk** containing every agent's entry. `git add -p` cannot separate it; one
agent's commit silently carries another's work.

Record the need in your claim's `note` and tell the coordinator. The one
legitimate exception is the coordinator's consolidation commit.

**If you must edit one anyway:** `git diff -U0 -- <file>` splits hunks by line;
stage only yours with `git apply --cached --unidiff-zero`, then verify the staged
diff contains nothing but your lines. This was used successfully to insert 33
lines into `AGENTS.md` while `core-team` had 83 uncommitted lines in the same file
— both sets survived, separated by hunk.

## Migration numbering — the deploy-breaker

Duplicate numbers give `Conflicting migrations detected; multiple leaf nodes`.

- **Let `makemigrations` name the file.** It computes the next number from the
  current leaf; hand-picking is the entire cause of these collisions.
- **Read the head on `dev`, not in your worktree.** A worktree is built from
  `HEAD` and cannot see another agent's uncommitted migrations. Measured on
  2026-09-26: agent DB `aicc_r0` had 145 migrations, the shared `vninvest_core`
  had **147** — the missing 2 were a teammate's uncommitted migration.
- `agent-sync.ps1` re-checks this **after** rebase, because the rebase may have
  pulled in another agent's migration. This is the most-skipped step and the one
  that blocks deploys.
- After creating: `python manage.py makemigrations --check --dry-run` must exit 0.

## Backend environment — the gotcha that is not about the database

`vninvest_core/settings.py:21` defaults `DEBUG=False`, and lines 27-34 **raise
`ImproperlyConfigured`** unless `DJANGO_ALLOWED_HOSTS` and `DJANGO_SECRET_KEY` are
set. A documented blocker blamed "cannot connect to Postgres, 71 errors" — that
was **half wrong**. The real blocker was this settings guard.

```powershell
$env:CORE_DATABASE_URL = "postgresql://vninvest:devpassword@127.0.0.1:5433/<db>"
$env:DJANGO_DEBUG = "1"
cd packages/core/backend
python manage.py check      # -> "System check identified no issues"
```

Host port is **5433** (container uses 5432 internally; container-to-container uses
hostname `core-db`). Setting `DJANGO_DEBUG=1` alone drops failures from **71 to
14**.

**If you cannot run a gate, report `CHƯA CHẠY`.** Do not infer "presumably fine".
Of the 14 remaining failures, none are in the AI Command Center domain, but
**that has not been proven pre-existing** — a clean baseline could not be taken
because the main checkout had concurrent uncommitted edits.

## Repo-specific traps, all hit for real on 2026-09-26

| Trap | Consequence | Prevention |
|---|---|---|
| Commit a shared file | One hunk welds two agents; unsplittable | deny list + hook |
| Hand-pick a migration number | Deploy blocked | let `makemigrations` name it |
| Claim before `git status` | Claim falsely asserts ownership of files another agent holds | `git status` the main checkout **first** |
| Run gates **before** rebase | Green report, different code after rebase | `agent-sync.ps1` runs gates after |
| Trust a migration number read in a worktree | Collision with an unseen uncommitted migration | read head on `dev` |
| Write a hook, then create the worktree | Hook is invisible; everything leaks | commit the hook first — `new-agent.ps1` enforces it |
| `git commit -m "...$(...)"` in PowerShell | Message silently mangled | write the message to a file, use `-F` |
| `node gate.mjs \| sed` | Exit status comes from `sed` — **gate never fails** | capture `$?`, then test it |
| Destructive script with no dry-run | Deletes what it protects | `-Execute` flag + 6 guards |
| Symlinked `node_modules` | One agent's `npm install` breaks the others | coordinate installs |
| Per-agent `docker-compose` stacks | Two worker sets consume the same queue; tests poison each other | worktrees + separate databases |

## Honesty rule

```
lint:       Pass
typecheck:  Pass
backend:    Pass  (19 tests, aicc_r0)
db suite:   Pass  (388 tests, failures=10 errors=4 — 14 pre-existing, see report)
visual QA:  CHƯA CHẠY  (no screenshots captured)
```

`CHƯA CHẠY` is valid and useful. Never fill a gate line you did not run.

## Reviewer checklist for a PR in this repo

1. No deny-listed file in the diff.
2. Every changed file appears in the branch's `CLAIMS.md` rows.
3. No duplicate migration numbers; new migration's number > head on `dev`.
4. `docs/CLAIMS.md` moved `in-progress` → `done`.
5. `agent-sync.ps1` was run **after** the work finished, and gates re-run after it.
6. Every `CHƯA CHẠY` line read and consciously accepted.
7. PR body does not pre-fill `Pass`.

## Hard rules

- One worktree per agent, one database per agent, one branch per agent.
- Subagents **must not** delegate further (`mode: subagent`, `task` permission
  removed) — prevents unbounded cascades.
- Auditors get `edit: deny` so they cannot fix what they audit.
- Only the coordinator touches `dev` and consolidates deny-listed files.
- An agent that spots a problem outside its scope **reports it, does not fix it**.
- Never `--no-verify` to slip past a hook without writing the reason into the
  commit body.

## Also in this repo

- `docs/AGENT_PROTOCOL.md` — full protocol, 10 sections, the 4 real conflicts and
  their root causes
- `docs/CLAIMS.md` — live claim registry, append-at-end, `merge=union`
- `docs/AGENT_RULES_BLOCK.md` — the rules block now pasted into `AGENTS.md`
- `.github/workflows/multi-agent-gate.yml` — CI protection for `core-team`, who
  still uses `.husky` and is therefore not reached by per-worktree hooks
