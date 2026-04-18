# OPEN CORE PUBLIC DOCS ALLOWLIST V1 (OC-18)

Doc ID: OC-18
Ngay tao: 2026-04-18
Trang thai: Draft ready for governance review
Related docs: OPEN_CORE_17_DOCS_GOVERNANCE_PRIVATE_PUBLIC_20260418.md, OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md, OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md

## 1. Muc tieu

Tao danh sach allowlist tai lieu duoc phep cong bo cho community lane ma khong lo thong tin noi bo.

## 2. Nguyen tac bat buoc

1. Thu muc docs/ trong monorepo hien tai la private docs.
2. Public docs chi duoc tao tu publication lane rieng.
3. Bat ky tai lieu nao khong nam trong allowlist se mac dinh la KHONG DUOC public.

## 3. Public docs allowlist V1

### A. Product-facing
1. Community README (gioi thieu pham vi Community)
2. Feature boundary public summary (chi o muc package va user-facing capability)
3. Community vs Pro comparison (khong lo implementation/moat details)

### B. Developer-facing
1. Quickstart Community (Docker + demo seed)
2. Community API quick reference (chi endpoint public-safe)
3. Contribution guide (PR convention, coding standards co ban)
4. Security policy (reporting channel)
5. Code of conduct

### C. Legal-facing
1. License file chot cuoi cung
2. Public disclaimer (decision support only)
3. Public privacy/terms links hoac tom tat hop le
4. Support scope cho community lane

## 4. Blocklist V1 (khong duoc public)

1. Decision packet noi bo, risk register noi bo, gate table noi bo.
2. Internal backlog/taskboard/log execution.
3. Runtime drift analysis chi tiet.
4. Private moat implementation notes (scoring internals, prompt chain details, enforcement internals).
5. Internal runbook van hanh, rollback playbook, incident notes.

## 5. Redaction rules

1. Loai bo owner noi bo, branch/repo private naming, deployment topology noi bo.
2. Loai bo chi tiet co the lam lo paid moat (algorithm internals, private source strategy details).
3. Loai bo thong tin compliance/risk noi bo chua duoc legal approve.
4. Loai bo links tro den private docs.

## 6. Publication checklist V1

1. File nam trong allowlist.
2. Da qua sanitize/redact.
3. Da qua legal/comms review.
4. Da qua tech review de khong mau thuan voi boundary cong bo.
5. Da duoc gan version/date va owner.

Neu 1 trong 5 muc tren fail -> KHONG publish.

## 7. Owner de xuat

1. Product owner: quyet dinh thong diep va boundary cong bo.
2. Tech lead: xac nhan public-safe ve ky thuat.
3. Compliance/legal owner: xac nhan legal wording.
4. Community owner (neu co): quan tri issue/feedback tren docs cong bo.

## 8. Output artifact de xuat

1. public-docs bundle release note (versioned)
2. public README and guides (da sanitize)
3. publication evidence checklist (PASS/FAIL)

## 9. Next review checkpoint

- Chot allowlist V1 nay truoc khi bat ky lane public/community publication nao duoc green-light.