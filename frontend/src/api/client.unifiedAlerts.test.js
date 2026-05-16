const mockGetUnifiedAlertDelivery = jest.fn();

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
    getUnifiedAlertDelivery: mockGetUnifiedAlertDelivery,
  },
}), { virtual: true });

describe('getUnifiedAlerts', () => {
  let getUnifiedAlerts;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetUnifiedAlertDelivery.mockReset();

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

    ({ getUnifiedAlerts } = require('./client'));
  });

  it('bridges multi-symbol requests to server truth and normalizes cursor shape', async () => {
    mockGetUnifiedAlertDelivery.mockResolvedValue({
      results: [
        { alert_id: '1', symbol: 'FPT', severity: 'high' },
        { alert_id: '2', symbol: 'HPG', severity: 'high' },
        { alert_id: '3', symbol: 'SSI', severity: 'low' },
      ],
      next: 'http://localhost/core/v1/unified-alert/delivery?cursor=cursor_abc&page_size=10',
      previous: null,
    });

    const response = await getUnifiedAlerts({
      symbols: ['FPT', 'HPG'],
      watchlistGroupIds: [1, 7],
      window: '5d',
      severityMin: 'high',
      limit: 10,
      cursor: 'cursor_abc',
    });

    expect(mockGetUnifiedAlertDelivery).toHaveBeenCalledTimes(1);
    expect(mockGetUnifiedAlertDelivery).toHaveBeenCalledWith({
      symbol: undefined,
      severity: 'high',
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
        next: 'http://localhost/core/v1/unified-alert/delivery?cursor=cursor_abc&page_size=10',
        previous: null,
      },
    });
  });

  it('passes a single symbol with the default page size and keeps empty cursor state', async () => {
    mockGetUnifiedAlertDelivery.mockResolvedValue({
      results: [{ alert_id: '1', symbol: 'VNM' }],
      next: null,
      previous: null,
    });

    const response = await getUnifiedAlerts({ symbols: ['VNM'] });

    expect(mockGetUnifiedAlertDelivery).toHaveBeenCalledWith({
      symbol: 'VNM',
      severity: undefined,
      page_size: 20,
      cursor: undefined,
    });
    expect(response.data.results).toEqual([{ alert_id: '1', symbol: 'VNM' }]);
    expect(response.data.next_cursor).toBe(null);
    expect(response.data.has_more).toBe(false);
  });
});
