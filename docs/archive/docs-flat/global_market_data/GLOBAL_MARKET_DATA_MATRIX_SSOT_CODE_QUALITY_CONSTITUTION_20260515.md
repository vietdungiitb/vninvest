# Code Quality Constitution — Global Market Data Matrix SSOT
**Ngày**: 2026-05-15

---

## 1. Purpose

Constitution này ràng buộc mọi code thuộc chương trình Global Market Data Matrix SSOT.

---

## 2. Absolute rules

1. Không tạo per-user market-data copy models, caches hoặc read models mới.
2. Không tạo provider access path mới ngoài `market_data.vnbroker_adapter`.
3. Không để planner chạy full-scan/overwrite mặc định khi coverage đã đủ.
4. Không trộn universe truth, coverage truth và execution state vào cùng một model.
5. Không để watchlist/tracked/holding/alert mutation gọi trực tiếp data crawl logic trong request path.
6. Không để user-facing screen tự quyết định crawl policy thay cho backend planner.

---

## 3. Required implementation style

- Symbol identity phải normalize uppercase tại boundary.
- Demand source phải explicit type + source ref + active flag.
- Coverage/freshness phải explicit, không suy đoán mơ hồ trong UI.
- Run outputs phải có counters cho `inserted`, `updated`, `skipped_existing`, `failed`.
- Operator-visible changes phải có audit trail.

---

## 4. Required review questions

- Source of truth ở change này là gì?
- Demand source mới có đi vào global registry không?
- Có tạo path recrawl riêng theo user không?
- Planner có chứng minh được `missing-only` semantics không?
- Read path có còn đi qua provider thay vì shared layer không?
