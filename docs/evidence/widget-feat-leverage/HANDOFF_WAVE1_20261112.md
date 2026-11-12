# HANDOFF — Wave 1 vninvestcharts-widget feature leverage (phiên kế tiếp)

> Ngày: 2026-11-12. Wave 0 DONE 6/6 (PR #342–#349). Phiên kế tiếp bắt đầu từ đây, KHÔNG cần đọc lại toàn bộ lịch sử — tài liệu này + `JOURNAL_20261112.md` là đủ.

## 1. Điểm bắt đầu

- **Base:** `origin/dev` @ `42e51ce2f` (merge PR #349). Tạo branch mới từ đây: `git checkout -b feat/widget-wg-<ten> origin/dev`.
- **Không cần re-verify Wave 0.** Đã merge + ledger Entry 457–462 + journal đầy đủ.
- **Worktree có 7 orphan untracked KHÔNG thuộc scope** (session khác / archive): `docs/PLAN_A4_ROADMAP_20261109.md`, `docs/PLAN_WIDGET_INTEGRATION_20261110.md`, `docs/WIDGET_EMBEDDING_PAIN_POINTS_20261112.md`, `docs/evidence/a4-roadmap/`, `docs/evidence/staging-pro-layout/21-fullbleed-test.png` + `facts32.json`. Trước mỗi `agent-sync`: `git stash push -u -m "..."`, xong `git stash pop`. (2 file staging-pro-layout thuộc claim `staging-pro-layout2` in-progress của session khác — KHÔNG commit, KHÔNG sửa `StockDetailPage.*`.)

## 2. Wave 1 scope (Owner đã chốt — không hỏi lại)

| Slice | Việc | Owner chốt | File chạm (dự kiến) |
|---|---|---|---|
| **W-G** | Đăng ký Whale Flow / Dark Flow / CVD VN thành indicator trong catalog widget (`registerIndicators`) | Đăng ký catalog (không giữ prop) | new `src/lib/widgetIndicators.js` + panel + test |
| **W-H** | Workspace serializer (layout save/share) | **localStorage first, KHÔNG BE/migration** | new component + test |
| **W-I** | Drawing persistence (localStorage adapter) | (chưa hỏi — mặc định localStorage) | panel + test |
| **W-J** | Drawing alerts → alert center (`onDrawingAlert`) | (chưa hỏi) | panel + alert adapter + test |
| **W-K** | Comparison overlays (`onComparisonChange`) | (chưa hỏi) | panel + test |

Quyết định đã persist: `docs/PLAN_WIDGET_FEATURE_LEVERAGE_20261112.md` §8. W-M (Wave 2) BLOCKED chờ BE corporate-actions endpoint (roadmap W5.3).

## 3. Bản đồ file:line (đọc trước khi code slice đầu)

- Kế hoạch: `docs/PLAN_WIDGET_FEATURE_LEVERAGE_20261112.md` (§2 capability, §3 slices, §8 Owner Q)
- Nhật ký đầy đủ: `docs/evidence/widget-feat-leverage/JOURNAL_20261112.md` (Entry 0/A–F-MERGE + closeout + OWNER-DECISIONS)
- Panel đích: `packages/web/src/components/VNStockChartPanel.js` (~480 dòng, props widget đã wire W-A..W-F)
- Mapper: `packages/web/src/utils/VNInvestSignalAdapter.js` (`mapAdvisorySessionToResult`, `mapTapeTradesToEntries`, `TAPE_WHALE_THRESHOLD_VND=5e9`)
- Adapter tape mẫu: `packages/web/src/adapters/core/market.js` (`getIntradayTape` — pattern để copy cho endpoint mới nếu cần)
- Hook telemetry mẫu: `packages/web/src/hooks/useTrustTelemetry.js` (`trackWidgetEvent`)
- Tests: `packages/web/src/components/__tests__/vnstock-chart-panel.data-unlock.component.test.ts` (S1–S18 source-scan) + `packages/web/src/utils/__tests__/vninvest-signal-adapter.{advisory,tape}.component.test.ts`
- Widget contract: `packages/web/node_modules/@vninvestcharts/widget/dist/dts/` (`widget/VNInvestChartsProps.d.ts`, `lib/types/vninvest.d.ts`, `widget/utils/telemetry.d.ts`) — đọc dts, KHÔNG trích số dòng dist minify (minify 1 dòng, ref vô nghĩa)
- Registry/ledger: `docs/CLAIMS.md` (cuối file), `docs/CODE_CHANGE_AUDIT_LEDGER.md` (đầu file, next entry = `node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry`)

## 4. Bẫy môi trường (trả giá thật ở Wave 0 — đừng lặp lại)

1. **Không có `pwsh`** — chỉ `powershell` 5.1. `scripts/agent-sync.ps1` chạy tay từng bước; nó exit 1 ở cuối do gọi nội bộ `pwsh` (sau khi đã xong fetch/rebase/gates/build). Chạy bù bằng tay: `check_opencore_doc_sync.ps1` + `check_large_files.ps1` (FAIL pre-existing toàn repo — chỉ cảnh báo; file slice đều nhỏ).
2. **`Set-Content -Encoding utf8` thêm BOM** → gate `check-ledger-entry` miss header dòng 1 (`^## Entry`). Dùng `edit` tool cho ledger/claims; nếu lỡ dùng PowerShell, strip BOM ngay (`node -e` slice `0xFEFF`).
3. **Verify merge parent sau `gh pr merge`**: `git log <merge>^2 --oneline` phải chứa đủ commit local. PR #341 từng merge thiếu 2 commit chưa push.
4. **Full vitest 181 file timeout >15p** — chạy subset (`src/utils` + panel test + `src/features/stock-detail` + hooks liên quan), ghi CHƯA CHẠY trung thực.
5. **Test source-scan KHÔNG bắt TDZ runtime** — W-C crash thật trong khi 15 tests + tsc đều xanh; B8 đọc độc lập là tuyến phòng thủ duy nhất cho lỗi này. Mọi `useState` mới phải khai trước effect dùng nó.
6. **Claim row sửa bằng node script** (tránh lệch encoding khi edit có dấu); kiểm tra `git diff` row không bị nhân đôi `in-progress/done`.

## 5. Checklist slice tiếp theo (vòng kín rút gọn — chi tiết xem skill workflow-dev-loop)

1. Đọc skill `project-lessons` (tags từ task) → ghi `Lessons áp dụng` vào claim.
2. Journal Entry plan + verify file:line (dts/BE, không đoán).
3. B3 audit độc lập (subagent read-only) → PASS/NEED_REVISION → sửa journal.
4. Khai claim `in-progress` + commit riêng trước dòng code đầu.
5. TDD fail-before (test đỏ) → code → xanh (vitest slice + tsc + build + eslint).
6. B8 re-audit độc lập → fix blocker (nếu có) → verify lại.
7. Ledger Entry mới + claim done + journal kết quả → commit.
8. Stash orphans → agent-sync → manual gates → pop → push → PR (body: scope + gates chạy thật + CHƯA CHẠY) → merge → verify parent.
9. Journal Entry MERGE (PR#, merge commit, giờ UTC) rồi mới sang slice kế.

## 6. Gates baseline Wave 0 (để so sánh hồi quy)

- vitest slice 15–28 tests + subset 64–123 tests PASS · tsc exit 0 · build 19–33s · eslint 0 errors (4 warnings có sẵn: React unused, enableInstitutionalStrength, VNInvestMultiCharts, whaleTimes) · check-multi-agent PASS · check-ledger-entry PASS (74/74/max=462 sau Wave 0).
- CHƯA CHẠY xuyên suốt: full vitest, E2E staging Pro (cần key/VPS + SSH `docker.edusuccess.vn`), BE pytest (cần Postgres + `CORE_DATABASE_URL`).

## 7. Nợ kỹ thuật / việc dở (ngoài scope Wave 1)

- Smoke E2E staging Pro gộp 1 phiên: dock tabs advisory/tape, boundary/empty copy, measurement, CVD histogram, upgrade nudge (Entry W-F-MERGE đã ghi).
- Tab advisory riêng trên StockDetailTabs vẫn song song với dock panel (Owner chốt giữ cả hai; gỡ sau `staging-pro-layout2`).
- `staging-pro-layout2` (full-bleed StockDetailPage) claim in-progress session khác — không đụng.
- `whaleThreshold` overlay + `zoomSpeed/maxVisibleBars/historyMinResidentBars` chưa wire (W-E cắt no-guess — cần bằng chứng unit trước).
