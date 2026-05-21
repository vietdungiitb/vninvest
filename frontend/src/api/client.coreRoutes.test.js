jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
  create: jest.fn(),
}));

jest.mock('@vninvest/web/adapters/core-api-adapter', () => ({
  coreApiAdapter: {
    getPortfolioHoldings: jest.fn(),
    getPortfolioSummary: jest.fn(),
    getPortfolioAnalytics: jest.fn(),
    getPortfolioTechnicals: jest.fn(),
    getBulkTechnicalsBySymbols: jest.fn(),
    getPortfolioNewsDigest: jest.fn(),
    getTrackedSymbols: jest.fn(),
    getWhaleAnalyticsSnapshot: jest.fn(),
    getAlertCenterFeed: jest.fn(),
    getLegacyWatchlistGroups: jest.fn(),
  },
}), { virtual: true });

describe('client core route wrappers', () => {
  let mockApiClient;
  let originalApiBaseURL;
  let originalCoreApiBaseURL;
  let getSecuritiesGroups;
  let seedSecurities;
  let syncSecuritiesPrices;
  let getStockProfile;
  let getStockWorkspaceOverview;
  let getStockPriceChart;
  let getStockDarkMoneyHistory;
  let getStockOrderFlow;
  let getSessionFacts;
  let getSessionFactsCvd;
  let getStockNews;
  let generateStockNewsAISummary;
  let getStockAIAdvisorySession;
  let getStockAIAdvisoryObservability;
  let postStockAIAdvisoryObservabilityEvent;
  let refreshStockAIAdvisorySession;
  let generateStockAIAdvisoryComponents;
  let toggleStockAIAdvisoryComponentInclude;
  let refreshStockAIAdvisoryComponent;
  let restoreStockAIAdvisoryComponent;
  let deleteStockAIAdvisoryComponent;
  let clearDeletedStockAIAdvisoryComponents;
  let regenerateStockAIExecutiveSummary;
  let deleteStockAIExecutiveSummary;
  let getStockFinancials;
  let getPriceAlerts;
  let createPriceAlert;
  let updatePriceAlert;
  let deletePriceAlert;
  let markPriceAlertTriggered;
  let addTrackedSymbol;
  let updateTrackedSymbol;
  let bulkUpdateTrackedSymbolThreshold;
  let deleteTrackedSymbol;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    originalApiBaseURL = process.env.REACT_APP_API_BASE_URL;
    originalCoreApiBaseURL = process.env.REACT_APP_CORE_API_BASE_URL;
    delete process.env.REACT_APP_API_BASE_URL;
    delete process.env.REACT_APP_CORE_API_BASE_URL;

    mockApiClient = {
      get: jest.fn().mockResolvedValue({ data: [] }),
      post: jest.fn().mockResolvedValue({ data: {} }),
      patch: jest.fn().mockResolvedValue({ data: {} }),
      delete: jest.fn().mockResolvedValue({ data: {} }),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: {
        timeout: 20000,
      },
    };

    const axiosModule = require('axios');
    axiosModule.default.create.mockReturnValue(mockApiClient);
    axiosModule.create.mockReturnValue(mockApiClient);

    ({
      getSecuritiesGroups,
      seedSecurities,
      syncSecuritiesPrices,
      getStockProfile,
      getStockWorkspaceOverview,
      getStockPriceChart,
      getStockDarkMoneyHistory,
      getStockOrderFlow,
      getSessionFacts,
      getSessionFactsCvd,
      getStockNews,
      generateStockNewsAISummary,
      getStockAIAdvisorySession,
      getStockAIAdvisoryObservability,
      postStockAIAdvisoryObservabilityEvent,
      refreshStockAIAdvisorySession,
      generateStockAIAdvisoryComponents,
      toggleStockAIAdvisoryComponentInclude,
      refreshStockAIAdvisoryComponent,
      restoreStockAIAdvisoryComponent,
      deleteStockAIAdvisoryComponent,
      clearDeletedStockAIAdvisoryComponents,
      regenerateStockAIExecutiveSummary,
      deleteStockAIExecutiveSummary,
      getStockFinancials,
      getPriceAlerts,
      createPriceAlert,
      updatePriceAlert,
      deletePriceAlert,
      markPriceAlertTriggered,
      addTrackedSymbol,
      updateTrackedSymbol,
      bulkUpdateTrackedSymbolThreshold,
      deleteTrackedSymbol,
    } = require('./client'));
  });

  afterEach(() => {
    if (typeof originalApiBaseURL === 'undefined') {
      delete process.env.REACT_APP_API_BASE_URL;
    } else {
      process.env.REACT_APP_API_BASE_URL = originalApiBaseURL;
    }

    if (typeof originalCoreApiBaseURL === 'undefined') {
      delete process.env.REACT_APP_CORE_API_BASE_URL;
    } else {
      process.env.REACT_APP_CORE_API_BASE_URL = originalCoreApiBaseURL;
    }
  });

  test('getSecuritiesGroups targets the core groups route', async () => {
    await getSecuritiesGroups();

    expect(mockApiClient.get).toHaveBeenCalledWith('/stock-management/groups/', { baseURL: '/core/v1' });
  });

  test('stock-management seed and sync wrappers target core v1 routes', async () => {
    await seedSecurities();
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      1,
      '/stock-management/seed/',
      {},
      { baseURL: '/core/v1' },
    );

    await syncSecuritiesPrices(5);
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      2,
      '/stock-management/sync/',
      { days: 5 },
      { baseURL: '/core/v1' },
    );
  });

  test('tracked symbol mutations target core v1 routes with baseURL override', async () => {
    await addTrackedSymbol('TPB', 7, 850);
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      1,
      '/stock-management/tracked-symbols/',
      {
        symbol: 'TPB',
        source_group_id: 7,
        whale_alert_threshold_million: 850,
      },
      { baseURL: '/core/v1' },
    );

    await updateTrackedSymbol(11, { whale_alert_threshold_million: 920 });
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/stock-management/tracked-symbols/11/',
      { whale_alert_threshold_million: 920 },
      { baseURL: '/core/v1' },
    );

    await bulkUpdateTrackedSymbolThreshold([11, 12], null);
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      2,
      '/stock-management/tracked-symbols/bulk-threshold/',
      {
        tracked_symbol_ids: [11, 12],
        whale_alert_threshold_million: null,
      },
      { baseURL: '/core/v1' },
    );

    await deleteTrackedSymbol(11);
    expect(mockApiClient.delete).toHaveBeenCalledWith(
      '/stock-management/tracked-symbols/11/',
      { baseURL: '/core/v1' },
    );
  });

  test('stock detail read wrappers target core v1 routes with baseURL override', async () => {
    await getStockProfile('TPB');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      1,
      '/stock-management/stocks/TPB/',
      { baseURL: '/core/v1' },
    );

    await getStockWorkspaceOverview('TPB');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      2,
      '/stock-management/stocks/TPB/overview/',
      { baseURL: '/core/v1' },
    );

    await getStockPriceChart('TPB', 30, '1H');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      3,
      '/stock-management/stocks/TPB/chart/',
      { baseURL: '/core/v1', params: { days: 30, timeframe: '1H' } },
    );

    await getStockDarkMoneyHistory('TPB', '1h', '1M');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      4,
      '/stock-management/stocks/TPB/dark-money-history/',
      { baseURL: '/core/v1', params: { interval: '1h', period: '1M' } },
    );

    await getStockOrderFlow('TPB', '15m');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      5,
      '/stock-management/stocks/TPB/order-flow/',
      { baseURL: '/core/v1', params: { window: '15m' } },
    );

    await getStockNews('TPB', { force: true });
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      6,
      '/stock-management/stocks/TPB/news/',
      { baseURL: '/core/v1', params: { force: 1 } },
    );

    await getStockFinancials('TPB');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      7,
      '/stock-management/stocks/TPB/financials/',
      { baseURL: '/core/v1' },
    );
  });

  test('session facts wrappers target market-serving routes on the api base', async () => {
    await getSessionFacts('VHM', '2026-05-20');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      1,
      '/market/session-facts/VHM/',
      { params: { trade_date: '2026-05-20' } },
    );

    await getSessionFactsCvd('VHM', '30m', '2026-05-20');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      2,
      '/market/session-facts/VHM/cvd/',
      { params: { window: '30m', trade_date: '2026-05-20' } },
    );
  });

  test('stock news ai summary wrapper targets core v1 route with baseURL override', async () => {
    await generateStockNewsAISummary('TPB', { force: true });

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/stock-management/stocks/TPB/news/ai-summary/',
      { force_refresh: true },
      { baseURL: '/core/v1' },
    );
  });

  test('stock ai advisory wrappers target core v1 routes with baseURL override', async () => {
    await getStockAIAdvisorySession('TPB', { contract: 'v2', include_benchmarks: 1 });
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      1,
      '/stock-management/stocks/TPB/ai-advisory-session/',
      { baseURL: '/core/v1', params: { contract: 'v2', include_benchmarks: 1 } },
    );

    await getStockAIAdvisoryObservability('TPB', { source: 'panel' });
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      2,
      '/stock-management/stocks/TPB/ai-advisory-observability/',
      { baseURL: '/core/v1', params: { source: 'panel' } },
    );

    await postStockAIAdvisoryObservabilityEvent('TPB', { event: 'open' });
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      1,
      '/stock-management/stocks/TPB/ai-advisory-observability/',
      { event: 'open' },
      { baseURL: '/core/v1' },
    );

    await refreshStockAIAdvisorySession('TPB');
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      2,
      '/stock-management/stocks/TPB/ai-advisory-session/',
      {},
      { baseURL: '/core/v1' },
    );

    await generateStockAIAdvisoryComponents('TPB', { reason: 'manual' });
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      3,
      '/stock-management/stocks/TPB/ai-advisory-components/generate/',
      { reason: 'manual' },
      { baseURL: '/core/v1' },
    );

    await toggleStockAIAdvisoryComponentInclude('component-1');
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      4,
      '/stock-management/ai-advisory-components/component-1/toggle-include/',
      {},
      { baseURL: '/core/v1' },
    );

    await refreshStockAIAdvisoryComponent('component-1');
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      5,
      '/stock-management/ai-advisory-components/component-1/refresh/',
      {},
      { baseURL: '/core/v1' },
    );

    await restoreStockAIAdvisoryComponent('component-1');
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      6,
      '/stock-management/ai-advisory-components/component-1/restore/',
      {},
      { baseURL: '/core/v1' },
    );

    await regenerateStockAIExecutiveSummary('TPB', { scope: 'executive' });
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      7,
      '/stock-management/stocks/TPB/ai-advisory-summary/regenerate/',
      { scope: 'executive' },
      { baseURL: '/core/v1' },
    );

    await deleteStockAIAdvisoryComponent('component-1');
    expect(mockApiClient.delete).toHaveBeenNthCalledWith(
      1,
      '/stock-management/ai-advisory-components/component-1/',
      { baseURL: '/core/v1' },
    );

    await clearDeletedStockAIAdvisoryComponents('TPB');
    expect(mockApiClient.delete).toHaveBeenNthCalledWith(
      2,
      '/stock-management/stocks/TPB/ai-advisory-components/deleted/',
      { baseURL: '/core/v1' },
    );

    await deleteStockAIExecutiveSummary('TPB', 'summary-1');
    expect(mockApiClient.delete).toHaveBeenNthCalledWith(
      3,
      '/stock-management/stocks/TPB/ai-advisory-summary/summary-1/',
      { baseURL: '/core/v1' },
    );
  });

  test('price alert wrappers target core v1 routes with baseURL override', async () => {
    await getPriceAlerts();
    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/stock-management/price-alerts/',
      { baseURL: '/core/v1' },
    );

    await createPriceAlert({ symbol: 'FPT', target_price: 100500 });
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      1,
      '/stock-management/price-alerts/',
      { symbol: 'FPT', target_price: 100500 },
      { baseURL: '/core/v1' },
    );

    await updatePriceAlert(11, { is_active: false });
    expect(mockApiClient.patch).toHaveBeenCalledWith(
      '/stock-management/price-alerts/11/',
      { is_active: false },
      { baseURL: '/core/v1' },
    );

    await markPriceAlertTriggered(11);
    expect(mockApiClient.post).toHaveBeenNthCalledWith(
      2,
      '/stock-management/price-alerts/11/mark-triggered/',
      {},
      { baseURL: '/core/v1' },
    );

    await deletePriceAlert(11);
    expect(mockApiClient.delete).toHaveBeenCalledWith(
      '/stock-management/price-alerts/11/',
      { baseURL: '/core/v1' },
    );
  });

  test('core stock-management wrappers honor a configured external API host', async () => {
    jest.resetModules();
    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com/api';

    const axiosModule = require('axios');
    axiosModule.default.create.mockReturnValue(mockApiClient);
    axiosModule.create.mockReturnValue(mockApiClient);

    const { getStockWorkspaceOverview: getStockWorkspaceOverviewWithExternalHost } = require('./client');

    await getStockWorkspaceOverviewWithExternalHost('TPB');

    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/stock-management/stocks/TPB/overview/',
      { baseURL: 'https://api.example.com/core/v1' },
    );
  });

  test('session facts wrappers keep using the api host when core host is configured separately', async () => {
    jest.resetModules();
    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com/api';
    process.env.REACT_APP_CORE_API_BASE_URL = 'https://core.example.com/core/v1';

    const axiosModule = require('axios');
    axiosModule.default.create.mockReturnValue(mockApiClient);
    axiosModule.create.mockReturnValue(mockApiClient);

    const {
      getSessionFacts: getSessionFactsWithExternalHost,
      getSessionFactsCvd: getSessionFactsCvdWithExternalHost,
    } = require('./client');

    await getSessionFactsWithExternalHost('VHM', '2026-05-20');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      1,
      '/market/session-facts/VHM/',
      { params: { trade_date: '2026-05-20' } },
    );

    await getSessionFactsCvdWithExternalHost('VHM', '30m', '2026-05-20');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(
      2,
      '/market/session-facts/VHM/cvd/',
      { params: { window: '30m', trade_date: '2026-05-20' } },
    );
  });
});