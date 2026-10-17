# R3.3 — Dashboard SLO LLM (2026-10-17)

Nhánh `feat/ai-r33-slo-dashboard` ← `dev`. Claim `ai-r33`.
Plan: `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1085-1103`.

## Sai lệch plan vs thực tế — đo trước khi code

Plan `:1093` (AC1) yêu cầu *"Percentile tính trên DB bằng **window function**"*. Tôi đo
trong container staging trước khi viết:

```
django 5.2.18
db.models.functions: ['Ntile', 'PercentRank']      # không có PercentileCont
aggregates:          []                           # không có
contrib.postgres:    []                           # không có
```

⇒ Django ORM **không có** `PercentileCont`. Và Postgres **không cho** percentile dạng
window: `PERCENTILE_CONT` là ordered-set aggregate (`WITHIN GROUP (ORDER BY …)`), không
nhận `OVER`. Nên construct đúng của Postgres là ordered-set aggregate — tôi tự viết
`ai_analytics/percentiles.py` (tham số percentile đi qua **query parameter**, không nội
suy vào SQL).

**AC1 vẫn đạt đúng ý nghĩa**: *"tính trên DB, không kéo hết về Python"*. Chữ "window
function" trong plan là cách nói **không hiện thực được** với percentile trên Postgres.
Đã ghi vào claim + ledger để không ai "sửa cho khớp chữ".

## AC

| AC | Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|---|
| AC1 | Percentile trên DB, so với giá trị tính tay | ✅ | 1000 bản ghi, p50/p95/p99 khớp hàm `percentile()` tự viết trong test (`places=3`) + **AC1b** chốt chặn: SQL phải chứa `percentile_cont` và chỉ **1** truy vấn gom nhóm |
| AC2 | `total=0` ⇒ `—` chứ không `0%` | ✅ | BE trả `success_rate=None` + `results=[]`; FE `dash()` hiện `—`; test assert **không** chứa `0%` |
| AC3 | `$` theo `pricing_available` | ✅ | `pricing_complete = not unpriced`; FE hiện `—` khi thiếu giá — test cả 2 nhánh (có giá → `$0.05`, thiếu giá → `—`) |
| AC4 | Chart dùng token R1.6 | ✅ | `import { chartToken } from "../components/AIUsageDashboard.tsx"` — **không** khai bản fallback thứ hai; test quét mã nguồn (mẫu `ai-usage-chart-r16`) + `check-ai-cc` SACH |
| AC5 | Range 7/30/90 | ✅ | FE 3 nút `aria-pressed`; BE chỉ nhận `{7,30,90}`, ngoài tập ⇒ rơi về 30 (test) |
| AC6 | Cache 60 s; `document.hidden` không poll | ✅ | `CACHE_MS = 60_000`; test dùng fake timer: tab ẩn + 180 s ⇒ **vẫn 1 lần gọi**; tab hiện + 70 s ⇒ có lần gọi thứ 2 |

## Bug do lint/test bắt được (đều là của tôi)

1. **State `tick` là hack**: dùng state để "ép" refetch nhưng `load` không đọc nó ⇒
   `react-hooks/exhaustive-deps` báo dependency thừa (2 lỗi lint). Sửa: poll gọi thẳng
   `execute()`. Bỏ hẳn `tick`.
2. **`const rows = data?.results ?? []`** tạo mảng mới **mỗi render** ⇒ `useMemo` phía
   dưới đổi identity vô ích (lỗi lint thứ 2). Sửa: bọc `useMemo`.
3. `PercentileCont.as_sql` — nội suy sai: `'...(%s)...%s' % inner_sql` khiến `inner_sql`
   bị nuốt vào placeholder đầu ⇒ `TypeError: not enough arguments for format string`
   ⇒ 500. Sửa: `'%%s'` cho placeholder của tham số.

## Bẫy gặp

| Bẫy | Hậu quả | Cách tránh |
|---|---|---|
| Tin nhớ `PercentileCont` có sẵn trong Django | 500 (`ImportError`) | Probe container staging trước khi code |
| `readFileSync(new URL(..., import.meta.url))` | `TypeError: The URL must be of scheme file` (vitest/Windows) | Dùng `resolve(process.cwd(), ...)` như `ai-usage-chart-r16` |
| Không polyfill `ResizeObserver` | recharts sập **cả cây render** ⇒ bảng cũng biến mất, 6 test đỏ với triệu chứng sai (thiếu `slo-row`) | Polyfill y hệt 5 file test recharts khác |
| Assert `<svg>` của recharts trong jsdom | Fail giả — container 0×0 ⇒ không vẽ | AC4 kiểm bằng quét mã nhuồn (đúng cách repo đang làm) |
| `.Replace()` chuỗi 4-space khớp cả dòng 6-space | Chèn trùng 3 bản `aiSlo` trong `en.js` | Pattern phải khác nhau về thụt lề thật, hoặc dùng `edit` |
| `reverse()` thiếu namespace | `NoReverseMatch` | `ai_analytics.urls` có `namespace='ai_analytics'` |

## Gate đã chạy

| Gate | Kết quả |
|---|---|
| BE mới | `tests.test_ai_usage_slo` **17/17** |
| BE hồi quy | 43 module · **533/533 OK** |
| FE mới | `ai-slo-dashboard.component.test.tsx` **10/10** |
| FE hồi quy | 87 file · **584/584** |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (`built in 40.50s`) |
| `i18n:scan` | exit 0 |
| `lint` | **0 error** / 4127 warning (+24 so với R3.2, toàn bộ `jsx-no-literals` trên `data-testid`) |
| `check-ai-cc` | SACH |
| `check:ai-cc-dag` | PASS 46/61/0 vòng |
| pre-push | **23/23** (sau khi regen endpoint catalog: 1511 route) |

## CHƯA CHẠY (không báo PASS)

- **Chưa mở trên staging thật** ⇒ chưa biết dashboard hiển thị ra sao với dữ liệu thật.
- **Chưa chạy E2E Playwright** (đổi range �� đổi tab ⇒ chart đổi).
- **Staging chưa có dữ liệu usage** (không có key provider — R2.10 AC8 vẫn mở từ M2) ⇒
  sẽ thấy empty state. Đúng, nhưng chưa ai nhìn thấy nhánh "có số liệu".
- Chưa đo hiệu năng trên tập dữ liệu lớn — test dùng 1000 bản ghi. Backlog R3.3b của
  plan (materialized aggregate khi > ~10M row) **vẫn chưa cần**, nhưng **chưa** có số
  liệu thực tế để biết đã gần ngưỡng chưa.
- Full BE ngoài advisory+AI · `ruff` · E2E · staging deploy.

## Tiếp

R3 đóng 3/3 slice. Còn nợ chung của R2/R3 đã ghi ở `R2-M2-CLOSEOUT.md` và
`R3-M3-CLOSEOUT.md`; **AC13 của R2** (link `ghu_`) vẫn chưa làm.