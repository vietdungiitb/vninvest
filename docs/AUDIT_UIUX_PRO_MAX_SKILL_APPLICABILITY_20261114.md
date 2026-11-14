# AUDIT — Khả năng áp dụng skill `ui-ux-pro-max` cho repo vninvest

- **Scope**: Nghiên cứu repo ngoài `nextlevelbuilder/ui-ux-pro-max-skill` (v2.15.0, MIT) và đối chiếu với hiện trạng design/UI tooling của `packages/web` + quy trình multi-agent của vninvest. **0 dòng source code thay đổi** (docs-only).
- **Date**: 2026-11-14.
- **Nguồn skill**: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill — 149.1k stars / 15.8k forks, license MIT (README header). Đã đọc README.md, `skill.json`, template OpenCode `src/ui-ux-pro-max/templates/platforms/opencode.json` (raw, main).
- **Nguồn vninvest đã đọc thật**: `packages/web/package.json`, `packages/web/scripts/check-tokens.mjs`, `packages/web/scripts/check-contrast.mjs`, glob `packages/web/scripts/check-*.mjs`, glob `.opencode/**/SKILL.md`, glob `docs/audit-uiux/**`, AGENTS.md.

---

## TÓM TẮT NGẮN — 5 findings quan trọng nhất

1. **F1 (RISK-CAO)** — Output design-system của skill (palette/typography mới mỗi request) **xung đột trực tiếp** với token system đã khoá của vninvest: `check-tokens.mjs:2-4` fail mọi hex ngoài `:root`/allowlist (`:10-29`). Nếu agent nghe theo màu/font do skill đề xuất → gate đỏ ngay hoặc (tệ hơn) nới allowlist làm thiết kế trôi dần. **Bắt buộc** routing rule: skill chỉ tra cứu layout/pattern/UX/chart; màu/font luôn lấy từ `soc.tokens.css`.
2. **F2 (RISK-TRUNG)** — Cài cho OpenCode ghi file vào **`.opencode/skills/ui-ux-pro-max/`** (xác nhận từ `templates/platforms/opencode.json`: `"root": ".opencode"`, `"skillPath": "skills/ui-ux-pro-max"`) — đây là hạ tầng skill dùng chung của repo, hiện chỉ có 3 skill tự viết (`workflow-dev-loop`, `multi-agent-workflow`, `project-lessons`). Cần Owner quyết định + claim trước, và description của skill rất rộng ("designing, building, reviewing, or fixing interfaces…") nên nó **auto-activate trên gần như mọi task UI** → tốn context mỗi phiên.
3. **F3 (VALUE-TRUNG)** — Giá trị thật của skill cho vninvest nằm ở **3 vùng**: (a) landing/marketing page mới (greenfield), (b) tra cứu 120 UX guidelines offline (chip overflow, badge reflow, focus state…), (c) 25 chart-type recommendations cho dashboard finance. Nó là **database tra cứu BM25 chạy Python stdlib, không gọi mạng** (README Prerequisites) — không tự sửa code ("Search results provide design guidance; they do not automatically rewrite your app" — README).
4. **F4 (CONTRADICTION-SSOT)** — Persist pattern `design-system/<project>/MASTER.md` của skill sẽ tạo **SSOT thiết kế thứ hai** song song với `soc.tokens.css` + `soc.components.css` (SSOT đã có + đã được gate cơ học). Nếu dùng persist thì MASTER.md phải hand-author mã hoá SOC, không để skill sinh tự do.
5. **F5 (RISK-THẤP)** — Chi phí vận hành nhỏ: cần Python 3.x trên PATH (README Prerequisites; backend Django của repo là Python nên env dev có sẵn), `npm install -g` phải hỏi Owner theo AGENTS.md ("Không chạy npm install/pip install khi chưa hỏi"), khuyến nghị chạy `uipro init --ai opencode --dry-run` để xem nó ghi gì trước khi cài thật.

**Kết luận tổng thể**: ÁP DỤNG ĐƯỢC, nhưng theo vai trò **"thư viện tra cứu tham khảo"** — KHÔNG phải "design brain thay thế". Khuyến nghị lộ trình 3 bước: trial ngoài repo (không ghi file repo) → Owner chốt routing rule → cài chính thức có claim. Chi tiết §G.

---

## 0. NGUYÊN TẮC đã tuân thủ

1. Mọi khẳng định kèm nguồn (`file:line` hoặc URL raw GitHub cụ thể).
2. Chưa đọc/verify → ghi rõ "CHƯA XÁC MINH".
3. File tồn tại đã được glob/read xác nhận (không suy đoán).
4. Báo cáo tiếng Việt.

## A. BẢN ĐỒ KIẾN TRÚC CỦA SKILL (những gì nó là)

| Thành phần | Nội dung | Bằng chứng |
|---|---|---|
| Catalog dữ liệu | 80 UI styles (51 active, gồm Glassmorphism), 192 palettes + reasoning profiles, 74 font pairings, 25 chart types, 22 tech stacks, 120 UX guidelines, 105 icons, 17 GSAP presets | `skill.json` description; README §Features |
| Search engine | BM25, Python 3.x stdlib-only, **không cài gì, không gọi mạng** | README Prerequisites: *"the scripts install nothing and make no network calls"* |
| Design System Generator | Input prompt → output Pattern + Style + Colors + Typography + Effects + Anti-patterns + Pre-delivery checklist (ASCII/markdown/json) | README §v2.0 |
| Reasoning rules | 192 rule theo ngành (Fintech/Crypto, Banking, Insurance, Personal Finance Tracker… — có category **Finance** khớp domain vninvest) | README §192 Industry-Specific Reasoning Rules |
| Persist pattern | `design-system/<slug>/MASTER.md` + `pages/<page>.md` (page override master) | README §Persist Design System |
| Cài đặt OpenCode | `npx ui-ux-pro-max-cli init --ai opencode` → ghi vào `.opencode/skills/ui-ux-pro-max/` (SKILL.md + scripts + data) | `templates/platforms/opencode.json` (raw main): `"root": ".opencode"`, `"skillPath": "skills/ui-ux-pro-max"`, `"scriptPath": "skills/ui-ux-pro-max/scripts/search.py"` |
| An toàn nội dung | Read-only advisory: *"Search results provide design guidance; they do not automatically rewrite your app."* | README §Apply a theme to an existing app |
| Checklist giao hàng | Không emoji làm icon (SVG Heroicons/Lucide) · cursor-pointer · contrast 4.5:1 light · focus states · prefers-reduced-motion · text/chip reflow · responsive 375/768/1024/1440 | README ASCII output block |

## B. LUỒNG HOẠT ĐỘNG KHI AGENT DÙNG SKILL

1. User yêu cầu task UI → SKILL.md auto-activate (opencode load từ `.opencode/skills/`).
2. Agent chạy `python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "<prompt>" --design-system` (hoặc `--domain style|typography|ux|chart|icons`, `--stack react`) → BM25 ranking trên CSV cục bộ → output design system.
3. Agent tự đọc output và viết code theo; **skill không đụng code**.
4. (Tuỳ chọn) `--persist` ghi `design-system/<slug>/MASTER.md` + page overrides vào repo làm SSOT cho phiên sau.

## C. ĐỐI CHIẾU NĂNG LỰC SKILL ↔ HIỆN TRẠNG VNINVEST (file:line)

| Năng lực skill | Hiện trạng vninvest | Đánh giá |
|---|---|---|
| Stack React + shadcn/ui | `packages/web/package.json:97` react ^19.2.7; `:51-70` Radix primitives; `:78-79` CVA + clsx; `:105-106` tailwind-merge/tailwind-sidebar; `:144` tailwindcss ^4.0.0, `:117` @tailwindcss/vite | **Khớp gần hoàn toàn** (Radix+CVA là nền của shadcn/ui). Lưu ý: phải chỉ định `--stack react`, default là `html-tailwind` (README §Supported Stacks). Tailwind **v4** — mức độ phủ của skill cho Tailwind 4: CHƯA XÁC MINH (cần probe khi trial). |
| Chart recommendations | `package.json:91-94` echarts/klinecharts/lightweight-charts; `:107-108` `@vninvestcharts/widget(.pro)` | Bổ sung tham khảo cho dashboard; **không thay** widget component (ranh giới widget/adapter phải theo nguyên tắc 4 AGENTS.md) |
| Glassmorphism trong 51 active styles | Design system SOC glassmorphism đã chốt (AGENTS.md Constraints; `packages/web/src/components/soc/soc.tokens.css` + `soc.components.css` tồn tại — glob xác nhận) | Khớp về style; nhưng **màu/tokens do repo quyết**, không nhận từ skill |
| Pre-delivery checklist (contrast, focus, reduced-motion, reflow, responsive) | Đã có **gate cơ học** cứng: `check:contrast` (`check-contrast.mjs:2-5`, WCAG 4.5:1 cả 2 mode), `check:focus-ring`, `check:dom-landmarks`, `check:a11y-runtime`, `check:heading-contract`, `check:light-theme`, `check:theme-contrast`, `check:uiux-budget` (glob `packages/web/scripts/check-*.mjs`) | Checklist của skill = lời nhắc phía prompt; **gate cơ học của repo luôn thắng** khi mâu thuẫn |
| 120 UX guidelines (chip/badge overflow, IME-safe Enter…) | i18n tiếng Việt full dấu (AGENTS.md); có chương trình audit UI/UX chạy 15 wave (`docs/audit-uiux/UIUX_AUDIT_20261007.md`, handoff Wave 3–15 — glob) | Tra cứu hữu ích cho text-reflow tiếng Việt có dấu + chip/badge; bổ trợ cho audit wave, không thay |
| Design System Generator (palette mới theo ngành) | Token system khoá + allowlist hex (`check-tokens.mjs:2-4, :10-29`) | **Xung đột** — xem F1 |
| Persist MASTER.md | SSOT đã có (`soc.tokens.css`) + Q-01 bài học "deny-list NHÂN BẢN 7 nơi, không có nguồn duy nhất" (AGENTS.md Progress) | **Rủi ro SSOT kép** — xem F4 |

## D. FINDINGS

| ID | Loại | Mức | Bằng chứng | Tác động | Đề xuất |
|---|---|---|---|---|---|
| F1 | RISK | CAO | Skill sinh palette/typography mới mỗi request (README §v2.0); `check-tokens.mjs:2-4` fail hex ngoài allowlist `:10-29`; allowlist đã ghi chú *"V1 drift (will converge)"* `:19` — bài học trôi thiết kế cũ | Agent theo màu skill → gate đỏ, hoặc nới allowlist → thiết kế trôi dần, rà lại tốn kém | Routing rule bắt buộc: skill chỉ dùng cho layout/pattern/UX/chart; mọi color/typography từ `soc.tokens.css`. Ghi vào hướng dẫn dùng skill khi cài |
| F2 | RISK | TRUNG | `templates/platforms/opencode.json`: root `.opencode`, skillPath `skills/ui-ux-pro-max`; `.opencode/skills/` hiện 3 skill tự viết (glob); AGENTS.md: opencode chỉ auto-load `.opencode/skills/` | Chạm hạ tầng dùng chung → phải claim + Owner chốt; description auto-activate rộng → tốn context mọi phiên UI | `--dry-run` trước; cài có claim; cân nhắc trim description để thu hẹp trigger |
| F3 | GAP | TRUNG | Skill global đã có: `impeccable` (UI/UX design/redesign/audit/polish), `theme-factory`, `canvas-design`, `archify` (danh mục available_skills) | 2 skill cùng auto-activate cho task UI → nhiễu routing, kết luận trùng lặp | Phân vai: `ui-ux-pro-max` = tra cứu catalog offline; `impeccable` = quy trình polish/audit. Ghi 1 dòng routing khi cài |
| F4 | CONTRADICTION | TRUNG | README §Persist (MASTER.md = "Global Source of Truth") vs `soc.tokens.css` là SSOT đã có + gate | SSOT thiết kế thứ hai = đúng kiểu lỗi "deny-list nhân bản 7 nơi" đã trả giá (AGENTS.md Q-01) | Không dùng `--persist` tự do; nếu cần, hand-author `design-system/vninvest/MASTER.md` mã hoá SOC (một lần, có claim) |
| F5 | RISK | THẤP | README Prerequisites (Python 3.x); AGENTS.md "Không chạy npm install/pip install khi chưa hỏi"; README Troubleshooting (`--dry-run`, `--offline`) | Env agent thiếu Python → search.py không chạy; npm global install là thay đổi môi trường | Hỏi Owner trước khi cài; dry-run xem danh sách file; scripts stdlib-only + MIT + 149k stars → supply-chain risk thấp nhưng vẫn dry-run |

## E. ĐỐI CHIẾU CHECKLIST SKILL ↔ GATE CƠ HỌC SẴN CÓ

| Mục checklist skill | Gate vninvest tương ứng | Trạng thái |
|---|---|---|
| Contrast 4.5:1 | `check-contrast.mjs:23` MIN=4.5 (cả 2 mode) + `check-theme-contrast.mjs`, `check-portfolio-contrast.mjs` | Đã cứng hơn skill (cả dark+light) |
| Focus states | `check-focus-ring.mjs` | Đã có |
| Text/chip/badge reflow | `check-heading-contract.mjs`, `check-dom-landmarks.mjs`; wave audit `docs/audit-uiux/` | Đã có chương trình kiểm |
| No emoji icons (Heroicons/Lucide) | `package.json:52,96` đã dùng @heroicons + lucide-react | Đã khớp |
| Responsive 375/768/1024/1440 | `test:visual` Playwright (`package.json:26`) | Đã có (baseline snapshot) |
| prefers-reduced-motion | Không thấy gate cơ học riêng — **CHƯA XÁC MINH** | Có thể là khoảng trống skill bổ trợ khi code-review |

→ Kết luận: checklist skill gần như trùng mục tiêu với gate repo; giá trị của nó là **lời nhắc sớm phía prompt**, còn ràng buộc cuối cùng vẫn là gate cơ học (gate thắng skill).

## F. CÂU HỎI CẦN OWNER LÀM RÕ (chặn trước khi cài)

1. Có cho phép cài skill thứ ba vào `.opencode/skills/` (hạ tầng dùng chung) không? Cài ở repo-level hay để agent tự dùng bản ngoài repo?
2. Đối tượng dùng: agent FE (nhiều agent song song) hay chỉ phiên PM-proxy solo (Entry 483–486 cho thấy PM-proxy toàn quyền)?
3. Chốt routing rule: "ui-ux-pro-max chỉ tra cứu; color/typography luôn từ `soc.tokens.css`" — chấp nhận ghi vào hướng dẫn dùng skill?
4. Có cần `design-system/vninvest/MASTER.md` (hand-authored) không, hay bỏ hẳn persist pattern để tránh SSOT kép?

## G. ĐÁNH GIÁ TỔNG THỂ + LỘ TRÌNH ÁP DỤNG

**Đánh giá**: implementable — không blocker kỹ thuật; rủi ro chính là **quy trình** (F1–F4), không phải code. Năng lực cốt lõi của skill (catalog offline + BM25 + reasoning fintech) là thật và có domain khớp; nhưng vninvest đã có: design system khoá + 11+ gate UI cơ học + chương trình audit UI/UX 15 wave + skill `impeccable` toàn cầu. ⇒ Giá trị cộng thêm là **trung bình, tập trung ở UI greenfield** (landing/marketing, trang commercial mới), thấp ở SOC tab daily work (design language đã chốt).

**Lộ trình khuyến nghị (3 bước, có điểm dừng)**:

- **Bước 1 — Trial ngoài repo (không ghi file repo, không cần claim)**: trong thư mục tạm (vd. `C:\Users\vietd\AppData\Local\Temp\opencode\uupm-trial`), `npx ui-ux-pro-max-cli init --ai opencode` rồi chạy `python3 .opencode/skills/ui-ux-pro-max/scripts/search.py "fintech stock trading dashboard" --design-system -f markdown` + vài query thật của vninvest (landing VNInvest, dashboard whale, form onboarding tenant). Đánh giá chất lượng output + độ phủ Tailwind 4. **Cửa dừng**: output không đáng tin → bỏ, chi phí chỉ ~30 phút.
- **Bước 2 — Owner chốt** 4 câu hỏi §F, đặc biệt F1 (routing rule) và F2 (cho phép cài).
- **Bước 3 — Cài chính thức (nếu chốt)**: khai claim `docs/CLAIMS.md` → `npx ui-ux-pro-max-cli init --ai opencode --dry-run` (xem file ghi gì) → cài thật vào `.opencode/skills/ui-ux-pro-max/` → thêm 1 đoạn hướng dẫn routing (chỉ tra cứu; color từ soc.tokens; gate cơ học thắng) → commit PR như doc/tooling slice. **Không dùng `--persist` tự do** (F4).

**Kiểm chứng để thêm/chạy sau khi áp dụng (tests/validation)**:
1. Gate không đổi: `npx tsc --noEmit`, `npm run check:shell` (chuỗi gates `package.json:12`) phải xanh như baseline — skill chỉ là tư liệu, không được làm lệch gate.
2. Số hoá chi phí context: đo token của SKILL.md + description trước/sau cài (1 lần, ghi vào evidence).
3. Sau 2 tuần dùng: đếm số lần tra cứu + số PR UI có dùng; **tiêu chí giữ lại**: ≥1 slice UI greenfield dùng output của skill và `check:tokens`/`check:contrast` vẫn xanh 0 fail; nếu 0 lần dùng → `uipro uninstall`.

**Next steps / Owner**: Owner trả lời §F → quyết định Bước 2 → nếu yes, giao 1 agent thực hiện Bước 3 theo workflow-dev-loop (claim + gate). Người soạn báo cáo này chỉ nghiên cứu, không tự cài (F2 — hạ tầng dùng chung).

## H. PLAYBOOK DÙNG HIỆU QUẢ NHẤT (đã kiểm chứng bằng trial thật)

**Trial đã chạy 2026-11-14** trong thư mục tạm `C:\Users\vietd\AppData\Local\Temp\opencode\uupm-trial` (ngoài repo, không đụng node_modules): `npx --yes ui-ux-pro-max-cli init --ai opencode` → cài thành công; `python` 3.13.14 chạy `search.py` OK (Windows dùng `python`, không có `python3`).

**Sự thật cài đặt mới phát hiện — installer ghi 7 skill, không phải 1** (172 file, ~4.2 MB): `ui-ux-pro-max` (27.4 KB SKILL.md) + 6 skill kèm theo `banner-design` (8.1 KB) · `brand` (2.9 KB) · `design` (12 KB, nhắc "Gemini AI" logo — phụ thuộc tool ngoài repo không có) · `design-system` (6.7 KB) · `slides` (1.1 KB) · `ui-styling` (9.8 KB, shadcn/Radix — trùng vai skill global `impeccable`). Mỗi skill đều auto-activate theo description riêng → 6 skill thừa = 6 nguồn nhiễu context. Data/scripts của skill chính nằm gọn trong `skills/ui-ux-pro-max/data|scripts` (cấu trúc thư mục đã xem) ⇒ xoá 6 skill thừa không phá skill chính.

### H.1 Công thức lệnh chuẩn (copy-paste cho agent)

```bash
# Windows: python (không phải python3). Luôn --stack react (default html-tailwind là SAI stack cho vninvest)
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<truy vấn ngắn, đúng triệu chứng>" --domain <ux|chart|style|icons> --stack react -n 3
# --design-system CHỈ khi tạo trang/mặt mới (greenfield); output thường cắt field ở 300 ký tự → thêm --json khi cần đủ
```

### H.2 Ba chạm duy nhất (mỗi chạm đã verify output thật)

| Chạm | Khi nào | Lệnh | Lấy gì / bỏ gì |
|---|---|---|---|
| **1. Pattern greenfield** | Trang/mặt UI mới (landing, trang commercial mới) | `--design-system -f markdown -p "<tên>"` 1 lần | **Lấy**: Pattern (cấu trúc sections, vị trí CTA), Avoid (anti-patterns), Pre-Delivery Checklist. **Bỏ**: Colors + Typography (xem ngoại lệ bên dưới). Code theo `soc.tokens.css` |
| **2. Tra cứu UX chi tiết** | Sửa/đánh giá UI, code review, seed cho `docs/audit-uiux` wave tiếp theo | `--domain ux "<triệu chứng>"` | Lấy toàn bộ: Do/Don't + Severity (verify: query "badge chip label wraps to second line" → 3 rule sát thực tế, High/Medium) |
| **3. Chọn chart** | Dashboard/analytics mới | `--domain chart "<loại dữ liệu>"` | Lấy: Best/Secondary chart type + **A11y fallback** + ngưỡng dữ liệu. Verify: query "candlestick price time series" → khuyên **Lightweight Charts (TradingView)** — đúng thư viện repo đã dùng (`package.json:94`), kèm "Max 500 candles", Canvas realtime, "bullish/bearish không phụ thuộc màu một mình" — khớp gate `check-contrast` của repo |

**Ngoại lệ màu (ghi rõ để khỏi nhầm)**: query "fintech stock trading dashboard" trả palette **trùng hệt allowlist sẵn có** của repo (#0F172A, #1E293B, #020617, #334155, #94A3B8 ở `check-tokens.mjs:18`; #22C55E ở `:28`) — vì cả hai đều root từ Tailwind slate/emerald. Đây là trùng hợp tốt, **không phải quy luật**: vẫn phải đối chiếu từng hex với allowlist, không lấy màu từ output trừ khi hex đã nằm trong allowlist. Typography (Fira Code/Fira Sans) không dùng.

### H.3 Những chỗ KHÔNG dùng (lãng phí)

1. Retheme trang cũ — `impeccable` + wave audits (`docs/audit-uiux/`) lo việc đó rồi.
2. Hỏi nó màu/font để "tham khảo thêm" — với thiết kế đã khoá đây là nguồn drift (F1).
3. SOC tab daily work — design language chốt rồi, `--design-system` chỉ thêm nhiễu.
4. Dùng output làm tài liệu lưu repo (`--persist`) — SSOT kép (F4). Nếu cần rationale, paste Pattern vào PR description rồi bỏ.
5. Cài nguyên bộ 7 skill — xoá 6 skill thừa, chỉ giữ `ui-ux-pro-max` (giảm nhiễu trigger + ~40 KB SKILL.md thừa trong list).

### H.4 Chi phí context (đo thật khi trial)

- Khi auto-activate: SKILL.md chính 27.4 KB (~6–7k tokens). 6 skill kèm theo chỉ tốn description trong danh sách skill (~150–200 tokens/cái) — xoá bớt là giảm ngay.
- Disk: 172 file / 4.2 MB cho nguyên bộ; chỉ giữ 1 skill thì ít hơn đáng kể (CHƯA đo chính xác sau khi xoá).

### H.5 Tiêu chí "hiệu quả" sau 2 tuần (giữ/thả)

- **Giữ**: ≥1 slice UI greenfield dùng Pattern/chart-rec từ skill + `check:tokens`/`check:contrast` vẫn xanh; hoặc ≥3 rule UX từ `--domain ux` được tham chiếu trong PR/wave audit.
- **Thả** (`uipro uninstall`): 0 lần dùng, hoặc agent lặp đi lặp lại xin màu/font dù có routing rule.

## I. CẬP NHẬT 2026-11-14 (cùng ngày) — Owner chọn phương án tự thay vì cài catalog ngoài

Kết quả đối thoại sau §H: Owner thấy cách cài catalog ngoài còn "mông lung" → chốt hướng **tự viết skill repo** dựa trên (a) bằng chứng §H và (b) codebase thật. Đã thực hiện:

- **Skill mới: `.opencode/skills/soc-uiux/SKILL.md`** — bản đồ UI/UX của vninvest: SSOT + 6 luật cứng (§1), bản đồ **12 gate** đã đọc header thật (§2), playbook 3 chạm không phụ thuộc catalog ngoài (§3), checklist pre-delivery ánh xạ lệnh (§4), anti-patterns từ `docs/LESSONS/` (L-F03/F05/F06/F08/F11/F12 — §6). Tất cả citation đã kiểm đúng file/dòng (L-T02). OpenCode **tự nhận skill ngay** sau khi ghi file (không cần restart — xác nhận qua danh sách skill của session).
- **Hạ cấp vai trò `ui-ux-pro-max`**: từ "phương án cài" xuống **catalog tuỳ chọn §5** của skill soc-uiux — chỉ dùng khi Owner cài; không cài vẫn đủ làm việc UI/UX.
- **Các risk F1–F4 được giải quyết bằng cấu trúc**: routing rule + SSOT duy nhất (`soc.tokens.css`) + không persist + không phụ thuộc Python/npm ngoài + không chạm hạ tầng third-party. Chi phí context: ~5 KB SKILL.md (so 27.4 KB của ui-ux-pro-max), chỉ activate cho task UI/UX.
- **Còn lại**: Owner review skill → commit trên branch `feat/soc-uiux-skill` + PR (claim `soc-uiux-skill` đã khai trước khi viết dòng đầu tiên — L-002). Nếu vẫn muốn catalog ngoài, quyết định §F.1–F.4 vẫn cần trả lời; nếu không, 4 câu hỏi đó tự động hết nghĩa vụ.
- **Kịch bản thử nghiệm**: `docs/PLAN_SOC_UIUX_SKILL_TRIAL_20261114.md` (portfolio workspace, ~2.5k dòng, 11 AC ánh xạ gate) — slice refactor đủ lớn để đo hiệu quả skill theo §5 của plan; claim gợi ý `soc-uiux-trial`, branch `feat/soc-uiux-trial`.

**Hạn chế của báo cáo (trung thực)**: (a) search.py **đã chạy thật** 4 query trong thư mục tạm (§H) — quality output đã verify ở 4 điểm; (b) mức độ phủ Tailwind 4 của stack guidance vẫn **CHƯA XÁC MINH** (chưa probe riêng); (c) đã quét cấu trúc SKILL.md (headers) nhưng chưa đọc từng dòng nội dung 27.4 KB; (d) khuyến nghị xoá 6 skill thừa dựa trên cấu trúc thư mục đã xem, chưa thử xoá thật; (e) skill soc-uiux chưa qua review độc lập (B8/subagent) — Owner nên cho 1 agent khác đọc lại trước khi merge.


