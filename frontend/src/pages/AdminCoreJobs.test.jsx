import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCoreJobs from './AdminCoreJobs';
import { getCoreOperatorJobs } from '../api/client';
import { useI18n } from '../context/LangContext';

jest.mock('../api/client', () => ({
  getCoreOperatorJobs: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

const mockGetCoreOperatorJobs = jest.requireMock('../api/client').getCoreOperatorJobs;

describe('AdminCoreJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatDateTime: () => '03/05/2026 09:00:00',
    });

    mockGetCoreOperatorJobs.mockResolvedValue({
      data: {
        object: 'list',
        url: '/api/core/v1/operator/jobs/',
        summary_cards: [
          { key: 'job_total', label: 'Tổng job', value: 2, detail: 'Các lượt chạy đang hiển thị' },
          { key: 'job_signal', label: 'Lệnh signal', value: 1, detail: 'SignalServiceRun' },
          { key: 'job_crawl', label: 'Lệnh crawl', value: 1, detail: 'CrawlRun' },
        ],
        data: [
          {
            object: 'operator_job',
            id: 'signal_run:1',
            request_id: 'signal_run:1',
            kind: 'signal_run',
            source_model: 'SignalServiceRun',
            service_domain: 'whale',
            service_domain_display: 'Whale',
            run_type: 'manual',
            run_type_display: 'Thủ công',
            status: 'running',
            status_category: 'running',
            status_display: 'Đang chạy',
            task_id: 'task-signal-001',
            progress_pct: 42.5,
            processed_items: 7,
            stored_items: 3,
            failed_items: 0,
            created_by_username: 'operator-admin',
            summary: 'Whale - Thủ công',
            log_excerpt: 'signal job is running',
            created_at: '2026-05-03T08:00:00Z',
            updated_at: '2026-05-03T08:05:00Z',
            started_at: '2026-05-03T08:00:05Z',
            finished_at: null,
          },
          {
            object: 'operator_job',
            id: 'crawl_run:2',
            request_id: 'crawl_run:2',
            kind: 'crawl_run',
            source_model: 'CrawlRun',
            service_code: 'crawl_alpha',
            job_description: 'Operator jobs audit crawl',
            trigger_type: 'manual',
            trigger_type_display: 'Thủ công',
            task_id: 'task-crawl-001',
            status: 'success',
            status_category: 'completed',
            status_display: 'Hoàn thành',
            summary: 'crawl_alpha - Thủ công',
            log_excerpt: 'crawl completed successfully',
            created_at: '2026-05-03T07:30:00Z',
            updated_at: '2026-05-03T07:35:00Z',
            started_at: '2026-05-03T07:30:05Z',
            finished_at: '2026-05-03T07:35:00Z',
          },
        ],
        has_more: false,
        next_cursor: null,
        prev_cursor: null,
      },
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  it('renders the jobs table, summary cards, and detail panel', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/runtime/jobs']}>
        <Routes>
          <Route path="/admin/core/runtime/jobs" element={<AdminCoreJobs />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Bảng jobs và materializer')).toBeInTheDocument();
    expect(await screen.findByText('Tổng job')).toBeInTheDocument();
    expect((await screen.findAllByText('signal_run:1')).length).toBeGreaterThanOrEqual(3);
    expect(await screen.findByText('crawl_run:2')).toBeInTheDocument();
    expect(await screen.findByText('Chi tiết job')).toBeInTheDocument();
    expect(await screen.findByText('Whale')).toBeInTheDocument();
    expect(mockGetCoreOperatorJobs).toHaveBeenCalledWith({ limit: 25 });
  });

  it('switches the detail panel when another job is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/runtime/jobs']}>
        <Routes>
          <Route path="/admin/core/runtime/jobs" element={<AdminCoreJobs />} />
        </Routes>
      </MemoryRouter>,
    );

    const detailButtons = await screen.findAllByRole('button', { name: 'Xem chi tiết' });
    fireEvent.click(detailButtons[1]);

    expect(await screen.findByText('crawl_alpha')).toBeInTheDocument();
    expect((await screen.findAllByText('crawl_alpha - Thủ công')).length).toBeGreaterThanOrEqual(2);
  });
});