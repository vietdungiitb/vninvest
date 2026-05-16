const mockGetAlertCenterFeed = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    post: jest.fn(),
  },
  create: jest.fn(),
  post: jest.fn(),
}));

jest.mock('@vninvest/web/adapters/core-api-adapter', () => ({
  coreApiAdapter: {
    getAlertCenterFeed: mockGetAlertCenterFeed,
  },
}), { virtual: true });

describe('getAlertCenterFeed', () => {
  let getAlertCenterFeed;
  let getUnifiedAlerts;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetAlertCenterFeed.mockReset();

    const axiosModule = require('axios');
    const mockApiClient = {
      get: jest.fn().mockResolvedValue({ data: {} }),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    axiosModule.default.create.mockReturnValue(mockApiClient);
    axiosModule.create.mockReturnValue(mockApiClient);

    ({ getAlertCenterFeed, getUnifiedAlerts } = require('./client'));
  });

  it('bridges multi-symbol requests to server truth and normalizes cursor shape', async () => {
    mockGetAlertCenterFeed.mockResolvedValue({
      results: [
        { alert_id: '1', symbol: 'FPT', severity: 'high' },
        { alert_id: '2', symbol: 'HPG', severity: 'high' },
        { alert_id: '3', symbol: 'SSI', severity: 'low' },
      ],
      next: 'http://localhost/core/v1/signals/alert-center/feed?cursor=cursor_abc&page_size=10',
      previous: null,
    });

    const response = await getAlertCenterFeed({
      symbols: ['FPT', 'HPG'],
      watchlistGroupIds: [1, 7],
      window: '5d',
      severityMin: 'high',
      limit: 10,
      cursor: 'cursor_abc',
    });

    expect(mockGetAlertCenterFeed).toHaveBeenCalledTimes(1);
    expect(mockGetAlertCenterFeed).toHaveBeenCalledWith({
      symbol: undefined,
      severity: 'high',
      alert_family: undefined,
      page_size: 10,
      cursor: 'cursor_abc',
    });
    expect(response).toEqual({
      data: {
        results: [
          { alert_id: '1', symbol: 'FPT', severity: 'high' },
          { alert_id: '2', symbol: 'HPG', severity: 'high' },
        ],
        next_cursor: 'cursor_abc',
        has_more: true,
        next: 'http://localhost/core/v1/signals/alert-center/feed?cursor=cursor_abc&page_size=10',
        previous: null,
      },
    });
  });

  it('passes a single symbol with the default page size and keeps empty cursor state', async () => {
    mockGetAlertCenterFeed.mockResolvedValue({
      results: [{ alert_id: '1', symbol: 'VNM' }],
      next: null,
      previous: null,
    });

    const response = await getAlertCenterFeed({ symbols: ['VNM'] });

    expect(mockGetAlertCenterFeed).toHaveBeenCalledWith({
      symbol: 'VNM',
      severity: undefined,
      alert_family: undefined,
      page_size: 20,
      cursor: undefined,
    });
    expect(response.data.results).toEqual([{ alert_id: '1', symbol: 'VNM' }]);
    expect(response.data.next_cursor).toBe(null);
    expect(response.data.has_more).toBe(false);
  });

  it('keeps getUnifiedAlerts as compatibility alias', async () => {
    mockGetAlertCenterFeed.mockResolvedValue({
      results: [],
      next: null,
      previous: null,
    });

    await getUnifiedAlerts({ symbols: ['VNM'] });
    expect(mockGetAlertCenterFeed).toHaveBeenCalledTimes(1);
  });
});
