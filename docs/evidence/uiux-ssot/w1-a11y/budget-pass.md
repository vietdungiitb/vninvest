# W1-a11y — check-uiux-budget PASS

- **Lệnh**: `node packages/web/scripts/check-uiux-budget.mjs` (cwd worktree).
- **Kết quả**: exit 0 — **0 rule tăng so với baseline**, tổng giảm **102**.
- `A11Y-9`: baseline 5 → hiện tại **2** (giảm 3) — nhờ 3 guard-fix có control (`guard-fixes.md`).
- `CSS-2`: baseline 46 → hiện tại **0** (giảm 46) — reduced-motion toàn cục `index.css:804` được rule công nhận.
- `NAV-1`: 89 → 38 (giảm 51, từ các session trước — 12 file nặng đã dùng `useUrlState`, đã verify lại bằng grep).
- `A11Y-8`: 4 → 2 · các rule khác không tăng.
- **Không** chạy `--write-baseline`: script chỉ đề xuất; baseline giữ nguyên để tránh che regression.
- Các guard-fix là sửa false-positive có control âm/dương, **không** phải nâng baseline để xanh giả.
