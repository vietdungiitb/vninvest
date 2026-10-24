# Hồ sơ audit độc lập — skill `workflow-dev-loop` (2026-10-24)

> Backfill từ transcript phiên làm việc (auditor: subagent độc lập, chỉ đọc).
> File này tồn tại vì quy tắc cứng số 6 (Owner chốt 2026-10-24): mọi audit PHẢI thành văn bản.

## Vòng 1 — Verdict: `NEED_REVISION` (5 objection)

Đối tượng: `.opencode/skills/workflow-dev-loop/SKILL.md` (bản đầu).
Phương pháp: đối chiếu `docs/AGENT_PROTOCOL.md` + nguồn ERP (`erp-dev-loop/SKILL.md`, `rules/erp-dev-loop.md`, `dev-loop/SKILL.md`); xác minh 20/20 skill id tồn tại; xác minh 12/12 đường dẫn script/docs tồn tại. Khung 9 bước + 5 luật giữ đúng, không lọt chi tiết ERP.

| # | Objection | Căn cứ |
|---|---|---|
| 1 | B7 gắn `webapp-testing` với "App local" — trái §12 cấm test/E2E local, bắt buộc VPS staging | `AGENT_PROTOCOL.md:436-447` |
| 2 | Thiếu `agent-sync.ps1` ở B1 (mở phiên) và B7 (gate chỉ tin sau rebase) — gate/status trước rebase đọc code cũ | `AGENT_PROTOCOL.md:270-280,305-309`, L-003 |
| 3 | B7 thiếu gate `node scripts/check-experiment-env.mjs` — cổng duy nhất quét `docker run\|exec\|compose\|ps` không kèm dấu hiệu VPS | Đã nối vào `pre-push-gate.mjs` |
| 4 | Khóa dòng `ENV-STAGING` là carryover ERP — `grep docs/`, `CLAIMS.md` = 0 hit trong vninvest | Không có nguồn |
| 5 | "File deny-list không bao giờ claim" diễn đạt quá rộng — §2 cho `CLAIMS.md` append cuối + ngoại lệ Owner 2026-10-03 cho ledger | `AGENT_PROTOCOL.md:31,37` |

## Vòng 2 — Verdict: `PASS` (sau khi sửa cả 5)

1. App local → "Chạy trên VPS staging (§12.3/12.4); local chỉ review diff" — hết mâu thuẫn §12.
2. `agent-sync.ps1` đã có ở B1 (trước status) và B7 (rebase→gate) — đúng §10.1/§10.4.
3. `check-experiment-env.mjs` đã vào gate list B7.
4. `ENV-STAGING` đã bỏ → "xin coordinator + ghi rõ phạm vi".
5. Deny-list đã diễn đạt đúng: 5 nhóm §2 cấm + CLAIMS chỉ append cuối + ledger được append Entry.

Không phát sinh lệch mới. Skill đạt để dùng.

## Dấu vết phiên bản

- Audit trên bản skill trước commit `42db50faa`; 5 fix đã vào cùng commit đó.
- Auditor: subagent `general` (session `ses_e92e018ffeX8d2stdfhLoF2J`), vòng 2 cùng session.
