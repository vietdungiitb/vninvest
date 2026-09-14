// Extend CoreApiAdapter with methods used across pages
import { CoreApiAdapter, CoreApiRequestError } from "./adapters/coreApiAdapter";

declare module "./adapters/coreApiAdapter" {
  interface CoreApiAdapter {
    // Admin methods
    getAdminCrawlJobs: () => Promise<any>;
    getAdminCrawlRuns: () => Promise<any>;
    runAdminCrawlJob: (data: any) => Promise<any>;
    stopAdminCrawlJob: (id: string) => Promise<any>;

    // AI Command Center
    getAICommandCenterConfig: () => Promise<any>;
    updateAICommandCenterConfig: (data: any) => Promise<any>;
    testAICommandCenterConnection: () => Promise<any>;

    // Alert Center
    getAlertCenterFeed: (params: any) => Promise<any>;
    getAlertCenterEventDetail: (id: string) => Promise<any>;
    getAlertCenterSymbolContext: (symbol: string) => Promise<any>;
    acknowledgeAlertCenterEvent: (id: string) => Promise<any>;
    muteAlertCenterPreference: (symbol: string) => Promise<any>;

    // Dashboard
    getPortfolioNewsDigest: (params: any) => Promise<any>;

    // Auth
    requestPasswordReset: (email: string) => Promise<any>;
    confirmPasswordReset: (data: any) => Promise<any>;
    verifyEmailToken: (token: string) => Promise<any>;

    // Screener
    getScreenerTemplates: () => Promise<any>;
    getScreenerRules: () => Promise<any>;
    createScreenerRule: (data: any) => Promise<any>;
    updateScreenerRule: (id: string, data: any) => Promise<any>;
    deleteScreenerRule: (id: string) => Promise<any>;
    runScreenerRule: (id: string, params?: Record<string, string | number>) => Promise<any>;
    getScreenerRunStatus: (id: string, jobId: string) => Promise<any>;
    getScreenerHistory: (params?: Record<string, string | number>) => Promise<any>;
    getScreenerHistoryBacktest: (historyId: string | number, horizon?: number) => Promise<any>;
    deleteScreenerHistory: (historyId: string | number) => Promise<any>;
    clearScreenerHistory: () => Promise<any>;
    getScreenerSchedules: () => Promise<any>;
    createScreenerSchedule: (data: any) => Promise<any>;
    updateScreenerSchedule: (id: string | number, data: any) => Promise<any>;
    deleteScreenerSchedule: (id: string | number) => Promise<any>;
    runScreenerScheduleNow: (id: string | number) => Promise<any>;
    getScreenerScheduleAlerts: () => Promise<any>;

    // Support
    listSupportTickets: (params: any) => Promise<any>;
    listStaffSupportTickets: (params: any) => Promise<any>;
    getSupportTicketDetail: (id: string) => Promise<any>;
    getStaffSupportDashboard: () => Promise<any>;
    createSupportTicket: (data: any) => Promise<any>;
    replySupportTicket: (id: string, data: any) => Promise<any>;
    replyStaffSupportTicket: (id: string, data: any) => Promise<any>;
    patchStaffSupportTicket: (id: string, data: any) => Promise<any>;
    reopenSupportTicket: (id: string) => Promise<any>;

    // Legacy Watchlist
    getPortfolioHoldings: (portfolioId: string | number) => Promise<any>;
    getLegacyWatchlistGroups: () => Promise<any>;
    getWatchlistItems: (watchlistId: string | number) => Promise<any>;
    getTrackedSymbols: () => Promise<any>;
    addTrackedSymbol: (symbol: string, sourceGroupId?: number | string | null, whaleAlertThresholdMillion?: number) => Promise<any>;
    removeTrackedSymbol: (id: string | number) => Promise<any>;
    updateTrackedSymbol: (id: string | number, whaleAlertThresholdMillion: number) => Promise<any>;
    getPriceAlerts: () => Promise<any>;
    createPriceAlert: (payload: any) => Promise<any>;
    deletePriceAlert: (id: string | number) => Promise<any>;
    getBulkTechnicalsBySymbols: (symbols: string[]) => Promise<any>;
    addWatchlistItem: (watchlistId: string | number, symbol: string) => Promise<any>;
    removeWatchlistItem: (watchlistId: string | number, symbol: string) => Promise<any>;
    syncAdminMarketGroups: (mode: string) => Promise<any>;
    getMarketGroupsSyncStatus: (taskId: string) => Promise<any>;

    // Partner Dashboard
    getDashboardSummary: () => Promise<any>;
    getUsageTrend: (days?: number) => Promise<any>;

    // Alert Config (Phase 1)
    getAlertConfigs: () => Promise<any>;
    updateAlertConfig: (meterCode: string, data: any) => Promise<any>;

    // Usage Forecast (Phase 1/2)
    getUsageForecast: (meterCode?: string, lookback?: number) => Promise<any>;

    // Per-Meter Usage Trend (Phase 1)
    getUsageTrendMeter: (meterCode: string, days?: number) => Promise<any>;
    getAllUsageTrends: (days?: number) => Promise<any>;

    // Core REST methods — return parsed JSON body, not raw Response
    coreGet: (path: string, params?: any) => Promise<any>;
    corePost: (path: string, data?: any) => Promise<any>;
    corePatch: (path: string, data?: any) => Promise<any>;
    coreDelete: (path: string) => Promise<any>;

    // SOC
    getOperationsCenter: () => Promise<any>;
    getMailConfig: () => Promise<any>;
    updateMailConfig: (data: any) => Promise<any>;
    sendTestEmail: (data: any) => Promise<any>;
  }

  interface CoreApiRequestError {
    payload?: Record<string, any>;
    fieldErrors?: Record<string, string[]>;
  }
}
