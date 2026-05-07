# RUN SPEC AUDIT — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục tiêu**: quy trình audit để đối chiếu code với bộ spec about site mà không bỏ sót requirement.

---

## 1. Audit scope

Audit phải cover:
- `ABOUT_SITE_HANDOFF_MASTER_20260506.md`
- `TECH_SPEC_ABOUT_SITE_20260506.md`
- `IMPLEMENTATION_PLAN_ABOUT_SITE_20260506.md`
- `TASKBOARD_ABOUT_SITE_20260506.md`
- `ABOUT_SITE_TRACEABILITY_MATRIX_20260506.md`
- code diff liên quan
- validation evidence

---

## 2. Audit lenses

### Lens 1 — Product fidelity
- site có đúng là VNInvest ecosystem hub không?
- home page có đủ VNInvest, vnstock, VNStockCharts không?
- `/chart` có thực sự là VNStockCharts demo không?

### Lens 2 — Contract fidelity
- route handler có đúng contract không?
- symbol allowlist, cache, rate limit có áp dụng không?
- payload có khớp spec không?

### Lens 3 — Content fidelity
- mọi text public-facing có đi qua i18n không?
- tiếng Việt có đầy đủ dấu không?
- blog/legal copy có đúng phạm vi không?

### Lens 4 — Security fidelity
- no direct backend fetch from browser
- no secret leakage
- CSP/header hardening có mặt
- Pyodide chỉ chạy browser-side

### Lens 5 — Deploy fidelity
- build/image/Portainer/domain đều khớp spec
- health endpoint và public routes đều hoạt động

---

## 3. Audit procedure

### Step 1 — Document consistency
- kiểm 12-doc pack đủ file
- kiểm master doc và tech spec có cùng naming/route assumptions
- kiểm implementation plan và taskboard có cùng slice IDs

### Step 2 — Requirement trace
- map mỗi `ABOUT-REQ-*` về code thật
- nếu requirement chưa có code thì ghi open gap
- nếu code có nhưng spec không nhắc thì ghi spec drift

### Step 3 — Code diff review
- inspect file list và confirm no out-of-scope changes
- confirm no immutable source was edited by accident
- confirm chart engine and relay boundaries

### Step 4 — Runtime evidence review
- build log
- curl output
- screenshot
- payload snapshot
- deployment proof

### Step 5 — Final judgment
Choose one:
- `PASS`
- `CONDITIONAL PASS`
- `NO-GO`

---

## 4. Audit checklist

### Product
- [ ] homepage explains three products
- [ ] pricing CTA routes correctly
- [ ] chart demo is the custom engine, not a placeholder
- [ ] playground is browser sandbox only

### Content
- [ ] VI default locale exists
- [ ] EN locale exists
- [ ] diacritics are correct in Vietnamese strings
- [ ] MDX blog content renders

### Security
- [ ] whitelist on public symbol routes
- [ ] invalid symbol rejected
- [ ] rate limit returns 429
- [ ] CSP headers present
- [ ] no direct backend fetch in client code

### SEO
- [ ] title, description, canonical on priority pages
- [ ] sitemap and robots available
- [ ] OG image metadata present

### Deploy
- [ ] Docker image builds
- [ ] GHCR image name correct
- [ ] Portainer service healthy
- [ ] public domain returns 200

---

## 5. Findings format

For each finding, record:
- **Severity**: blocker / high / medium / low
- **Category**: product / contract / security / SEO / deploy
- **File reference**: absolute workspace path + line if possible
- **Why it matters**: one sentence
- **Fix suggestion**: one sentence

If no findings, say exactly:
- `No blocking spec drift found.`

---

## 6. Audit exit criteria

Audit only exits as PASS when:
1. all requirements traced,
2. no blocker findings remain,
3. evidence package exists,
4. residual risk is documented and accepted.
