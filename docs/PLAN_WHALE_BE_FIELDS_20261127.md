# PLAN S1 — Whale BE contract cho bubble chart (WHALE-BE-FIELDS-1127)

**Ngày:** 2026-11-27 · **Base:** `origin/dev @ 0a0f71a7c` · **Repo:** `vninvest`
**Nguồn:** plan liên repo `PLAN_WHALE_BUBBLE_UX_2026-11-27.md` (AGREE sau 3 vòng audit), audit UX `vninvestcharts-widget/docs/AUDIT_UX_GOCHARTING_PARITY_2026-11-27.md`.

## Lessons áp dụng: [L-001, L-002, L-003, L-B01, L-B02, L-V01]

- [ ] Claim khai trước dòng code đầu tiên, commit riêng (đã làm: `1c2345d73`).
- [ ] Không commit shared-file (deny list §2); không migration, không `pip/npm install`.
- [ ] Gate chạy **sau** `agent-sync.ps1` (rebase → migration → gate), không chạy trước.
- [ ] BE test cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`; thiếu ⇒ ghi `CHƯA CHẠY`, không suy ra PASS.
- [ ] Không in tiếng Việt có dấu ra stdout trong script chạy thật.
- [ ] Mọi verdict/gate ghi thành file `docs/evidence/whale-bubble-ux/**`.

## Mục tiêu & bằng chứng

| Việc | file:line hiện tại |
|---|---|
| Tách default/floor | `native_views.py:337` (`500M` vừa default `:379,492,621` vừa lower-bound `:616`) |
| Serialize buy/sell | `:517-537` đã có `bucket['buy']`/`['sell']`, `:571-586` chỉ trả `net_value`/`dominance` |
| Window 1h | `:474-478` chỉ `{4h,1D,1W}`; `:481-489` bucket key không có nhánh giờ |
| Cap query | `:418-419` `all_rows = list(per_tick)` rồi `[:limit]`; `:517` `list(qs.values())` |
| Ceiling | `:609-621` chỉ check dưới floor, không check trên |

## Tiêu chí nghiệm thu (Given/When/Then)

- **AC-01** Given tick buy+sell trong cùng bucket, When `GET ?window=1h`, Then response có `buy_value`, `sell_value`, `net_value`, `dominance`, `count`, `price`, `ts` đúng số học (`net = buy - sell`).
- **AC-02** Given `?min_value=<n>` trong [50K, 100B], When query, Then tick `matched_value >= n` được giữ; `n < 50K` ⇒ `400 MIN_VALUE_BELOW_FLOOR`; `n > 100B` ⇒ `400 MIN_VALUE_ABOVE_CEILING`.
- **AC-03** Given không truy `min_value`, When query, Then default vẫn **500M** (caller cũ không đổi).
- **AC-04** Given window `1h`, When bucket key, Then anchor theo giờ (`dt.replace(minute=0,...)`).
- **AC-05** Given floor hạ xuống 50K, When query nhiều tick, Then cả 2 path (`:418`, `:517`) lấy **tick mới nhất** `order_by('-executed_at')[:cap]` rồi reverse, cap default 200.000 (env), response `data_quality="truncated"` nếu chạm cap.
- **AC-06** Given môi trường thiếu Postgres/`CORE_DATABASE_URL`, When chạy pytest, Then ghi `CHƯA CHẠY` kèm lệnh tái tạo; không báo PASS.

## SCOPE / Non-goals

- SCOPE: `packages/core/backend/src/market_serving/native_views.py`, `packages/core/backend/src/market_data/tests/test_whale_cvd_full_tf.py`, `docs/evidence/whale-bubble-ux/**`, `docs/CLAIMS.md` (append), `docs/CODE_CHANGE_AUDIT_LEDGER.md` (append Entry riêng).
- Non-goals: không sửa widget repo trong slice này; không engine; không `requirements.txt`/`package.json`; không migration số tay; không đổi response shape cũ (chỉ thêm field).
- LIMIT: tối đa 3 vòng sửa mỗi AC.
- Rollback: revert commit; env `VNI_WHALE_DEFAULT_MIN_VALUE=500M` khôi phục default cho caller cũ (FE phải dừng gửi `min_value` trước).

## Baseline gates (lệnh + exit ghi trong evidence)

- `pwsh -File scripts/agent-sync.ps1` — exit 0 (rebase xong, 0 trùng migration, warning large-file không chặn).
- `node packages/web/scripts/check-multi-agent.mjs` — chạy trong agent-sync, PASS.
- `python manage.py test market_data.tests.test_whale_cvd_full_tf` — **CHƯA CHẠY** (chờ `CORE_DATABASE_URL` + DB riêng trên VPS), lệnh tái tạo ghi rõ.

## Fail-before

Test mới trong `test_whale_cvd_full_tf.py` phải ĐỎ trên code cũ: assert `buy_value`/`sell_value` có trong bucket response; `?window=1h` trả 400 UNSUPPORTED_WINDOW; `?min_value=100` trả `MIN_VALUE_BELOW_FLOOR` (không phải floor mới); `?min_value=200000000000` không bị chối (ceiling chưa có). Sau implement ⇒ XANH; mutation (xoá 1 field / đổi floor) ⇒ ĐỎ rồi restore.
