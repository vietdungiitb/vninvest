import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { createTranslator } from '../../i18n';
import vi from '../../i18n/vi';
import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';
import DataOpsPanel from './DataOpsPanel';
import MatrixPanel from './MatrixPanel';
import { MatrixScrapeMonitor } from './MatrixScrapeMonitor';
import { OwnershipBadgeRow } from './OwnershipBadgeRow';
import { ServiceHealthCard } from './ServiceHealthCard';
import { SOCDomainTabs } from './SOCDomainTabs';
import { WriteGuardBanner } from './WriteGuardBanner';

jest.mock('../../api/socApi', () => ({
  socApi: {
    applyDataOpsRuntimeConfig: jest.fn(),
    getDataOpsCoverage: jest.fn(),
    getDataOpsQueueTiers: jest.fn(),
    getDataOpsRuntimeConfig: jest.fn(),
    getMatrixMonitor: jest.fn(),
    getMatrixProviders: jest.fn(),
    startMatrixCycle: jest.fn(),
    abortMatrixCycle: jest.fn(),
  },
}));

const t = createTranslator('vi');

describe('SOC component contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'setInterval').mockImplementation(() => 1);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders ServiceHealthCard with localized health metadata', () => {
    render(
      <ServiceHealthCard
        service={{
          name: 'Matrix Coordinator',
          service_key: 'matrix_cycle_coordinator',
          domain: 'matrix',
        }}
        health={{
          status: 'healthy',
          avg_response_ms: 12.6,
          last_check_at: '2026-05-14T10:00:00Z',
        }}
        t={t}
      />
    );

    expect(screen.getByText('Matrix Coordinator')).toBeInTheDocument();
    expect(screen.getByText('matrix_cycle_coordinator • matrix')).toBeInTheDocument();
    expect(screen.getAllByText('Hoạt động tốt')).toHaveLength(2);
    expect(screen.getByText('13ms')).toBeInTheDocument();
    expect(screen.getByText('2026-05-14T10:00:00Z')).toBeInTheDocument();
  });

  it('renders OwnershipBadgeRow with writer and locked-field metadata', () => {
    render(
      <OwnershipBadgeRow
        domain="signals"
        ownership={{
          mode: 'bridge-write',
          owner_team: 'signal_intelligence',
          can_apply: false,
          write_surface: 'signal_intelligence app',
          locked_fields: ['whale_threshold_vnd'],
        }}
        t={t}
      />
    );

    expect(screen.getByText('signals')).toBeInTheDocument();
    expect(screen.getByText('bridge-write')).toBeInTheDocument();
    expect(screen.getByText(/Thuộc về: signal_intelligence/i)).toBeInTheDocument();
    expect(screen.getByText(/Chỉ đọc/i)).toBeInTheDocument();
    expect(screen.getByText(/whale_threshold_vnd/i)).toBeInTheDocument();
  });

  it('renders WriteGuardBanner with reason, writer, and write surface', () => {
    render(
      <WriteGuardBanner
        reason="SOC không thể ghi trực tiếp."
        writer="signal_intelligence"
        writeSurface="signal_intelligence app"
        t={t}
      />
    );

    expect(screen.getByText('Ghi bị chặn có chủ đích')).toBeInTheDocument();
    expect(screen.getByText('SOC không thể ghi trực tiếp.')).toBeInTheDocument();
    expect(screen.getByText(/Bộ phận ghi:/i)).toBeInTheDocument();
    expect(screen.getByText(/signal_intelligence app/i)).toBeInTheDocument();
  });

  it('renders ConfigPreviewModal warnings and validation errors', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(
      <ConfigPreviewModal
        isOpen
        before={{ primary_provider: 'vci' }}
        after={{ primary_provider: 'kbs' }}
        onClose={jest.fn()}
        onConfirm={onConfirm}
        changeSummary={['primary_provider']}
        impactWarnings={['Thay đổi provider sẽ ảnh hưởng runtime.']}
        validationErrors={{ config_payload: ['Provider chưa hợp lệ'] }}
        domain="dataops"
        isSubmitting={false}
        t={t}
      />
    );

    expect(screen.getByText('Xem trước cấu hình')).toBeInTheDocument();
    expect(screen.getByText('Tóm tắt thay đổi')).toBeInTheDocument();
    expect(screen.getByText('Cảnh báo tác động')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kiểm tra')).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Xác nhận áp dụng' });
    expect(confirmButton).toBeDisabled();

    await user.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders six SOC tabs and emits the clicked domain key', async () => {
    const user = userEvent.setup();
    const onDomainChange = jest.fn();

    render(
      <SOCDomainTabs
        activeDomain="signals"
        onDomainChange={onDomainChange}
        t={t}
      />
    );

    ['Tổng quan', 'Tín hiệu', 'DataOps', 'Prefetch', 'Screener', 'Ma trận'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Ma trận' }));
    expect(onDomainChange).toHaveBeenCalledWith('matrix');
  });

  it('renders DataOpsPanel queue tiers and applies runtime config after preview', async () => {
    const user = userEvent.setup();
    socApi.getDataOpsQueueTiers
      .mockResolvedValueOnce({
        tiers: [
          {
            tier: 'hot_user_demand',
            symbol_count: 2,
            poll_interval_seconds: 30,
            max_batch_size: 50,
            examples: ['FPT', 'HPG'],
          },
        ],
        updated_at: '2026-05-15T11:00:00Z',
      })
      .mockResolvedValueOnce({
        tiers: [
          {
            tier: 'hot_user_demand',
            symbol_count: 2,
            poll_interval_seconds: 20,
            max_batch_size: 60,
            examples: ['FPT', 'HPG'],
          },
        ],
        updated_at: '2026-05-15T11:05:00Z',
      });
    socApi.getDataOpsRuntimeConfig.mockResolvedValue({
      config: {
        decay_days: 7,
        hot_user_demand: { poll_interval_seconds: 30, max_batch_size: 50 },
        warm_liquid_market: { poll_interval_seconds: 120, max_batch_size: 100 },
        cold_full_market: { poll_interval_seconds: 900, max_batch_size: 200 },
        recovery_backlog: { poll_interval_seconds: 600, max_batch_size: 50 },
      },
      ownership: {
        domain: 'dataops_market_data',
        mode: 'canonical',
        owner_team: 'market_data',
        can_apply: true,
        write_surface: 'soc_dataops',
        locked_fields: [],
      },
      updated_at: '2026-05-15T11:00:00Z',
    });
    socApi.getDataOpsCoverage.mockResolvedValue({
      datasets: [
        {
          dataset: 'daily_prices',
          fresh: 1,
          warm: 0,
          stale: 0,
          missing: 1,
          error: 0,
          unknown: 0,
        },
      ],
      top_gaps: [
        {
          symbol: 'AAA',
          dataset: 'daily_prices',
          freshness_state: 'missing',
          next_recommended_action: 'hydrate_daily_prices',
        },
      ],
      updated_at: '2026-05-15T11:02:00Z',
    });
    socApi.applyDataOpsRuntimeConfig.mockResolvedValue({
      config: {
        decay_days: 9,
        hot_user_demand: { poll_interval_seconds: 20, max_batch_size: 60 },
        warm_liquid_market: { poll_interval_seconds: 120, max_batch_size: 100 },
        cold_full_market: { poll_interval_seconds: 900, max_batch_size: 200 },
        recovery_backlog: { poll_interval_seconds: 600, max_batch_size: 50 },
      },
      ownership: {
        domain: 'dataops_market_data',
        mode: 'canonical',
        owner_team: 'market_data',
        can_apply: true,
        write_surface: 'soc_dataops',
        locked_fields: [],
      },
      updated_at: '2026-05-15T11:05:00Z',
    });

    render(<DataOpsPanel t={t} />);

    expect(await screen.findByText('Điều phối dữ liệu thị trường')).toBeInTheDocument();
    expect(screen.getByText('Nhu cầu người dùng nóng')).toBeInTheDocument();
    expect(screen.getByText('Độ phủ dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('AAA')).toBeInTheDocument();
    expect(screen.getByText('FPT')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cấu hình runtime'), {
      target: {
        value: JSON.stringify({
          decay_days: 9,
          hot_user_demand: { poll_interval_seconds: 20, max_batch_size: 60 },
          warm_liquid_market: { poll_interval_seconds: 120, max_batch_size: 100 },
          cold_full_market: { poll_interval_seconds: 900, max_batch_size: 200 },
          recovery_backlog: { poll_interval_seconds: 600, max_batch_size: 50 },
        }, null, 2),
      },
    });

    await user.click(screen.getByRole('button', { name: 'Xem trước' }));

    expect(await screen.findByText('Xem trước cấu hình')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Xác nhận áp dụng' }));

    await waitFor(() => {
      expect(socApi.applyDataOpsRuntimeConfig).toHaveBeenCalledWith(
        expect.objectContaining({ decay_days: 9 }),
      );
    });

    expect(await screen.findByText('Đã áp dụng cấu hình DataOps thị trường.')).toBeInTheDocument();
  });

  it('renders MatrixScrapeMonitor as a provider-by-group heatmap and completes on terminal status', async () => {
    const onCycleComplete = jest.fn();
    socApi.getMatrixMonitor.mockResolvedValue({
      status: 'completed',
      cells_summary: {
        done: 1,
        failed: 1,
        pending: 0,
        claimed: 0,
        working: 0,
      },
      cells: [
        { group: 'vn30', symbol_group_id: 'vn30', provider: 'vci', status: 'done' },
        { group: 'vn30', symbol_group_id: 'vn30', provider: 'kbs', status: 'failed' },
      ],
    });

    render(
      <MatrixScrapeMonitor
        cycleId="cycle_20260514_001"
        pollIntervalMs={5000}
        onCycleComplete={onCycleComplete}
        t={t}
      />
    );

    expect(await screen.findByText('Theo dõi quét ma trận')).toBeInTheDocument();
    expect(await screen.findByText('vn30')).toBeInTheDocument();
    expect(await screen.findByText('done')).toBeInTheDocument();
    expect(await screen.findByText('failed')).toBeInTheDocument();

    await waitFor(() => {
      expect(socApi.getMatrixMonitor).toHaveBeenCalledWith('cycle_20260514_001');
      expect(onCycleComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('renders MatrixPanel runtime contract and ignores stale providers from terminal cycles', async () => {
    socApi.getMatrixProviders.mockResolvedValue({
      providers: [
        {
          provider: 'vci',
          label: 'VCI',
          runtime_ready: true,
          readiness_reason: 'Provider sẵn sàng cho runtime hiện tại.',
          default_selected: true,
          in_active_cycle: false,
        },
        {
          provider: 'kbs',
          label: 'KBS',
          runtime_ready: true,
          readiness_reason: 'Provider sẵn sàng cho runtime hiện tại.',
          default_selected: true,
          in_active_cycle: false,
        },
        {
          provider: 'dnse',
          label: 'DNSE',
          runtime_ready: false,
          readiness_reason: 'Thiếu runtime secret.',
          default_selected: false,
          in_active_cycle: false,
        },
      ],
    });
    socApi.getMatrixMonitor.mockImplementation(() => Promise.resolve({
      cycle_id: 'cycle_20260514_001',
      status: 'aborted',
      providers: ['vci', 'tcbs', 'ssi'],
      symbol_groups: [
        { id: 'top100', name: 'Top 100' },
        { id: 'vn30', name: 'VN30' },
      ],
      cells_summary: {
        done: 0,
        failed: 0,
        pending: 0,
        claimed: 0,
        working: 0,
      },
      cells: [],
    }));

    render(<MatrixPanel t={t} />);

    expect(await screen.findByText('Cách matrix chạy')).toBeInTheDocument();
    expect(screen.getByText('service_ops.run_scrape_cycle')).toBeInTheDocument();
    expect(screen.getByText('service_ops.scrape_cell_task')).toBeInTheDocument();
    expect(screen.getByText('fetch_listing_symbols()')).toBeInTheDocument();
    expect(screen.getByText('fetch_price_board_snapshot()')).toBeInTheDocument();
    expect(screen.getByText('Top 100')).toBeInTheDocument();
    expect(screen.getByText('VN30')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /VCI/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /KBS/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /DNSE/i })).not.toBeChecked();
    expect(screen.getByText('Đã hủy')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có cycle')).toHaveLength(2);
  });

  it('keeps the required Vietnamese soc namespace keys', () => {
    expect(vi.soc.tab.dataops).toBe('DataOps');
    expect(vi.soc.preview.validation_errors).toBe('Lỗi kiểm tra');
    expect(vi.soc.guard.writer).toBe('Bộ phận ghi');
    expect(vi.soc.matrix.symbol_group).toBe('Nhóm mã');
    expect(vi.soc.matrix.runtime_summary_title).toBe('Cách matrix chạy');
  });
});