# R0.6 gates — SSRF no-echo + throttle (plan Rev.2 §R0.6)

Branch: `feat/ai-r06-ssrf` · Claim: `ai-r06` · Khong migration · Khong settings.py · Khong FE.

## 1. AC doi chieu (L-V02: doc code that truoc khi ket luan)

| AC | Plan | Truoc fix (code that) | Sau fix |
|---|---|---|---|
| AC1 | `validate_outbound_endpoint("http://169.254.169.254/...")` → raise | XANH san: `assert_safe_outbound_url` (`endpoint_safety.py:122`) + `test_ai_endpoint_safety.py` | Giu nguyen (doi ten ham theo plan la vo ich — ten cu da dung o 2 noi) |
| AC2 | Chan 8 nhom IP | XANH san (literal + `::ffff:127.0.0.1`, test classifier) | Giu nguyen |
| AC3 | Chan scheme file/gopher/ftp/dict | XANH san (`ALLOWED_SCHEMES={http,https}` `:31`) | Giu nguyen |
| AC4 | local + private + co co che mo → cho phep | XANH mot nua: `allow_loopback=True` cho local + allowlist env `SOC_AI_ALLOWED_ENDPOINT_HOSTS` (khac ten co che plan de xuat `AI_ALLOW_PRIVATE_ENDPOINT`, nhung tuong duong hanh vi) | Giu nguyen |
| AC5 | local + private mac dinh → 400, message KHONG chua endpoint | **DO (3 vi tri)**: `portfolio_analytics_views.py:1492` `detail=f'Endpoint bị chặn: {exc}'` (exc chua host→ip); `:1513` timeout kem `{endpoint}`; `:1519` HTTP kem `{endpoint}` | Message tinh + hint `SOC_AI_ALLOWED_ENDPOINT_HOSTS`. Test cu `test_refusal_names_the_blocked_address` (:92-98) khang dinh hanh vi cu → rework thanh `test_refusal_does_not_echo_endpoint` (tien le C-AC3/C-AC4 o R0.2) |
| AC6 | DNS resolve ra IP private → chan | XANH (resolve + duyet moi IP, `resolve_endpoint_ips` `:106-119`). TOCTOU rebinding van la residual risk da ghi nhan trong docstring module — khong nhan da dong |
| AC7 | scope `ai_test_connection`, 21 POST → 429 | **DO**: scope `ai_endpoint_probe`, 10/60s (`:57-59`) | scope `ai_test_connection`, 20/h, `test_ac7_21st_probe_returns_429` (20×200 openclaw + lan 21×429) |
| AC8 | Khong "Traceback"/"httpx." | **DO (2 vi tri)**: `:1522-1527` `detail=f'...{str(e)}'`; `:1607-1612` cloud branch `str(e)` | Message tinh; log chi giu `type(e).__name__` |
| AC9 | custom_endpoint cong cong van chay | XANH (mock httpx) + giu nguyen | Them `test_public_custom_endpoint_passes` (mock DNS, hermetic) |
| Orchestrator | guard `orchestrator.py` (plan ghi :196-200 ban cu) | **DO**: `custom_endpoint` tu `UserAICredential` (`models.py:288`, khong validate luc save — `serializers.py:343` passthrough) → `endpoint` (`:463-464`) → `client.post` (`:210`), khong guard | Moi `_resolve_chat_endpoint()` (validate truoc POST, fail-closed, message tinh) + dung tai resolve point; `ValueError` tinh → `tasks.py:306-311` luu `error_message` an toan |

## 2. Fail-before (bang chung chay that, local, khong DB)

- `scope= ai_endpoint_probe rate= 10 window= 60` + `AssertionError: RED-AC7` (truoc fix).
- `ImportError: _resolve_chat_endpoint` (ham chua ton tai, truoc fix).
- Sau fix: `GREEN-LOCAL-LOGIC` (scope/rate/window + public-pass + private-blocked-no-echo + localhost-default).
- Full Django suite: **CHUA CHAY local** — `sqlite3.OperationalError: no such function: array_agg`
  (`9000_auth_user_email_ci_unique.py:60`, L-B01) + docker daemon down (khong Postgres local).
  Chay that tren VPS staging (DB tam), xem §3.

## 3. BE VPS staging (RED→GREEN)

(Ghi sau khi chay: lenh + exit code + so test.)

## 4. Gate khac

- `makemigrations --check --dry-run`: (ghi exit code — khong doi model, ky vong No changes)
- `check-multi-agent`: 0 loi (hook pre-commit chay moi commit)
- FE/tsc/i18n/build: KHONG CHAM FE → **CHUA CHAY** (khong suy ra PASS)

## 5. Non-goals (khong lam trong slice nay)

- Khong doi ten `assert_safe_outbound_url` → `validate_outbound_endpoint` (vo ich).
- Khong them `AI_ALLOW_PRIVATE_ENDPOINT` (allowlist env hien co tuong duong).
- Khong dong TOCTOU DNS-rebinding (residual risk da ghi nhan).
- Khong sua success payload (`endpoint`, `models_available`) — FE/parity test phu thuoc.
- Khong validate `custom_endpoint` luc save (R0.7/R1 co the them; orchestrator guard da fail-closed).
- R0.7 (audit FK + migration) / R0.9 (tach lop A/B): slice tiep theo.
