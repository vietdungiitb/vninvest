# OPEN CORE DOCS GOVERNANCE - PRIVATE VS PUBLIC (OC-17)

Doc ID: OC-17
Ngay tao: 2026-04-18
Trang thai: Governance policy draft for immediate alignment
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_13_COMMUNITY_PUBLISH_READINESS_V1.md, OPEN_CORE_15_DECISION_PACKET_CURRENT_20260418.md, OPEN_CORE_16_REVIEW_MEMO_20260418.md

## 1. Muc tieu

Tach ro 2 lane tai lieu:
1. Private docs phuc vu phat trien noi bo.
2. Public docs phuc vu cong dong/open-source contributor.

## 2. Chinh sach de xuat

1. Thu muc `docs/` trong monorepo nay la PRIVATE by default.
2. Khong public toan bo thu muc `docs/` trong bat ky phien ban nao.
3. Public docs neu can se duoc tao thanh artifact rieng qua publication lane.

## 3. Vi sao can tach lane

1. Private docs chua strategy/risk/backlog/gate noi bo, khong phu hop de public raw.
2. Public docs can gon, de dung, on dinh, va dong bo voi boundary cong bo.
3. Tach lane giup tranh ro ri thong tin noi bo va tranh contributor bi nhiu boi qua nhieu artifact lich su.

## 4. Scope private docs (vi du)

1. Decision packet noi bo, risk register, go/no-go gate.
2. Internal audit logs, implementation notes, hardening plans.
3. Runtime drift phan tich, backlog nhom ky thuat.

## 5. Scope public docs (vi du)

1. README cong dong.
2. CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
3. Quickstart Community (Docker + demo data).
4. Public API boundary docs cho lane Community.
5. Licensing/disclaimer/public support policy da duoc legal-review.

## 6. Publication pipeline de xuat

1. Input: private docs + code comments + release notes noi bo.
2. B1 - Allowlist:
- Chon danh sach file duoc phep public.
3. B2 - Sanitize/Redact:
- Loai bo thong tin noi bo (risk notes, internal runbook, operational sensitive details).
4. B3 - Legal/Comms review:
- Kiem tra claim, disclaimer, support wording.
5. B4 - Build public docs artifact:
- Dong goi vao thu muc/nhanh rieng cho public lane.
6. B5 - Publish:
- Push sang public repo/site docs.

## 7. Guardrails bat buoc

1. Khong cho phep script mirror mac dinh keo theo `docs/` private.
2. Moi lan release public lane phai co check-list docs separation PASS.
3. Neu chua pass separation check thi gate publication = NO-GO.

## 8. Quyet dinh can owner chot

1. Owner lane public docs la ai?
2. Public docs host o dau (repo rieng, branch rieng, hay static site)?
3. Allowlist toi thieu cho V1 la gi?
4. Quy trinh review (tech/legal/comms) se dung SLA nao?

## 9. Next review checkpoint

- Chot docs governance policy nay truoc khi bat ky ke hoach public/community publication nao duoc green-light.

## 10. Related execution artifact

1. Public docs allowlist V1: OPEN_CORE_18_PUBLIC_DOCS_ALLOWLIST_V1_20260418.md
2. Default team governance policy: OPEN_CORE_19_DEFAULT_TEAM_GOVERNANCE_POLICY_20260418.md