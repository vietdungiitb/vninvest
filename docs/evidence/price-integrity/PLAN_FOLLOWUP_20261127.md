# Kế hoạch tiếp theo — price-integrity (2026-11-27, solo)

**Lessons áp dụng:** [L-V01, L-V02, L-V04, L-002, L-003, L-007] · FILES READ: `docs/LESSONS/verification.md`, `docs/LESSONS/multi-agent.md`.

## Baseline đo được (lệnh tái hiện)

| Lệnh | Kết quả |
|---|---|
| `pwsh -File scripts/agent-sync.ps1` | `check-ledger-entry FAIL — Entry 626 xuất hiện 2 lần (dòng 238, 247)`; `--next-entry` = **662** |
| `git show origin/dev:docs/CODE_CHANGE_AUDIT_LEDGER.md \| Select-String '^## Entry 626' \| Measure-Object` | **2** → duplicate có sẵn trên `dev`, không phải do slice này |
| `gh pr checks 569` | `scan pending` |
| `git status --short` | sạch; HEAD `d969b3d5c` |

## Mục tiêu / AC

- **AC1** (Given duplicate 626 trên `dev` / When đổi bản thứ hai thành số mới 662 + ghi chú / Then) `agent-sync.ps1` chạy tới gate cuối không còn FAIL do ledger.
- **AC2** (Given code PR #569 / When chạy lại `pre-push-gate` sau sửa / Then) 0 FAIL; `check-system-design --check` vẫn SACH.
- **AC3** (Given chỉ có 1 người / When viết re-audit / Then) file audit ghi rõ **giới hạn độc lập** — không tự nhận "auditor khác" (quy tắc 6 vẫn giữ: audit thành văn bản).
- **AC4** (Given PR #569 / When CI xanh + merge / Then) deploy staging `origin/dev`, chạy `python manage.py check_price_integrity --since 2026-01-01`, ghi violation thật vào evidence; nếu CI chưa xanh → ghi `CHƯA CHẠY`, không tự merge.

## SCOPE / LIMIT / non-goals / rollback

- **SCOPE**: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (1 dòng header + 2 dòng note), evidence `price-integrity/*`. Không đụng source runtime.
- **LIMIT**: tối đa 3 vòng sửa cho AC1; quá → dừng, ghi blocker.
- **Non-goals**: backfill 2011–2026 (CafeF 503), fallback VCI/KBS có nhãn, sửa E2E widget baseline.
- **Rollback**: `git show HEAD:docs/CODE_CHANGE_AUDIT_LEDGER.md > <file>` (KHÔNG dùng `git checkout --`, L-A01).

## Checklist lessons (tick trước khi coi xong)

- [x] L-V01: mọi số kèm lệnh tái hiện ở bảng trên; `--next-entry` lấy từ lệnh thật, không đoán.
- [x] L-V02: duplicate 626 có phản chứng `git show origin/dev...` = 2 → không suy diễn.
- [x] L-V04: assert violation code cụ thể, không assert rỗng; command trả exit 1 thật khi có violation (đã test).
- [x] L-002: claim đã khai trước code (commit `c4e695566`), branch đúng `feat/price-integrity`.
- [x] L-003: `agent-sync.ps1` chạy trước gate trong phiên này; gate chạy lại sau rebase.
- [x] L-007: BE full suite không có Postgres → đã ghi `CHƯA CHẠY` errors do `connection timeout expired`.
