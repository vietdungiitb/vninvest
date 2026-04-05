# DASHBOARD_CODE_AUDIT.md
*Ngày tạo: $(date)*

## 1. Tổng quan kiến trúc code
Dashboard (`frontend/src/pages/Dashboard.jsx`) là trung tâm kiểm soát danh mục, tích hợp:
- Stat Cards (`StatCard.jsx`): 4 metrics chính (Market Value, Unrealized/Realized P/L, Dividends)
- Realtime Panel (`DashboardRealtimePanel.jsx`): Radar giá realtime, whale alerts, observability
- Charts: EquityVsBenchmark + AllocationPie
- Holdings Table (`HoldingsTable.jsx`): Chi tiết vị thế
- Manual Sync button

**Data flow**: API Snapshot → StatCards/Holdings (tĩnh) | WS+Polling → RealtimePanel (động)

## 2. Ưu điểm
| Điểm mạnh | Code evidence | Giá trị |
|-----------|---------------|---------|
| Realtime solid | `useRealtimeFeed` + polling fallback, realtime P/L calc | Trading-ready foundation |
| UX professional | Color P/L, whale emojis 🦈🐋, live delta | Market pulse instant grasp |
| Robust | Loading/empty/stale states, safe formatting | No UI crashes |
| i18n ready | Full `useI18n` coverage | International scale |

## 3. Nhược điểm Critical
| Vấn đề | Code issue | Impact | Priority |
|--------|------------|--------|----------|
| **Data fragmentation** | Snapshot vs live quotes riêng biệt | User confusion: 2 Market Value khác nhau | 🚨 P1 |
| **HoldingsTable static** | No livePrice overlay | Wasted realtime, frozen P/L | 🚨 P1 |
| **Observability clutter** | Dev metrics prime space | UI noise cho trader | ⚠️ P2 |
| **Redundant sync** | Button luôn show dù WS live | UX backward | ⚠️ P2 |
| No whale overlay | Alerts isolated | Missed hold context | ⚠️ P3 |

## 4. Tư vấn cải thiện
### P1: Single Data Source (1-2 days)
```
Dashboard.jsx hoist useRealtimeFeed → pass quotesBySymbol xuống
StatCards + HoldingsTable: liveMarketValue + live P/L
Flash effect green/red trên P/L changes
```

### P2: UX Polish (1 day)
```
Observability → status icon + popover
Sync button: hide khi 'live'
Whale badges trên Holdings rows (5min cooldown)
```

### P3: Advanced
```
Global RealtimeContext
Pull-to-refresh mobile
Voice alerts extreme events
```

**Benchmark**: 70% TradingView level. P1 fix → 90%+.

**Verify**: Test với 3-5 traders confirm data confusion #1 pain.

*(Audit từ BLACKBOXAI analysis của Dashboard.jsx + components + docs/DASHBOARD_FRONTEND_AUDIT.md)*