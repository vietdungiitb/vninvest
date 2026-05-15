import { socApi } from '../api/socApi';

const mockOkResponse = (payload = {}) => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(payload),
});

describe('socApi DataOps canonical routes', () => {
  let getItemSpy;

  beforeEach(() => {
    getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockReturnValue('test-token');
    global.fetch = jest.fn(() => mockOkResponse({ ok: true }));
  });

  afterEach(() => {
    getItemSpy.mockRestore();
    jest.clearAllMocks();
  });

  test.each([
    ['getDataOpsQueueTiers', [], '/core/v1/operator/scraping/dataops/queue-tiers/'],
    ['getDataOpsCoverage', [], '/core/v1/operator/scraping/dataops/coverage/'],
    ['getDataOpsRunLogs', [3], '/core/v1/operator/scraping/dataops/run-logs/?page=3'],
    ['getDataOpsRuntimeConfig', [], '/core/v1/operator/scraping/dataops/runtime-config/'],
  ])('calls canonical GET route for %s', async (methodName, args, expectedUrl) => {
    await socApi[methodName](...args);

    expect(global.fetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  test('calls SOC preview runtime config route', async () => {
    const config = { intraday_tick_retention_days: 7 };

    await socApi.previewDataOpsRuntimeConfig(config);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/soc/dataops/runtime-config/preview/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ config_payload: config }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  test('calls SOC runtime config audit route', async () => {
    await socApi.getDataOpsRuntimeConfigAudit(4);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/soc/dataops/runtime-config/audit/?page=4',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  test('calls canonical preview planner route', async () => {
    const payload = { symbols: ['FPT'], datasets: ['daily_prices'] };

    await socApi.previewDataOpsPlanner(payload);

    expect(global.fetch).toHaveBeenCalledWith(
      '/core/v1/operator/scraping/dataops/planner/preview/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  test('calls canonical planner run route', async () => {
    const payload = { symbols: ['HPG'], datasets: ['daily_prices'], execution_mode: 'async' };

    await socApi.runDataOpsPlanner(payload);

    expect(global.fetch).toHaveBeenCalledWith(
      '/core/v1/operator/scraping/dataops/planner/run/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  test('calls canonical runtime config apply route', async () => {
    const config = { decay_days: 7, hot_user_demand: { poll_interval_seconds: 20 } };

    await socApi.applyDataOpsRuntimeConfig(config);

    expect(global.fetch).toHaveBeenCalledWith(
      '/core/v1/operator/scraping/dataops/runtime-config/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ config_payload: config }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });
});