# B5 — `legacy_proxy` 500 + ledger cache-hit 500 (2026-09-26)

Agent: `lp-guard` · worktree `C:\Mujoco Projects\lp-guard` · branch `feat/lp-guard` · DB `ag_lp_guard`

Xuất phát từ 1 lỗi `user_workspace` tưởng là "pre-existing":

```
ERROR: test_core_v1_workspace_portfolio_analytics_routes_match_legacy_contracts
httpx.UnsupportedProtocol: Request URL is missing an 'http://' or 'https://' protocol.
  File "src/vninvest_core/legacy_proxy.py", line 77, in legacy_proxy_view
```

Sửa nó làm lộ ra **2 lỗi nữa**, mỗi lỗi che lớp kế sau. Cả 3 đều là bug
runtime thật, không phải lỗi test.

---

## B5.1 — `legacy_proxy` trả 500 thay vì 502 (`P1-LEGACY-01`)

`legacy_proxy.py:84` bắt `(httpx.ConnectError, httpx.TimeoutException)`.
Khi `LEGACY_BACKEND_URL` rỗng (`settings.py:176` default `''`) ⇒ `target_url`
thành `/api/<path>` — thiếu scheme ⇒ httpx ném `UnsupportedProtocol`.

MRO đo thật bằng `httpx` trong venv:

```
TransportError       -> RequestError -> HTTPError -> Exception
ConnectError         -> NetworkError -> TransportError -> ...
TimeoutException     -> TransportError -> ...
UnsupportedProtocol  -> TransportError -> ...      # KHONG phai ConnectError/Timeout
```

⇒ `UnsupportedProtocol` lọt khỏi `except` ⇒ Django trả **HTTP 500**.

`/api/*` là **catch-all cuối `urlpatterns`** ⇒ một config sai có thể làm đỏ
mọi request không match native route.

**Fix**: bắt `httpx.TransportError` (lớp cha, phủ hết 3 nhánh trên) + guard
`LEGACY_BACKEND_URL` rỗng trả `503 LEGACY_BACKEND_NOT_CONFIGURED` — config
thiếu khác lỗi upstream chết, phải phân biệt được.

Kèm: xoá comment `# BL-03:` bị lặp 2 lần ở `legacy_proxy.py:33-34`.

**Test**: `vninvest_core/tests/test_legacy_proxy_transport_error.py` (8) —
đỏ **5/8** trước fix.

---

## B5.2 — fixture parity test sai: `force_authenticate` ⇒ native 404

Sau B5.1, test chuyển từ `ERROR` (500) sang `FAIL`:

```
AssertionError: 404 != 200
  test_portfolio_analytics_native_routes.py:63
```

Lý do đã được `pf2-analyticsledger` ghi lại trong claim row (released) và giao
cho coordinator: **"`test_portfolio_analytics_native_routes.py:29` dùng
`force_authenticate` nên fixture không còn mô tả request hợp lệ (fail-closed)"**.

`force_authenticate` gắn thẳng `user` vào DRF Request, **bỏ qua** cả
`AuthenticationMiddleware` lẫn `TenantResolutionMiddleware` ⇒ `request.tenant`
luôn `None` ⇒ `_get_user_portfolio()` (P0-ISO-01) fail-closed 404.

Vì `/api/*` được gọi ở dòng 61 **trước** assert ở dòng 63, lỗi 500 che mất
việc native route cũng đang 404. Sửa B5.1 mới lộ ra.

**Fix**: `force_login` + tạo `CoreTenant` thật, theo đúng pattern
`test_analytics_tenant_matrix.py:131`.

Phần so sánh `/api/*` **không chạy được** khi thiếu legacy backend thật, nên
tách riêng và `skipUnless(LEGACY_BACKEND_URL)`. **Không** gia lập bằng stub:
so native với chính stub thì không chứng minh gì và biến parity test thành
tautology. (`vninvest_core/utils/legacy_stubs.py` có sẵn nhưng **0 import**.)

---

## B5.3 — `ledger._deserialize` không khôi phục `as_of` ⇒ cache-hit 500 (`P0`)

Sửa fixture xong thì native `/summary/` lộ lỗi thứ 3, lần này **không liên
quan proxy**:

```
AttributeError: 'str' object has no attribute 'isoformat'
  src/user_workspace/portfolio_analytics_views.py:153  -> build_meta(ledger)
  src/user_workspace/ledger/services.py:226              -> as_of.isoformat()
```

Cơ chế:

| bước | file:line | `meta['as_of']` |
|---|---|---|
| tính tay | `holdings.py:335` | `date` |
| ghi cache | `services.py:125` `_serialize` | `str` (`.isoformat()`) |
| **đọc cache** | `services.py:130` `_deserialize` | **`str` — không đổi ngược** |
| xuất JSON | `services.py:226` `build_meta` | gọi `.isoformat()` ⇒ **500** |

`_deserialize` restore `Decimal` cho `cash`/`pnl`/`holdings` nhưng **bỏ sót
`meta.as_of`**.

**Hậu quả**: chỉ request **tính tay** (cache-miss) mới chạy được. Mọi request
**thứ 2 trở đi** của portfolio có holdings ⇒ `HTTP 500` tại
`/core/v1/workspace/portfolios/<id>/summary/`.

**Vì sao test PA-2 không bắt**: `test_ledger_holdings.py:280,295,386` đều gọi
`get_cached_ledger(..., use_cache=False)` ⇒ **bỏ qua cache** ⇒ `as_of` luôn là
`date`. Toàn bộ test của PA-2 chỉ đi đường cache-miss.

**Fix** (2 chỗ):
1. `_deserialize` khôi phục `as_of` về `date` (đúng mức như `Decimal`).
2. `build_meta` nhận được cả `str` — serializer này không bao giờ được ném 500.

**Test**: `user_workspace/test_ledger_cache_as_of.py` (6) — đỏ **4/6** trước
fix, có cả `from_cache` assert để bắt đúng đường cache-hit.

---

## Gates

| gate | kết quả |
|---|---|
| `manage.py check` | 0 issue |
| `makemigrations --check --dry-run` | `No changes detected` (không tạo migration) |
| `check-multi-agent.mjs` | exit 0 — `0 lỗi, 0 trùng số migration — PASS` |
| test mới `test_legacy_proxy_transport_error` | 8/8 OK (đỏ 5/8 trước fix) |
| test mới `test_ledger_cache_as_of` | 6/6 OK (đỏ 4/6 trước fix) |
| 6 file liên quan | `Ran 53 — OK (skipped=1)` |
| **`user_workspace` full** | **`Ran 317 — OK (skipped=3)`** · trước `310 — FAILED (errors=4)` |
| `vninvest_core` full | xem bảng baseline bên dưới — **không lỗi mới** |

## Baseline `vninvest_core`: đã đỏ sẵn 50 lỗi — **không** phải do thay đổi này

Chạy cùng lệnh trên `feat/lp-guard` có và không có thay đổi (stash `-u`):

| | tests | failures | errors | tổng lỗi |
|---|---|---|---|---|
| `dev` (baseline, stash) | 161 | 37 | 13 | **50** |
| `feat/lp-guard` (có fix) | 169 | 42 | 8 | **50** |

+8 test mới (6 `test_ledger_cache_as_of` + 2 `test_legacy_proxy`); tổng lỗi
**không đổi**. 5 lỗi chuyển `ERROR → FAIL` là 5 test `T19–T23` trong
`vninvest_core/tests/test_user_workspace_tenant_isolation.py` — xác nhận trực
tiếp trên baseline:

```
raise UnsupportedProtocol(...)
httpcore.UnsupportedProtocol: Request URL is missing an 'http://' or 'https://' protocol.
```

Tức trước fix chúng **đã** đỏ (500 do chính bug B5.1); sau fix chúng trả 503
đúng thiết kế nên assert 200 fail. **Cùng một nhóm test, cùng trạng thái "đỏ",
chỉ đổi failure mode** — không có test nào mới bị hỏng.

### Nợ còn lại (không thuộc scope lần này, file không ai giữ)

`vninvest_core` còn **50 lỗi** nguyên trạng, nổi lên khi kiểm regression:

- `AssertionError: 404 != 429` (×14), `404 != 400` (×9) — endpoint thiếu
- `Content-Type header is "text/html"` thay vì `application/json` (×9) ⇒
  `404.html` của Django lọt ra ⇒ **thiếu catch-all JSON 404 handler**
- `test_T19–T23` + `test_T11`: cần legacy backend thật, không chạy được trong
  CI (cùng nhóm với parity test đã `skipUnless`)

Cần ticket riêng. Không tự mở rộng trong lần này.
