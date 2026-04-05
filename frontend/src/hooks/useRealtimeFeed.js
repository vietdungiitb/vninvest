import { useRealtimeFeedFromManager } from '../context/RealtimeContext';
import useRealtimeFeedLegacy from './useRealtimeFeedLegacy';

const ENABLE_REALTIME_CONNECTION_MANAGER =
  String(process.env.REACT_APP_ENABLE_REALTIME_CONNECTION_MANAGER || '').toLowerCase() === 'true';

export default function useRealtimeFeed({ symbols, pollInterval = 15000, maxAlerts = 5 }) {
  const managedFeed = useRealtimeFeedFromManager({ symbols, pollInterval, maxAlerts });
  const useManager = ENABLE_REALTIME_CONNECTION_MANAGER && !!managedFeed;

  const legacyFeed = useRealtimeFeedLegacy({
    symbols,
    pollInterval,
    maxAlerts,
    enabled: !useManager,
  });

  return useManager ? managedFeed : legacyFeed;
}
