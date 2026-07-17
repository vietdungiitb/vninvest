declare module "vninvestcharts-widget" {
  import type { ForwardRefExoticComponent, RefAttributes, ReactNode } from "react";

  export interface VNInvestChartsProps {
    symbol: string;
    timeframe?: string;
    theme?: "light" | "dark";
    locale?: "vi" | "en";
    messages?: Record<string, string>;
    drawingUiEnabled?: boolean;
    showHeader?: boolean;
    showToolbar?: boolean;
    showFooter?: boolean;
    adapter?: Record<string, unknown>;
    data?: unknown[];
    panes?: unknown[];
    range?: string;
    onRangeChange?: (range: string) => void;
    engineRuntime?: string;
    enableWhale?: boolean;
    whaleOrders?: unknown[];
    enableCVD?: boolean;
    externalCvdSeries?: unknown[];
    darkFlowStrength?: number | null;
    darkFlowSignalType?: string;
    onClick?: (moreProps: unknown) => void;
    onVisibleRangeChange?: (range: unknown) => void;
    onBarsChange?: (bars: unknown[]) => void;
    onTimeframeChange?: (tf: string) => void;
    onSymbolChange?: (symbol: string) => void;
    children?: ReactNode;
  }

  export const VNInvestCharts: ForwardRefExoticComponent<VNInvestChartsProps & RefAttributes<unknown>>;
  export const widgetMessagesVi: Record<string, string>;
  export const widgetMessagesEn: Record<string, string>;
  export const version: string;
}

declare module "vninvestcharts-widget/adapters" {
  export class VNInvestDataAdapter {
    constructor(config: { patToken: string; apiBase?: string });
  }
}
