# PREFETCH TIME POLICY - DECISION LOG (2026-04-12)

## Huong dan

Moi quyet dinh ky thuat hoac scope trong sprint phai duoc ghi vao day.

Format:
- ID
- Date
- Decision
- Context
- Alternatives considered
- Impact
- Owner
- Status

Status:
- Proposed
- Accepted
- Rejected
- Superseded

---

## D-001

- Date: 2026-04-12
- Decision: Su dung runtime policy theo khung gio thay vi static interval duy nhat.
- Context: Can giam 429/cooldown va toi uu ngoai gio.
- Alternatives considered:
  - Giu static interval toan ngay.
  - Hardcode 2 profile (gio/ngoai gio) khong runtime edit.
- Impact: Tang do phuc tap implementation, tang kha nang van hanh linh hoat.
- Owner: Tech Lead
- Status: Accepted

## D-002

- Date: 2026-04-12
- Decision: Chon admin settings API lam kenh cau hinh runtime.
- Context: Da co he thong settings va phan quyen admin.
- Alternatives considered:
  - Config file/env only.
  - Tao endpoint moi rieng.
- Impact: Reuse architecture hien co, giam chi phi tich hop FE.
- Owner: BE Lead
- Status: Accepted

## D-003

- Date: 2026-04-12
- Decision: Bat buoc fallback safe default neu policy loi.
- Context: Task worker khong duoc crash do policy invalid.
- Alternatives considered:
  - Fail hard.
  - Retry vo han.
- Impact: Tang do an toan runtime.
- Owner: BE Lead
- Status: Accepted

## D-004

- Date: 2026-04-12
- Decision: Dung release gates A-E truoc full rollout.
- Context: Can quan tri rui ro khi doi tan suat query runtime.
- Alternatives considered:
  - Deploy mot lan full production.
- Impact: Giam rui ro phat hanh, tang lead time.
- Owner: PM + Tech Lead
- Status: Accepted

---

## Decision entries template

- ID:
- Date:
- Decision:
- Context:
- Alternatives considered:
- Impact:
- Owner:
- Status:
