declare module 'vnbrokercharts' {
  import type { ComponentType } from 'react';

  export type OHLCVBar = {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    buyVolume?: number;
    sellVolume?: number;
    foreignBuy?: number;
    foreignSell?: number;
    index: number;
    dataIndex: number;
  };

  export type WhaleEvent = {
    ts: Date;
    price: number;
    side: 'BUY' | 'SELL';
    matchedValue: number;
    severity?: 'HIGH' | 'EXTREME';
  };

  export const VNBrokerChart: ComponentType<{
    data?: readonly OHLCVBar[];
    symbol?: string;
    timeframe?: string;
    locale?: 'vi' | 'en';
    theme?: 'dark' | 'light';
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }>;

  export const WhaleBubbleOverlay: ComponentType<{
    events: readonly WhaleEvent[];
    threshold?: number;
    baseRadius?: number;
    maxRadius?: number;
  }>;

  export type { OHLCVBar as WidgetOHLCVBar, WhaleEvent as WidgetWhaleEvent };
}