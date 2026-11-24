# AUDIT PLAN — Whale/CVD contract BE (độc lập, read-only)

- **Vòng:** 1 · **Ngày:** 2026-11-24 · **Auditor:** agent độc lập (không sửa file) · **Ref:** branch `feat/whale-cvd-contract-be` @ `3437183bc`/`12de1be55`, tree sạch.
- **Đối tượng:** `docs/PLAN_WHALE_CVD_CONTRACT_BE_20261124.md` ↔ `docs/DECISION_WHALE_CVD_API_CONTRACT_20261124.md` (REV.2.1) ↔ `docs/evidence/whale-cvd-contract/G0_PROBE.md` ↔ code thật.

## VERDICT: `NEED_REVISION` (5 objections, 0 blocker kiến trúc)

### Verify đúng (không phải objection)

- Branch/claim/lessons đúng; baseline 5 gate chạy lại được; BE test ghi `CHƯA CHẠY` là trung thực.
- Stale claims đúng: `vet-finish`/`pm-review-20261108` branch mất; `stock-f07-slash`/`dataops-inventory-cold` đã merge `origin/dev`.
- Hợp đồng cũ được giữ: URL `market.js:584-587`, `isWhaleFeedResponse` widget `:238-244`, test `test_signal_intelligence_api_routes.py:107-114`, envelope `signal_intelligence/views.py:1051-1058`.
- P0 G0 (6.290 row `tick_session`, 623 clamp 5B, UNKNOWN 0,75%) được AC1 + AC2 + AC8 phủ.
- Không migration, không deny-list trong repo, claim trước code.

### Objections (bắt buộc sửa trước code)

1. **AC10 chưa khép (nặng nhất).** SCOPE chỉ có 3 file test, thiếu test WS; `ws_ticket.py:78-93` trả `User|None`, `tests/test_ws_ticket.py:60-63,74-76` + `test_ws_ticket_machine_scope.py:87,96` assert `.id` — đổi return shape sẽ hỏng test ngoài SCOPE. → Thiết kế **additive** `resolve_ws_identity()` (giữ hàm cũ) + thêm `packages/core/backend/tests/test_whale_ws_events.py` vào SCOPE. Đóng ở **S1/S4**.
2. **Claim thiếu file test.** `docs/CLAIMS.md:2048` không liệt kê 3 file test của plan; `AGENT_PROTOCOL.md:50` bắt mọi file sửa phải có claim. → Append dòng claim bổ sung **trước S1** (append-only).
3. **AC6 mâu thuẫn alias.** `signal_intelligence/views.py:1038` `.isoformat()` trả `+00:00`; plan áp `+07:00` cho mọi timestamp. → Loại alias khỏi AC6, giữ nguyên envelope + serializer 2 field (`:107-109`) + `?session_date=` + ts cũ; ghi lý do. Đóng ở **S2**.
4. **AC3 seed lệch ngưỡng.** D2 `small=[500M,1B)` nhưng plan seed 200M. → Đổi seed thành **600M**. Đóng ở **S2**.
5. **Đếm SCOPE + CORS chưa khép.** "12 file" nhưng liệt kê 14 path; AC11 không đặt tên file test; env là VPS-only (`AGENT_PROTOCOL.md:33`) ⇒ owner = **coordinator**. → Sửa nhãn 14 path, thêm `tests/test_whale_cors.py`, ghi owner. Đóng ở **S5**.

### Gate chuyển bước

`NEED_REVISION` ⇒ sửa plan + claim, re-audit vòng 2 (tối đa 3 vòng) rồi mới code. Không có objection nào yêu cầu migration hay đụng deny-list.
