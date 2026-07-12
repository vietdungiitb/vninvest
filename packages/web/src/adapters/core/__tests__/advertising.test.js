import { jest } from '@jest/globals';
import { createAdvertisingClient } from '../advertising.js';

describe('advertising adapter', () => {
  function makeCore() {
    const calls = [];
    const core = {
      calls,
      coreGet: jest.fn(async (path) => {
        calls.push({ method: 'GET', path });
        return { ok: true };
      }),
      corePost: jest.fn(async (path, body) => {
        calls.push({ method: 'POST', path, body });
        return { ok: true };
      }),
      corePatch: jest.fn(async (path, body) => {
        calls.push({ method: 'PATCH', path, body });
        return { ok: true };
      }),
      coreDelete: jest.fn(async (path) => {
        calls.push({ method: 'DELETE', path });
        return { ok: true };
      }),
    };
    return core;
  }

  describe('Campaign CRUD', () => {
    it('lists campaigns with query params', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await client.getAdvertisingCampaigns({ status: 'active', limit: 10 });
      expect(core.coreGet).toHaveBeenCalledWith('/operator/ads/campaigns/?status=active&limit=10');
    });

    it('omits null params', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await client.getAdvertisingCampaigns({ status: null });
      expect(core.coreGet).toHaveBeenCalledWith('/operator/ads/campaigns/');
    });

    it('fetches a single campaign', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await client.getAdvertisingCampaign('abc');
      expect(core.coreGet).toHaveBeenCalledWith('/operator/ads/campaigns/abc/');
    });

    it('throws when fetching without id', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await expect(client.getAdvertisingCampaign()).rejects.toThrow('id is required');
    });

    it('creates a campaign', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      const payload = { name: 'SSI Promo' };
      await client.createAdvertisingCampaign(payload);
      expect(core.corePost).toHaveBeenCalledWith('/operator/ads/campaigns/', payload);
    });

    it('updates a campaign', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await client.updateAdvertisingCampaign('abc', { name: 'X' });
      expect(core.corePatch).toHaveBeenCalledWith('/operator/ads/campaigns/abc/', { name: 'X' });
    });

    it('deletes a campaign', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await client.deleteAdvertisingCampaign('abc');
      expect(core.coreDelete).toHaveBeenCalledWith('/operator/ads/campaigns/abc/');
    });
  });

  describe('Analytics', () => {
    it('fetches analytics with params', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await client.getCampaignAnalytics({ days: 7 });
      expect(core.coreGet).toHaveBeenCalledWith('/operator/ads/analytics/?days=7');
    });
  });

  describe('Trademark config', () => {
    it('reads widget config', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      await client.getTrademarkConfig();
      expect(core.coreGet).toHaveBeenCalledWith('/widget/config');
    });

    it('patches trademark config', async () => {
      const core = makeCore();
      const client = createAdvertisingClient(core);
      const payload = { enabled: true, activation_ts: 1700000000000 };
      await client.updateTrademarkConfig(payload);
      expect(core.corePatch).toHaveBeenCalledWith('/widget/config', payload);
    });
  });
});
