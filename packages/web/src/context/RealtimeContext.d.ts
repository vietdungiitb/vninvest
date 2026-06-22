import { createContext, useContext, ReactNode } from 'react';

interface RealtimeFeed {
  quotesBySymbol: Record<string, any>;
  realtimeStatus: string;
  lastEventAt: string | null;
  alerts: any[];
  darkFlowAlerts: any[];
  marketDiscoveryEvents: any[];
  latestWhaleAlert: any | null;
  latestDarkFlowAlert: any | null;
  latestMarketDiscoveryEvent: any | null;
  metrics: any;
}

interface RealtimeContextValue {
  enabled: boolean;
  register: (consumerId: string, config: { symbols: string[]; maxAlerts: number; pollInterval: number }) => void;
  update: (consumerId: string, config: { symbols: string[]; maxAlerts: number; pollInterval: number }) => void;
  unregister: (consumerId: string) => void;
  feed: RealtimeFeed;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }): JSX.Element;

export function useRealtimeFeedFromManager({ symbols, pollInterval, maxAlerts }: { symbols: string[]; pollInterval?: number; maxAlerts?: number }): RealtimeFeed | null;