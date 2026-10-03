# Tech Spec: Whale Advisory Command Center Architecture

## System Overview
The Whale Advisory Command Center is a high-performance, real-time intelligence system designed to detect and visualize institutional order flow anomalies. It follows a decoupled architecture where backend engines calculate intensity and discovery status, which are then broadcast via WebSockets to an "Agentic" frontend.

## 1. Backend Architecture

### 1.1 WhaleSignalEngine (SSOT)
- **Purpose**: Canonical source for all order flow calculations.
- **Logic**:
  - `Side Classification`: Uses tick-rule and volume delta to assign Buy/Sell/Internal status.
  - `Intensity Scoring`: Calculates anomaly intensity based on relative value and frequency benchmarks.

### 1.2 Market Discovery Pipeline
- **Task**: `tasks_whale_persist_phase.py`
- **Logic**: For every whale signal, the system checks if the symbol is a "Market Discovery Candidate" (Intensity >= 8.0 or unique order size).
- **Broadcast**: High-intensity signals are pushed to the `market_discovery` Redis group via Django Channels.

## 2. Frontend Architecture

### 2.1 Real-time Core
- **Context**: `RealtimeContext.jsx` manages the global discovery event stream.
- **Hook**: `useRealtimeFeedCore.js` handles WebSocket subscriptions and event normalization.

### 2.2 Agentic UI Components
- **Command Panel**: `WhaleAdvisoryCommandPanel.jsx` serves as the primary intelligence hub.
- **Thought Stream**: Employs a multi-phase reasoning UI to simulate AI analysis steps.
- **Bubble Chart**: `WhaleBubbleChart.jsx` renders intraday order flow timing and price delta using ECharts for visual ground-truth.

## 3. Data Contracts

### 3.1 Market Discovery Event (WS)
Client receives the JSON payload below from the WebSocket consumer. The internal Django Channels routing key `type="market_discovery_event"` is used server-side and is not part of the browser-visible payload.

```json
{
  "event_type": "market_discovery_event",
  "id": 1234,
  "symbol": "FPT",
  "side": "BUY",
  "whale_intensity": 92,
  "discovery_bucket": "anomaly",
  "ai_summary": "Institutional accumulation detected...",
  "ts": "2026-04-21T13:45:00Z"
}
```

Fields guaranteed by the current broadcast implementation:
- `event_type`: fixed discriminator used by frontend realtime handlers.
- `id`: advisory primary key.
- `symbol`: normalized ticker symbol.
- `side`: canonical advisory side.
- `whale_intensity`: integer 0-100 intensity score.
- `discovery_bucket`: one of `anomaly`, `potential`, `standard`.
- `ai_summary`: concise discovery summary for UI rendering.
- `ts`: ISO-8601 event timestamp.

### 3.2 Whale Orders API
- **Endpoint**: `/api/whale/orders/{symbol}/`
- **Output**: Intraday ticks normalized for bubble chart X (time) and Y (price_delta) coordinates.
