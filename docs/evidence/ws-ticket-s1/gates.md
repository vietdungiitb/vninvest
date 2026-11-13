# Gates S1 — WS ticket G0.2/C02 (bằng chứng chạy thật trên VPS staging)

> Ngày: 2026-11-13 · Branch: `feat/ws-ticket-s1` · Worktree fail `/tmp/wt-ws1-fail` @ `origin/dev`, fix `/tmp/wt-ws1-fix` @ branch tip · DB: `ws1_fail` / `ws1_fix` (đã DROP sau chạy)

## 1. FAIL-BEFORE — module `identity_access.ws_ticket` chưa tồn tại

`manage.py test tests.test_ws_ticket` trên code chưa sửa: `ERROR — ModuleNotFoundError: No module named 'identity_access.ws_ticket'` (feature missing; endpoint 404).

## 2. PASS-AFTER — 8/8 OK (`62cc325dc`)

`Ran 8 tests — OK` (0.13s): 401 khi chưa auth · 200 flat `{ticket, expiresIn:60}` · single-use (lần 2 None) · invalid/expired None · `?ticket=` resolve đúng user + 1 lần · `?token=` tương thích · query rỗng None.

## 3. Hồi quy + gates

| Gate | Kết quả |
|---|---|
| `identity_access signal_intelligence` | `Ran 504 tests — OK` (132.8s) |
| `makemigrations --check` | `No changes detected` (cache-backed, không migration — đúng thiết kế) |
| `spectacular` diff vs dev | dev `56 err/14 unique` == fix `56/14` → **SPECTACULAR-CLEAN** (2 vòng fix: response serializer + `request=OpenApiTypes.OBJECT`) |
| Local: `check-multi-agent` / `check-ledger-entry` / `check-lessons` / `normalize-eol` / `scan-secrets` | chạy ở bước đóng slice |

## 4. Ghi chú contract

Endpoint trả FLAT (không envelope) vì widget `fetchWsTicket` đọc `r.json().ticket` raw top-level (`VNInvestClient.ts:813-826`). Ghi rõ trong docstring view + plan S1.
