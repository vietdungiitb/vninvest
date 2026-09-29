# FRONTEND DESIGN — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Scope**: Chi tiết UX/UI, hierarchy, layout behavior, component-level acceptance criteria cho redesign dashboard

---

## 1. Design intent

Dashboard phải trả lời được 3 câu hỏi trong vòng vài giây đầu:

1. Danh mục/universe đang nóng ở đâu?
2. Cảnh báo nào cần chú ý ngay?
3. Tôi nên thao tác trên mã nào tiếp theo?

Mapping cho 3 câu hỏi này:

- `Heatmap` trả lời câu 1.
- `UnifiedAlertCenter` trả lời câu 2.
- `FactsFirstModularPositionDeck` trả lời câu 3.
- `AI Alerts / AI News` là lane phụ trợ chiến thuật, không được lấn át 3 lớp trên.

---

## 2. Information hierarchy

### Tier 1 — Immediate scan

- `SmartStatsHeader`
- `PortfolioHeatmap`
- `UnifiedAlertCenter`

### Tier 2 — Tactical interpretation

- `AIAdvisorAlertPanel`

### Tier 3 — Action workspace

- `FactsFirstModularPositionDeck`

### Remove from default route

- `StickyAlertBar`
- `ModernSidebar`

---

## 3. Workstation non-mobile wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ SmartStatsHeader + compact analytics chips                             │
├──────────────────────────────────────────────────────────────────────────┤
│ Unified Alert Center │ Portfolio Heatmap │ AI Panel                 │
│ severity + filters   │ treemap / sunburst│ alerts/news              │
│ 5–8 visible items    │ + tooltip         │ 5 items                  │
├──────────────────────────────────────────────────────────────────────────┤
│ FactsFirst Modular Position Deck                                        │
│ scope / symbol toolbar                                                   │
│ overview | technical | whale | AI tabs                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Kích thước đề xuất

- Left lane: 320–420px
- Center lane: 320–420px
- Right lane: 320–420px
- Gap giữa panel: 24px

## 3a. Classic non-mobile wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ SmartStatsHeader + compact analytics chips                             │
├──────────────────────────────────────────────────────────────────────────┤
│                    Portfolio Heatmap (full-width)                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Unified Alert Center                         │ AI Panel                 │
├──────────────────────────────────────────────────────────────────────────┤
│ FactsFirst Modular Position Deck                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Panel-by-panel design rules

### 4.1 Unified Alert Center

**Primary purpose:** surface event urgency.

**Must keep:**

- Title + hint text
- severity chips
- source/audience/severity filters
- pagination
- unread count / mark read / mute

**Must not do:**

- duplicate the same alert summary bar elsewhere in fold đầu
- exceed visual dominance of heatmap

**Acceptance rule:** at least 5 alert cards can be read without panel feeling cramped on desktop.

### 4.2 Portfolio Heatmap

**Primary purpose:** market scan and attention anchor.

**Must keep:**

- view mode toggle (treemap/sunburst if still used)
- size metric toggle nếu có
- tooltip and detail popover

**Must not do:**

- lose center position on desktop
- get smaller than side lanes
- be wrapped inside a noisy container with heavy text framing

**Acceptance rule:** user’s eye should land here first on desktop.

### 4.3 AIAdvisorAlertPanel

**Primary purpose:** interpretive lane, not event truth lane.

**Must keep:**

- `AI Alerts` / `AI News` tabs
- digest request path
- recommendations count badge

**May keep conditionally:**

- collapse/expand control nếu không làm panel mất cân bằng chiều cao top row

**Must not do:**

- show the same raw alert stream already visible in `UnifiedAlertCenter`
- become visually louder than alert lane or heatmap

### 4.4 FactsFirstModularPositionDeck

**Primary purpose:** action workspace.

**Must keep:**

- scope filter
- symbol filter
- overview / technical / whale / ai tabs
- empty state CTA `Mở Transactions`

**Must improve:**

- table readability nhờ thêm chiều ngang
- toolbar spacing
- perception that this is the main workspace below the overview triad

---

## 5. What gets removed and why

| Surface | Decision | Lý do |
|---|---|---|
| `StickyAlertBar` | Remove from default route | Trùng với alert center, làm top fold bị bể nhịp nhìn |
| `ModernSidebar` risk/cards | Remove from default route | Giá trị thấp hơn triad, chiếm chiều cao lớn |
| `ModernSidebar` live signal stream | Remove from default route | Duplicates alert feed domain |
| `renderBubble` top-fold placeholder | De-prioritize | Không nằm trong core information hierarchy của dashboard overview |

---

## 6. Header design rules

`SmartStatsHeader` vẫn tồn tại, nhưng phần analytics phụ phải ở dạng compact chips.

### Allowed compact metrics strip

- Alpha
- Beta
- Sharpe
- Max Drawdown

### Not allowed

- Thêm chart riêng dưới header
- Tạo thêm một hàng quá cao trong header làm đẩy triad xuống dưới fold đầu

---

## 7. Responsive design

### Tablet

```text
Header
Workstation: Alert Center | Heatmap | AI Panel
Classic: Heatmap
Classic: Alert Center | AI Panel
Deck (full-width)
```

### Mobile

```text
Header
Heatmap
Alert Center
AI Panel
Deck
```

### Mobile acceptance criteria

- Panel titles không bị wrap xấu.
- Filters vẫn dùng được bằng touch.
- Deck toolbar vẫn chạm được và không quá dày.

---

## 8. Empty / sparse states

### Empty holdings / empty filtered scope

FactsFirst deck empty state hiện tại là đúng hướng và phải được giữ:

- Title rõ ràng: `Không có mã trong phạm vi đã chọn`
- Help text hướng dẫn đổi scope/mã
- CTA `Mở Transactions`

### Empty alerts

`UnifiedAlertCenter` hiển thị “Chưa có cảnh báo” là đủ; không cần sticky bar thay thế.

### Empty AI digest/news

Cho phép panel hiển thị quiet state như hiện tại, nhưng giữ chiều cao ổn định để layout không nhảy.

---

## 9. Interaction notes

1. `Alert lane` và `AI lane` có internal scroll.
2. `Heatmap` interaction ưu tiên pointer + tooltip stability.
3. `Deck` là vùng chuyển từ scan sang action; không bị đặt ngang hàng với triad.
4. Không dùng animation nặng làm chậm first meaningful paint.

---

## 10. Visual acceptance checklist

- [ ] Heatmap nằm chính giữa desktop.
- [ ] Alert center và AI lane cân đối hai bên.
- [ ] Không còn sticky alert strip ở trên top triad.
- [ ] Không còn sidebar dài ở cột riêng.
- [ ] Deck full-width nhìn như workspace chính, không như panel phụ.
- [ ] Empty state của deck vẫn rõ và có CTA.
- [ ] Header không quá cao sau khi thêm compact metrics.

## 11. SaaS native frontend architecture rules

1. Visual redesign chỉ được xem là hoàn chỉnh khi cùng một hierarchy được phản ánh ở `PackageDashboardHost` / `DashboardPage`, không phải chỉ ở `ModernDashboard`.
2. `frontend/src` trong end-state chỉ giữ vai trò host bridge: routing, legacy contexts, i18n bridge, slot injection. Nó không phải nơi giữ canonical dashboard data plane dài hạn.
3. Mọi reusable page structure và contract mới của dashboard phải sống ở `packages/web/src/`.
4. Không được thêm feature UI/dữ liệu mới chỉ vào `ModernDashboard` rồi hứa “port sau”. Nếu chưa có parity ở package-host thì task chưa DONE.
5. `apiClient` hoặc direct fetch không được là giải pháp chuẩn cho dashboard end-state.
6. Nếu tạm giữ bridge legacy để rollout an toàn, phải document owner + expiry trong evidence.
