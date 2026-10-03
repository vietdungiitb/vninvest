# OPEN CORE BRANCH PROTECTION OC-19 SETUP (OC-21)

Doc ID: OC-21
Ngay tao: 2026-04-18
Trang thai: Operational setup guide
Related docs: OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md, OPEN_CORE_20_OC19_GATE_QUICKSTART_20260418.md

## 1. Muc tieu

Khoa merge OpenCore PR bang branch protection va required status checks.

## 2. Scope

Ap dung cho cac branch:
1. dev
2. main
3. deploy

## 3. Required status check bat buoc

Bat buoc check sau o branch protection:
1. OpenCore Doc Sync Gate / opencore-doc-sync-gate

Khuyen nghi bo sung:
1. Large File Guard / large-file-guard
2. Governance Release Gate / governance-postgres-regression

## 4. Thiet lap tren GitHub UI

1. Vao repository Settings.
2. Vao Branches.
3. Tao hoac sua ruleset cho tung branch dev/main/deploy.
4. Bat Require status checks to pass before merging.
5. Chon check OpenCore Doc Sync Gate / opencore-doc-sync-gate.
6. Bat Require pull request reviews before merging.
7. Bat Dismiss stale pull request approvals when new commits are pushed.
8. Luu ruleset.

## 4.1 Noi dung ruleset de dung ngay (khuyen nghi chuan)

Ap dung 3 ruleset rieng cho:
1. Branch name pattern: `dev`
2. Branch name pattern: `main`
3. Branch name pattern: `deploy`

Mau cau hinh cho moi ruleset:

1. Target branches
- Include: branch pattern dung ten branch (`dev` hoac `main` hoac `deploy`)
- Exclude: de trong

2. Protections
- Require a pull request before merging: ON
- Require approvals: 1 (toi thieu)
- Dismiss stale pull request approvals when new commits are pushed: ON
- Require review from Code Owners: ON neu repo da dung CODEOWNERS, nguoc lai OFF tam thoi
- Require conversation resolution before merging: ON

3. Status checks
- Require status checks to pass before merging: ON
- Require branches to be up to date before merging: ON
- Required checks (bat buoc):
	- `OpenCore Doc Sync Gate / opencore-doc-sync-gate`
- Recommended checks:
	- `Large File Guard / large-file-guard`
	- `Governance Release Gate / governance-postgres-regression`

4. Additional protections
- Block force pushes: ON
- Block deletions: ON
- Allow bypass permissions: chi cap cho repo admin/owner theo chinh sach noi bo

5. Merge strategy
- Cho phep merge method theo policy team (squash/rebase/merge commit)
- Khuyen nghi `squash merge` de audit de theo doi hon

6. Rule precedence
- Neu co nhieu ruleset cung match 1 branch, uu tien ruleset stricter
- Tranh tao ruleset wildcard qua rong lam ghi de quy tac rieng cua `dev/main/deploy`

## 4.2 Ban copy nhanh cho nguoi setup

Sau khi tao ruleset cho moi branch, xac nhan 6 diem sau deu dung:
1. PR-only merge (khong push truc tiep)
2. >=1 approval
3. stale approval bi reset khi co commit moi
4. conversation unresolved thi khong merge
5. OpenCore Doc Sync Gate la required status check
6. force-push va delete branch bi chan

## 4.3 Mau copy/paste (dev/main/deploy)

Copy nguyen khoi duoi day vao ticket van hanh hoac changelog setup de thao tac dung 1 mau:

### RULESET TEMPLATE - DEV

Ruleset name: OpenCore Protection - dev
Target branch pattern: dev

Require a pull request before merging: ON
Required approvals: 1
Dismiss stale pull request approvals when new commits are pushed: ON
Require conversation resolution before merging: ON
Require review from Code Owners: ON (neu co CODEOWNERS, neu khong thi OFF tam thoi)

Require status checks to pass before merging: ON
Require branches to be up to date before merging: ON
Required status checks:
- OpenCore Doc Sync Gate / opencore-doc-sync-gate

Recommended status checks:
- Large File Guard / large-file-guard
- Governance Release Gate / governance-postgres-regression

Block force pushes: ON
Block deletions: ON
Bypass list: chi repo admin/owner theo policy noi bo

Merge method: squash merge (khuyen nghi)

### RULESET TEMPLATE - MAIN

Ruleset name: OpenCore Protection - main
Target branch pattern: main

Require a pull request before merging: ON
Required approvals: 1
Dismiss stale pull request approvals when new commits are pushed: ON
Require conversation resolution before merging: ON
Require review from Code Owners: ON (neu co CODEOWNERS, neu khong thi OFF tam thoi)

Require status checks to pass before merging: ON
Require branches to be up to date before merging: ON
Required status checks:
- OpenCore Doc Sync Gate / opencore-doc-sync-gate

Recommended status checks:
- Large File Guard / large-file-guard
- Governance Release Gate / governance-postgres-regression

Block force pushes: ON
Block deletions: ON
Bypass list: chi repo admin/owner theo policy noi bo

Merge method: squash merge (khuyen nghi)

### RULESET TEMPLATE - DEPLOY

Ruleset name: OpenCore Protection - deploy
Target branch pattern: deploy

Require a pull request before merging: ON
Required approvals: 1
Dismiss stale pull request approvals when new commits are pushed: ON
Require conversation resolution before merging: ON
Require review from Code Owners: ON (neu co CODEOWNERS, neu khong thi OFF tam thoi)

Require status checks to pass before merging: ON
Require branches to be up to date before merging: ON
Required status checks:
- OpenCore Doc Sync Gate / opencore-doc-sync-gate

Recommended status checks:
- Large File Guard / large-file-guard
- Governance Release Gate / governance-postgres-regression

Block force pushes: ON
Block deletions: ON
Bypass list: chi repo admin/owner theo policy noi bo

Merge method: squash merge (khuyen nghi)

### Post-setup verification checklist (copy/paste)

- [ ] Da tao du 3 ruleset: dev, main, deploy
- [ ] Ruleset nao cung bat PR-required merge
- [ ] Ruleset nao cung co required check OpenCore Doc Sync Gate
- [ ] Da bat block force-push + block deletion cho ca 3 branch
- [ ] Da test 1 PR fail gate va xac nhan merge bi khoa
- [ ] Da test fix docs/audit va xac nhan check xanh

## 4.4 One-command automation (PowerShell)

Neu khong muon click tay tren UI, co the dung script upsert ruleset:

File script:
- scripts/ops/setup_oc19_github_rulesets.ps1

Lenh chay mau:

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\setup_oc19_github_rulesets.ps1 -Owner vietdungiitb -Repo vninvest -Token "<GITHUB_TOKEN_ADMIN_REPO>"

Luu y token:
1. Token phai co quyen administration write cho repository.
2. Neu muon test khong ghi thay doi, them `-DryRun`.
3. Neu muon include them recommended checks vao required list, them `-IncludeRecommendedChecks`.

## 5. Validation sau setup

1. Tao PR test co thay doi OpenCore nhung khong cap nhat audit/docs.
2. Xac nhan workflow OpenCore Doc Sync Gate fail.
3. Xac nhan merge button bi khoa.
4. Bo sung docs/audit theo OC-19.
5. Xac nhan check xanh va merge mo lai.

## 6. Luu y van hanh

1. Ruleset branch la cai dat tren hosting platform, khong duoc enforce chi bang file trong repo.
2. Moi thay doi required checks phai duoc audit vao docs/CODE_CHANGE_AUDIT_LEDGER.md.

## 7. Next review checkpoint

- Review hang thang: required checks co con phu hop voi OC-19 khong.
