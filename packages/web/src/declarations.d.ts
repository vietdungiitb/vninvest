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
    getScreenerRules: () => Promise<any>;
    createScreenerRule: (data: any) => Promise<any>;
    updateScreenerRule: (id: string, data: any) => Promise<any>;
    deleteScreenerRule: (id: string) => Promise<any>;
    runScreenerRule: (id: string) => Promise<any>;

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
    getLegacyWatchlistGroups: () => Promise<any>;
    getTrackedSymbols: () => Promise<any>;
    addTrackedSymbol: (symbol: string) => Promise<any>;
    removeTrackedSymbol: (id: string) => Promise<any>;
    updateTrackedSymbol: (id: string, data: any) => Promise<any>;
    getPriceAlerts: () => Promise<any>;
    getBulkTechnicalsBySymbols: (symbols: string[]) => Promise<any>;
    addWatchlistItem: (data: any) => Promise<any>;
    removeWatchlistItem: (id: string) => Promise<any>;
    syncAdminMarketGroups: () => Promise<any>;
    getMarketGroupsSyncStatus: () => Promise<any>;

    // Core REST methods
    coreGet: (path: string, params?: any) => Promise<Response>;
    corePost: (path: string, data?: any) => Promise<Response>;
    corePatch: (path: string, data?: any) => Promise<Response>;
    coreDelete: (path: string) => Promise<Response>;

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
