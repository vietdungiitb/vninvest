# Audit kế hoạch F8 — vòng 1

**Verdict: NEED_REVISION** — 2 objection.

| # | Mức | Objection |
|---|---|---|
| O1 | P0 | `adj_close IS NOT NULL` quá rộng: sau Anchor A/ingest có 2 basis (`anchor_provider` vs `self_computed`, `anchor_a_relabel.py:64`, `tasks.py:718`) ⇒ nightly CafeF rebase/drift trộn basis ⇒ `mixed_basis_symbol` (`integrity.py:109-110`) |
| O2 | P0 | Sót `cafef/fallback.py:76,78` vẫn query `price_source='cafef'`; guard `cafef_rows_present` (`tasks.py:3612,3640`) mất tác dụng sau relabel |

## Hướng sửa v2
- Predicate: `Q(price_source='cafef') | Q(adj_basis='anchor_provider')` (tương thích dòng cũ + anchor mới), **không** quét `self_computed`.
- Scope thêm `market_data/cafef/fallback.py`, guard đổi theo predicate tương tự.
- Giữ `order_by()` trước `distinct()`.
