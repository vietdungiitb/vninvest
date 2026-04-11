jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    post: jest.fn(),
  },
  create: jest.fn(),
  post: jest.fn(),
}));

describe('getUnifiedAlerts', () => {
  let getUnifiedAlerts;
  let mockGet;

  beforeEach(() => {
    jest.resetModules();

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

    mockGet = mockApiClient.get;
    ({ getUnifiedAlerts } = require('./client'));
  });

  it('builds query with symbols, watchlist ids, severity, limit and cursor', async () => {
    await getUnifiedAlerts({
      symbols: ['FPT', 'HPG'],
      watchlistGroupIds: [1, 7],
      window: '5d',
      severityMin: 'high',
      limit: 10,
      cursor: 'cursor_abc',
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      '/realtime/unified-alerts/?symbols=FPT%2CHPG&watchlist_group_ids=1%2C7&window=5d&severity_min=high&limit=10&cursor=cursor_abc'
    );
  });

  it('omits cursor when not provided and keeps defaults', async () => {
    await getUnifiedAlerts({ symbols: ['VNM'] });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      '/realtime/unified-alerts/?symbols=VNM&window=session&severity_min=low&limit=20'
    );
  });
});
