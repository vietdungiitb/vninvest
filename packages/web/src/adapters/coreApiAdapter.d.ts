export interface AuthTokenStorage {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (tokens: { access: string; refresh: string }) => void;
  clearTokens: () => void;
  hasTokens: () => boolean;
}

export const authTokenStorage: AuthTokenStorage;

export interface TenantIdStorage {
  getTenantId: () => string | null;
  setTenantId: (value: string) => void;
  clearTenantId: () => void;
}

export const tenantIdStorage: TenantIdStorage;

export class CoreApiRequestError extends Error {
  status: number;
  statusCode: number;
  data: any;
  constructor(message: string, status: number, data?: any);
}

export interface CoreApiAdapter {
  // Raw transport methods
  coreGet: (path: string, options?: any) => Promise<any>;
  corePost: (path: string, body?: any) => Promise<any>;
  corePut: (path: string, body?: any) => Promise<any>;
  corePatch: (path: string, body?: any) => Promise<any>;
  coreDelete: (path: string) => Promise<any>;

  // Auth
  loginUser: (credentials: { username: string; password: string }) => Promise<any>;
  registerUser: (data: { username: string; email: string; password: string; password_confirm: string }) => Promise<any>;
  resendVerificationEmail: (identifier: string) => Promise<any>;
  refreshAuthToken: (refreshToken: string) => Promise<any>;
  getUserProfile: () => Promise<any>;
  updateUserProfile: (data: any) => Promise<any>;
  getTenantLifecycle: () => Promise<any>;
  
  // Market
  getMarketOverview: () => Promise<any>;
  getStockDetail: (symbol: string) => Promise<any>;
  getStockHistory: (symbol: string, params: any) => Promise<any>;
  getStockQuotes: (symbols: string[]) => Promise<any>;
  getMarketDepth: (symbol: string) => Promise<any>;
  getMarketTrades: (symbol: string) => Promise<any>;
  getMarketIndices: () => Promise<any>;
  getSectorPerformance: () => Promise<any>;
  getTopGainersLosers: () => Promise<any>;
  getMarketNews: (params: any) => Promise<any>;
  getCompanyInfo: (symbol: string) => Promise<any>;
  getFinancialStatements: (symbol: string) => Promise<any>;
  getDividendHistory: (symbol: string) => Promise<any>;
  getStockEvents: (symbol: string) => Promise<any>;
  getAnalystRatings: (symbol: string) => Promise<any>;
  getInsiderTrades: (symbol: string) => Promise<any>;
  getInstitutionalHolders: (symbol: string) => Promise<any>;
  getShortInterest: (symbol: string) => Promise<any>;
  getOptionsChain: (symbol: string) => Promise<any>;
  getTechnicalIndicators: (symbol: string, params: any) => Promise<any>;
  getPatternRecognition: (symbol: string) => Promise<any>;
  getSupportResistance: (symbol: string) => Promise<any>;
  getVolumeProfile: (symbol: string) => Promise<any>;
  getOrderFlow: (symbol: string) => Promise<any>;
  getDarkPoolData: (symbol: string) => Promise<any>;
  getWhaleAlerts: (params: any) => Promise<any>;
  getAiAdvisory: (params: any) => Promise<any>;
  
  // Workspace
  getPortfolios: () => Promise<any>;
  createPortfolio: (data: any) => Promise<any>;
  updatePortfolio: (id: string, data: any) => Promise<any>;
  deletePortfolio: (id: string) => Promise<any>;
  getPortfolioDetail: (id: string) => Promise<any>;
  getPortfolioPositions: (id: string) => Promise<any>;
  getPortfolioTransactions: (id: string, params: any) => Promise<any>;
  getPortfolioPerformance: (id: string) => Promise<any>;
  getPortfolioRisk: (id: string) => Promise<any>;
  createSubAccount: (data: any) => Promise<any>;
  updateSubAccount: (id: string, data: any) => Promise<any>;
  deleteSubAccount: (id: string) => Promise<any>;
  getSubAccounts: (portfolioId: string) => Promise<any>;
  getWatchlists: () => Promise<any>;
  createWatchlist: (data: any) => Promise<any>;
  updateWatchlist: (id: string, data: any) => Promise<any>;
  deleteWatchlist: (id: string) => Promise<any>;
  getWatchlistSymbols: (id: string) => Promise<any>;
  addWatchlistSymbol: (id: string, symbol: string) => Promise<any>;
  removeWatchlistSymbol: (id: string, symbol: string) => Promise<any>;
  getAlerts: (params: any) => Promise<any>;
  createAlert: (data: any) => Promise<any>;
  updateAlert: (id: string, data: any) => Promise<any>;
  deleteAlert: (id: string) => Promise<any>;
  getTransactions: (params: any) => Promise<any>;
  createTransaction: (data: any) => Promise<any>;
  updateTransaction: (id: string, data: any) => Promise<any>;
  deleteTransaction: (id: string) => Promise<any>;
  
  // Commercial
  getBillingPlans: () => Promise<any>;
  getCurrentSubscription: () => Promise<any>;
  createSubscription: (data: any) => Promise<any>;
  updateSubscription: (id: string, data: any) => Promise<any>;
  cancelSubscription: (id: string) => Promise<any>;
  getPaymentMethods: () => Promise<any>;
  addPaymentMethod: (data: any) => Promise<any>;
  removePaymentMethod: (id: string) => Promise<any>;
  getInvoices: (params: any) => Promise<any>;
  getInvoiceDetail: (id: string) => Promise<any>;
  processPayment: (data: any) => Promise<any>;
  
  // Screener
  getScreenerPresets: () => Promise<any>;
  createScreenerPreset: (data: any) => Promise<any>;
  updateScreenerPreset: (id: string, data: any) => Promise<any>;
  deleteScreenerPreset: (id: string) => Promise<any>;
  runScreener: (params: any) => Promise<any>;
  getScreenerResults: (id: string) => Promise<any>;
  
  // Advisory
  createAdvisorySession: (data: any) => Promise<any>;
  getAdvisorySession: (id: string) => Promise<any>;
  updateAdvisorySession: (id: string, data: any) => Promise<any>;
  deleteAdvisorySession: (id: string) => Promise<any>;
  getAdvisorySessions: (params: any) => Promise<any>;
  getAdvisoryRecommendations: (sessionId: string) => Promise<any>;
  
  // Crawl
  getCrawlStatus: () => Promise<any>;
  triggerCrawl: (data: any) => Promise<any>;
  getCrawlLogs: (params: any) => Promise<any>;
  
  // DNSE
  getDnseConnection: () => Promise<any>;
  updateDnseConnection: (data: any) => Promise<any>;
  testDnseConnection: () => Promise<any>;
  getDnseBackfillJobs: () => Promise<any>;
  triggerDnseBackfill: (data: any) => Promise<any>;
  
  // Operator
  getOperatorStats: () => Promise<any>;
  getSystemHealth: () => Promise<any>;
  getAuditLogs: (params: any) => Promise<any>;
  
  // Misc
  getSettings: () => Promise<any>;
  updateSettings: (data: any) => Promise<any>;
  getNotifications: (params: any) => Promise<any>;
  markNotificationRead: (id: string) => Promise<any>;
  
  // SOC
  getOperationsCenter: () => Promise<any>;
  getMailConfig: () => Promise<any>;
  updateMailConfig: (data: any) => Promise<any>;
  sendTestEmail: (data: any) => Promise<any>;

  // Tenant-admin usage
  getAllUsageTrends: (days?: number) => Promise<any>;
  getUsageForecast: () => Promise<any>;
  getAlertConfigs: () => Promise<any>;

  // Tenant-admin operator (partner/*)
  getAdminAuditLog: (params?: any) => Promise<any>;
  getDashboardSummary: () => Promise<any>;
  getUsageTrend: (days?: number) => Promise<any>;
  updateAlertConfig: (meterCode: string, data: any) => Promise<any>;
  getUsageForecast: (meterCode?: string | null, lookback?: number) => Promise<any>;
  getUsageTrendMeter: (meterCode: string, days?: number) => Promise<any>;
  getAllUsageTrends: (days?: number) => Promise<any>;

  // Phase 2: Cost Analytics
  getCostTrend: (months?: number) => Promise<any>;

  // Phase 2: Scheduled Reports
  getScheduledReports: () => Promise<any>;
  createScheduledReport: (data: any) => Promise<any>;
  updateScheduledReport: (id: number, data: any) => Promise<any>;
  deleteScheduledReport: (id: number) => Promise<any>;
  testScheduledReport: (id: number) => Promise<any>;
  getReportDeliveryLog: () => Promise<any>;

  // Phase 3: Security Dashboard
  getLoginActivity: (days?: number) => Promise<any>;
  getActiveSessions: () => Promise<any>;
  revokeSession: (sessionId: number) => Promise<any>;
  revokeAllSessions: () => Promise<any>;

  // Phase 4: Webhooks
  getWebhooks: () => Promise<any>;
  createWebhook: (data: any) => Promise<any>;
  updateWebhook: (id: number, data: any) => Promise<any>;
  deleteWebhook: (id: number) => Promise<any>;
  getWebhookDeliveries: (id: number) => Promise<any>;
  regenerateWebhookSecret: (id: number) => Promise<any>;
  testWebhook: (id: number) => Promise<any>;
  retryWebhookDelivery: (configId: number, deliveryId: number) => Promise<any>;

  // Phase 4: Billing status + plan preview
  getBillingStatus: () => Promise<any>;
  previewPlanChange: (planCode: string) => Promise<any>;
  createStripeCheckoutSession: (planCode: string, successUrl: string, cancelUrl: string) => Promise<any>;
  createStripePortalSession: (returnUrl: string) => Promise<any>;
}

export function createCoreApiAdapter(options?: {
  env?: Record<string, string>;
  getToken?: () => string | null;
  getRefreshToken?: () => string | null;
  setTokens?: (tokens: { access: string; refresh: string }) => void;
  clearTokens?: () => void;
}): CoreApiAdapter;

export const coreApiAdapter: CoreApiAdapter;
export const defaultCoreApiAdapter: CoreApiAdapter;