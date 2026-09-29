# tw-wire — nối dây 2 khóa Turnstile qua hạ tầng thật (2026-09-26)

Agent: `tw-wire` · worktree `C:\Mujoco Projects\tw-wire` · branch `feat/tw-wire` · DB `ag_tw_wire`

## Vì sao cần

Báo cáo trước đó kết luận: *"cần set `TURNSTILE_SECRET_KEY` và
`VITE_TURNSTILE_SITE_KEY` lúc build trước khi deploy"*. Đối chiếu với code
thật cho thấy **đặt xong cũng không có tác dụng** — không có đường dây nào chạm
tới container.

| # | Chỗ | Thực tế |
|---|---|---|
| 1 | `docker-compose.dev.yml` `frontend.build.args` | chỉ `VITE_API_URL`, `STOCKCHART_REF`, `GITHUB_TOKEN` — **thiếu `VITE_TURNSTILE_SITE_KEY`** |
| 2 | `packages/web/Dockerfile:14-19` | khai báo `ARG VITE_API_URL`, `VITE_WS_BASE_URL`, `VITE_DISABLE_REALTIME_WEBSOCKET` — **thiếu `ARG VITE_TURNSTILE_SITE_KEY`** ⇒ Vite không có gì để inject |
| 3 | service `core-api` `environment:` | **không có** `TURNSTILE_SECRET_KEY`, `STRICT_TURNSTILE_ENFORCEMENT` |
| 4 | `compose.dev.env.example` | **không khai báo** khóa nào trong 3 khóa trên |

Phía đọc thì **đã đúng**: `TurnstileWidget.js:23,26` dùng
`import.meta.env` → `viteEnv.VITE_TURNSTILE_SITE_KEY`. Đứt ở khối build, không
phải ở phía đọc.

Nói cách khác: P0 "production có anti-spam nhưng chạy fail-open" đã được sửa ở
tầng code, nhưng **cầu nối từ env → container thì chưa từng tồn tại**. Sửa
`TurnstileWidget` mà không sửa 3 chỗ trên thì bản build vẫn không có key.

## Rủi ro suýt gây ra khi sửa

Nếu nối dây bằng cách đơn giản — thêm
`STRICT_TURNSTILE_ENFORCEMENT: ${STRICT_TURNSTILE_ENFORCEMENT:-}` vào compose —
thì **tự mở lại đúng P0 vừa đóng**:

`settings.py` cũ dùng `os.environ.get(K, default)`. Docker-compose
`${VAR:-}` tạo chuỗi **rỗng**, `os.environ.get` trả `''` (không phải `default`),
rồi `''.lower() in ('true','1','yes')` ⇒ `False` ⇒ **tắt strict ở production**,
vô hiệu hoá `apps.py:38-45`.

Thêm nữa, chuỗi toàn khoảng trắng là truthy nên `.strip()` phải đặt **trước**
`or`, nếu không `env='   '` vẫn tắt strict.

Đã sửa `settings.py:246` thành fail-closed:

```python
(os.environ.get('STRICT_TURNSTILE_ENFORCEMENT') or '').strip().lower()
or str(not DEBUG).strip().lower()
) in ('true', '1', 'yes')
```

Kiểm bằng `eval` biểu thức thật từ file, 7 ca:

| ca | strict | đúng? |
|---|---|---|
| prod, env unset | True | ✔ |
| prod, env `''` (đúng case `${VAR:-}`) | True | ✔ |
| prod, env `'   '` | True | ✔ |
| prod, env `'false'` | False | ✔ |
| dev, env unset | False | ✔ |
| dev, env `''` | False | ✔ |
| dev, env `'true'` | True | ✔ |

**Còn lại (không xử lý ở đây):** giá trị **không hợp lệ** như
`STRICT_TURNSTILE_ENFORCEMENT=yes please` vẫn ra `False` ⇒ tắt strict. Đúng
chuẩn fail-closed nên raise `ImproperlyConfigured` khi production mà giá trị
không nằm trong allowlist. Tách ticket riêng — cần chốt policy, không tự
quyết.

## Thay đổi

- `packages/web/Dockerfile` — `ARG` + `ENV VITE_TURNSTILE_SITE_KEY` **trước**
  `RUN npm run build` (Vite chỉ inject lúc build)
- `docker-compose.dev.yml` — `frontend.build.args` + `core-api.environment`
- `compose.dev.env.example` — khai báo 3 khóa kèm giải thích
- `settings.py` — rỗng/khoảng trắng = chưa đặt
- **không** thêm secret thật vào git

## Test

`packages/web/src/components/auth/turnstile-wiring.component.test.js` (7).

Tên file phải khớp `src/**/*.component.test.{js,ts,tsx` của `vitest.config` —
lần đầu đặt tên `*.contract.test.js` thì vitest **không hề chạy** và báo
`No test files found` (exit 1) — dễ tưởng là pass.

Bằng chứng test không phải tautology: stash 4 file nguồn → **5/7 đỏ** đúng 5
đường dây; khôi phục → 7/7 xanh.

| # | test | đỏ khi revert |
|---|---|---|
| 1 | FE đọc từ Vite, không `process.env.REACT_APP_*` | (đã pass sẵn ở `dev`) |
| 2 | Dockerfile khai `ARG`+`ENV` trước `npm run build` | ✔ |
| 3 | compose truyền `VITE_TURNSTILE_SITE_KEY` vào frontend build args | ✔ |
| 4 | compose truyền `TURNSTILE_SECRET_KEY` vào `core-api` | ✔ |
| 5 | `compose.dev.env.example` khai 3 khóa | ✔ |
| 6 | env rỗng = chưa đặt, không tắt strict ở production | ✔ |
| 7 | không có secret thật trong file commit | (đã pass sẵn ở `dev`) |

Test 1 và 7 pass ở `dev` ⇒ chúng chỉ chống **tái phát**, không chứng minh lỗi
cũ. 5 test kia mới là bằng chứng.

## Gates

| gate | kết quả |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src --quiet` | exit 0 |
| `npm run build` | `✓ built in 1m 12s` |
| `npx vitest run` (toàn bộ) | `673 passed / 1 failed` |
| test mới `turnstile-wiring.component.test.js` | 7/7 (đỏ 5/7 khi revert) |
| `docker compose config` | 17 service, exit 0, 3 khóa resolve |
| biểu thức `STRICT_TURNSTILE_ENFORCEMENT` | 7/7 ca đúng |
| `manage.py check` | 0 issue |
| `makemigrations --check --dry-run` | `No changes detected` |
| `identity_access` (app đọc cờ này) | **418 test OK** |

### 1 test đỏ trong `vitest run` — flake pre-existing

`src/hooks/useAlertCenterSnapshot.pagination.component.test.ts`. Chạy riêng
**3/3 xanh**. Đã ghi trong `AGENTS.md` là flake không ổn định trong full suite
và tái lập được trên HEAD sạch. Không file nào thuộc diff này liên quan
(`docker-compose.dev.yml`, `compose.dev.env.example`, `settings.py`,
`Dockerfile`).

## Còn lại — owner phải làm trước deploy

Không tự đặt được (là secret của bạn):

1. `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile, **server-side**
2. `VITE_TURNSTILE_SITE_KEY` — site key **công khai**, build-time; đổi giá trị
   phải rebuild image frontend (`docker compose build frontend`)
3. Với `STRICT_TURNSTILE_ENFORCEMENT` không cần đặt: production tự
   `ImproperlyConfigured` nếu thiếu secret key — đúng chuẩn, không im lặng bỏ
   qua.

Ngoài ra, các ticket đã ghi ở `CLAIMS.md` vẫn treo:
quota đơn vị ngày/tháng (cần quyết định sản phẩm) ·
`AuditLogListView` fail-closed làm hẹp tầm nhìn SOC ·
`commercial/views.py` còn `CoreTenant.objects.get(owner_user=...)` ⇒ 500 cho
member · `vninvest_core` ~50 lỗi URL-routing (thiếu JSON 404 catch-all).
