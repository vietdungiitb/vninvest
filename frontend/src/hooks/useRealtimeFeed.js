import { useRealtimeFeedFromManager } from '../context/RealtimeContext';

const EMPTY_FEED = {
  quotesBySymbol: {},
  realtimeStatus: 'idle',
  lastEventAt: null,
  alerts: [],
  darkFlowAlerts: [],
  latestWhaleAlert: null,
  latestDarkFlowAlert: null,
  metrics: {
    eventCounts: {},
    lastLatencyMs: null,
    connectionState: { transport: 'idle' },
  },
};

export default function useRealtimeFeed({ symbols, pollInterval = 15000, maxAlerts = 5 }) {
  const managedFeed = useRealtimeFeedFromManager({ symbols, pollInterval, maxAlerts });
  return managedFeed || EMPTY_FEED;
}
