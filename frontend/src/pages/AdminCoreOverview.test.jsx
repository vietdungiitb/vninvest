import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCoreOverview from './AdminCoreOverview';
import { getCoreOperatorHealth, getCoreOperatorOverview } from '../api/client';
import { useI18n } from '../context/LangContext';

jest.mock('../api/client', () => ({
  getCoreOperatorHealth: jest.fn(),
  getCoreOperatorOverview: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

const mockGetCoreOperatorOverview = jest.requireMock('../api/client').getCoreOperatorOverview;
const mockGetCoreOperatorHealth = jest.requireMock('../api/client').getCoreOperatorHealth;

describe('AdminCoreOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'setInterval').mockImplementation(() => 1);
    jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatDateTime: () => '03/05/2026 09:00:00',
    });

    mockGetCoreOperatorOverview.mockResolvedValue({
      data: {
        object: 'operator_overview_snapshot',
        generated_at: '2026-05-03T09:00:00Z',
        health_status: 'degraded',
        summary_cards: [
          { key: 'operator_health', label: 'Trạng thái tổng quan', value: 'degraded', detail: '6/7 thành phần khỏe', status: 'degraded' },
          { key: 'realtime', label: 'Realtime', value: 'OK', detail: 'layer=redis', status: 'healthy' },
        ],
        health_cards: [
          { key: 'service', label: 'Core service', value: 'Healthy', detail: 'vninvest-backend', status: 'healthy' },
          { key: 'realtime', label: 'Realtime layer', value: 'Degraded', detail: 'redis ok', status: 'degraded' },
        ],
        sections: {
          health: {
            healthy_component_count: 6,
            degraded_component_count: 1,
            degraded_components: ['realtime'],
          },
          admin_runtime_kpi: {
            celery: { alive: true },
            market_observability: { overall: { http_requests: 12 } },
          },
          ai_runtime: {
            rollout_state: { ready: true },
          },
        },
      },
    });

    mockGetCoreOperatorHealth.mockResolvedValue({
      data: {
        object: 'operator_health_snapshot',
        generated_at: '2026-05-03T09:00:00Z',
        health_status: 'degraded',
        healthy_component_count: 6,
        degraded_component_count: 1,
        degraded_components: ['realtime'],
        components: [
          { key: 'service', label: 'Core service', healthy: true, status: 'healthy', detail: 'vninvest-backend' },
          { key: 'realtime', label: 'Realtime layer', healthy: false, status: 'degraded', detail: 'redis ok' },
        ],
        sources: {
          service: { status: 'ok' },
          realtime: { redis_ok: true, channel_layer_type: 'redis' },
          streams: { redis_ok: true },
          prefetch: { status: 'healthy' },
          market_observability: { overall: { http_requests: 12 } },
          admin_runtime_kpi: { celery: { alive: true } },
          ai_runtime: { rollout_state: { ready: true } },
        },
      },
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  it('renders the overview and runtime health snapshots', async () => {
    render(
      <MemoryRouter>
        <AdminCoreOverview />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tổng quan nền tảng')).toBeInTheDocument();
    expect(await screen.findByText('Trạng thái tổng quan')).toBeInTheDocument();
    expect(await screen.findByText('6/7 thành phần khỏe')).toBeInTheDocument();
    expect(screen.getByText('Tổng hợp điều hành')).toBeInTheDocument();
    expect(screen.getByText('Sức khỏe runtime')).toBeInTheDocument();
    expect(screen.getByText('Thành phần suy giảm: 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở trung tâm crawl' })).toHaveAttribute('href', '/admin/core/crawl-control');
    expect(mockGetCoreOperatorOverview).toHaveBeenCalledTimes(1);
    expect(mockGetCoreOperatorHealth).toHaveBeenCalledTimes(1);
  });
});