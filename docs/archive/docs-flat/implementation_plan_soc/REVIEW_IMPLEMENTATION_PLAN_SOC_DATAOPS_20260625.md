# Phản Biện: IMPLEMENTATION_PLAN_SOC_DATAOPS_SAAS_NATIVE_MIGRATION_20260625.md

**Người review:** AI Architect
**Ngày:** 2026-06-25
**Trạng thái:** 🟡 Cần chỉnh sửa trước khi proceed

---

## 1. ❌ Sai lầm lớn nhất: Giả định "port from scratch"

Plan được viết như thể mọi thứ phải xây mới từ zero. **Thực tế: 60-80% code DataOps tab đã tồn tại sẵn trong `packages/web`:**

| Component | Trạng thái hiện tại | Ghi chú |
|-----------|-------------------|---------|
| `SocDataOpsPanel.tsx` | ✅ Hoàn chỉnh | Tab container, 5 sub-tab navigation, glassmorphism |
| `DataOpsContext.tsx` | ✅ Có sẵn | State + actions cơ bản (inventory, runs, coverage) |
| `SocDataInventorySection.tsx` | ~70% | Thiếu year bar chart, coverage table, data types dynamic grid, queue tiers accordion |
| `SocDataOpsBackfillForm.tsx` | ~80% | Thiếu Planner Console, còn dùng `alert()` thay vì inline feedback |
| `SocDataOpsMonitorSection.tsx` | ~60% | Thiếu parity gates, retention health, anomaly guard, matrix integration |
| `SocDataOpsConfigSection.tsx` | ~60% | Run logs, audit trail có sẵn; thiếu purge button, preview modal refinement |
| `SocSchedulerBoard.tsx` | ✅ Có sẵn | Đã tích hợp trong DataOps panel |
| `SocMatrixScrapeMonitor.tsx` | ✅ Có sẵn | Heatmap matrix component đã hoạt động |
| `SocBackfillProgressPanel.tsx` | ✅ Có sẵn | **Không được đề cập trong plan** |
| Tab registration | ✅ Đã hoàn thành | Trong `ShellOperationsCenterPage.tsx` lines 48, 79-80 |

**Kết luận:** Cần chuyển đổi cách tiếp cận từ "port from scratch" sang **"gap analysis: components hiện tại còn thiếu gì so với legacy"**.

---

## 2. 🚩 Scope quá rộng — cần phân phase

5 subtabs + 4 premium enhancements (Airflow-style Gantt, Datadog-style viz, Snowflake-style heatmap, Custom Groups CRUD) là khối lượng của 3-4 phase riêng biệt.

### Đề xuất phân phase:

| Phase | Nội dung | Mục tiêu |
|-------|----------|----------|
| **Phase 1** | Gap-fill các subtabs hiện có để đạt full parity với legacy | Porting hoàn tất, không enhancement |
| **Phase 2** | Custom Symbol Groups CRUD + Airflow-style progress bars | Nâng cấp UX |
| **Phase 3** | Retention histogram, Anomaly Guard panel, Parity trend charts | Premium visualization |

---

## 3. ❌ Thiếu ràng buộc `createElement`

Plan không nhắc đến quy tắc bắt buộc: **tất cả UI component trong `packages/web` phải dùng `React.createElement`, không JSX** (do pre-commit hook `react/jsx-no-literals` kiểm tra). Tất cả code DataOps hiện có đều tuân thủ convention này. Mọi PR mới phải follow.

---

## 4. ❌ i18n chưa tồn tại

Key `soc.dataops.*` **không có trong cả `vi.js` lẫn `en.js`**. Các component đã reference các key này (ví dụ: `t("soc.dataops.total_rows")`) → runtime sẽ fallback về raw key string thay vì text hiển thị.

**Cần bổ sung:** Tạo toàn bộ block i18n keys cho DataOps trước hoặc song song với Phase 1 code.

---

## 5. ❌ Thiếu CSS plan

Các section mới (coverage table, parity gates, retention histogram, anomaly guard) cần styles riêng trong `soc.module.css`. Plan hiện tại không đề cập đến CSS changes.

---

## 6. ⚠️ DataOpsContext expansion không tối ưu

Plan đề xuất thêm vào `DataOpsContext`:
- `getSocSymbolGroups()`, `createSocSymbolGroup()`, `deleteSocSymbolGroup()`
- `getSocMatrixMonitor()`, `startSocMatrixCycle()`, `abortSocMatrixCycle()`
- `purgeSocDataOpsRunLogs()`
- `getSocDataOpsRuntimeConfigAudit()`, `previewSocDataOpsRuntimeConfig()`

**Vấn đề:** Các tính năng này chỉ dùng bởi 1 subtab cụ thể. Đưa vào context gây:
- Re-render không cần thiết cho toàn bộ DataOps tree
- Phá vỡ pattern hiện tại (SOC Signals, Overview tabs dùng local state + direct adapter call)

**Đề xuất:** Chỉ giữ trong context những state/actions dùng chung bởi ≥2 subtabs. Các tính năng riêng của từng subtab nên dùng local state + adapter call trực tiếp.

---

## 7. ⚠️ "Airflow Gantt" over-engineered cho Phase 1

Mini progress bar + status timeline với trạng thái Celery tasks (Hydrate → Reconcile → Materialize) là đủ cho parity. Gantt chart đầy đủ là premium enhancement cho Phase 3.

---

## 8. ⚠️ Thiếu Docker rebuild trong verification plan

Verification hiện tại chỉ có `npm run build`. Theo `AGENTS.md` §6.8:

> **QUY ĐỊNH CỨNG**: Kết thúc mọi thay đổi mã nguồn, bắt buộc phải rebuild và khởi động lại Docker stack bằng script `./start_dev.ps1`

Cần thêm step: `.\start_dev.ps1` + smoke test.

---

## 9. ⚠️ Thiếu thứ tự ưu tiên triển khai

Đề xuất thứ tự dựa trên mức độ phụ thuộc:

```
1. Inventory Section (ít phụ thuộc nhất, mostly stateless render)
       ↓
2. Config Section (độc lập, không phụ thuộc subtab khác)
       ↓
3. Ops / Backfill Form (cần backend + context runs state)
       ↓
4. Monitor Section (phụ thuộc nhiều API nhất: observability, matrix, coverage, queue-tiers)
       ↓
5. Scheduler (đã có SocSchedulerBoard, chỉ cần integrate)
```

---

## 10. Thiếu verification backend contracts

Một số endpoint được liệt kê cần verify sự tồn tại trong `packages/core/backend/src/service_ops/urls.py`:
- `POST /operator/soc/dataops/backfill/run-now/` — cần check backend có view không
- `POST /operator/scraping/dataops/planner/run/<run_id>/abort/` — pattern có khớp với implementation không

---

## Tổng kết: Checklist hành động

- [ ] Rewrite plan từ "port from scratch" → **gap analysis trên code hiện có**
- [ ] Chia scope thành **3 phase** riêng biệt
- [ ] Thêm **`createElement` constraint** vào hard requirements
- [ ] Thêm bước **tạo i18n keys** (`soc.dataops.*`) cho cả `vi.js` và `en.js`
- [ ] Thêm **CSS changes** vào plan
- [ ] Thu nhỏ **DataOpsContext expansion** — chỉ context-shared state, local state cho subtab-specific
- [ ] Downgrade "Airflow Gantt" thành **mini progress bars** (phase 1) / full Gantt (phase 3)
- [ ] Thêm **`.\start_dev.ps1` rebuild** vào verification steps
- [ ] Thêm **thứ tự ưu tiên** rõ ràng
- [ ] Verify **backend endpoint contracts** trước khi code
