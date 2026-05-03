import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminCoreAuditTrace from './AdminCoreAuditTrace';
import { getCoreOperatorAuditRequestDetail, getCoreOperatorAuditRequests } from '../api/client';
import { useI18n } from '../context/LangContext';

jest.mock('../api/client', () => ({
  getCoreOperatorAuditRequestDetail: jest.fn(),
  getCoreOperatorAuditRequests: jest.fn(),
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

const mockGetCoreOperatorAuditRequests = jest.requireMock('../api/client').getCoreOperatorAuditRequests;
const mockGetCoreOperatorAuditRequestDetail = jest.requireMock('../api/client').getCoreOperatorAuditRequestDetail;

describe('AdminCoreAuditTrace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatDateTime: () => '03/05/2026 09:00:00',
    });

    mockGetCoreOperatorAuditRequests.mockResolvedValue({
      data: {
        object: 'list',
        url: '/api/core/v1/operator/audit/requests/',
        summary_cards: [
          { key: 'audit_total', label: 'Tổng audit', value: 2, detail: 'Các audit trace operator đang hiển thị' },
          { key: 'audit_advisory', label: 'Advisory', value: 1, detail: 'AdvisoryAggregateAuditLog' },
          { key: 'audit_crawl', label: 'Crawl', value: 1, detail: 'CrawlAuditLog' },
        ],
        data: [
          {
            object: 'operator_audit_request',
            id: 'advisory:10',
            request_id: 'advisory:10',
            kind: 'advisory',
            source_model: 'AdvisoryAggregateAuditLog',
            action: 'manual_refresh',
            actor: 'operator-admin',
            actor_id: '1',
            user_id: 1,
            symbol: 'VNM',
            reason: 'Làm mới tư vấn',
            summary: 'manual_refresh - VNM',
            before_state_json: { status: 'draft' },
            after_state_json: { status: 'published' },
            metadata_json: { source: 'operator-jobs-audit-test' },
            created_at: '2026-05-03T08:00:00Z',
          },
          {
            object: 'operator_audit_request',
            id: 'crawl_audit:11',
            request_id: 'crawl_audit:11',
            kind: 'crawl_audit',
            source_model: 'CrawlAuditLog',
            event: 'run_started',
            run_id: 4,
            job_id: 5,
            service_code: 'crawl_alpha',
            summary: 'run_started - crawl_alpha',
            payload: { service_code: 'crawl_alpha', step: 'bootstrap' },
            timestamp: '2026-05-03T07:00:00Z',
            created_at: '2026-05-03T07:00:00Z',
          },
        ],
        has_more: false,
        next_cursor: null,
        prev_cursor: null,
      },
    });

    mockGetCoreOperatorAuditRequestDetail.mockImplementation(async (requestId) => {
      if (requestId === 'advisory:10') {
        return {
          data: {
            object: 'operator_audit_request_detail',
            request_id: 'advisory:10',
            request: {
              object: 'operator_audit_request',
              id: 'advisory:10',
              request_id: 'advisory:10',
              kind: 'advisory',
              source_model: 'AdvisoryAggregateAuditLog',
              action: 'manual_refresh',
              actor: 'operator-admin',
              actor_id: '1',
              user_id: 1,
              symbol: 'VNM',
              reason: 'Làm mới tư vấn',
              summary: 'manual_refresh - VNM',
              created_at: '2026-05-03T08:00:00Z',
            },
            source_record: {
              before_state_json: { status: 'draft' },
              after_state_json: { status: 'published' },
              metadata_json: { source: 'operator-jobs-audit-test' },
            },
          },
        };
      }

      return {
        data: {
          object: 'operator_audit_request_detail',
          request_id: 'crawl_audit:11',
          request: {
            object: 'operator_audit_request',
            id: 'crawl_audit:11',
            request_id: 'crawl_audit:11',
            kind: 'crawl_audit',
            source_model: 'CrawlAuditLog',
            event: 'run_started',
            run_id: 4,
            job_id: 5,
            service_code: 'crawl_alpha',
            summary: 'run_started - crawl_alpha',
            created_at: '2026-05-03T07:00:00Z',
          },
          source_record: {
            payload: { service_code: 'crawl_alpha', step: 'bootstrap' },
            run: { id: 4, job_id: 5, service_code: 'crawl_alpha', status: 'success' },
          },
        },
      };
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  it('renders the audit trace table, summary cards, and detail panel', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/audit/requests']}>
        <Routes>
          <Route path="/admin/core/audit/requests" element={<AdminCoreAuditTrace />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Truy vết audit')).toBeInTheDocument();
    expect(await screen.findByText('Tổng audit')).toBeInTheDocument();
    expect((await screen.findAllByText('advisory:10')).length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText('crawl_audit:11')).toBeInTheDocument();
    expect(await screen.findByText('Chi tiết audit trace')).toBeInTheDocument();
    expect(await screen.findByText('Làm mới tư vấn')).toBeInTheDocument();
    expect(mockGetCoreOperatorAuditRequests).toHaveBeenCalledWith({ limit: 25 });
    expect(mockGetCoreOperatorAuditRequestDetail).toHaveBeenCalledWith('advisory:10');
  });

  it('loads a different audit detail when another row is selected', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/core/audit/requests']}>
        <Routes>
          <Route path="/admin/core/audit/requests" element={<AdminCoreAuditTrace />} />
        </Routes>
      </MemoryRouter>,
    );

    const detailButtons = await screen.findAllByRole('button', { name: 'Xem chi tiết' });
    fireEvent.click(detailButtons[1]);

    expect(await screen.findByText('crawl_alpha')).toBeInTheDocument();
    expect(mockGetCoreOperatorAuditRequestDetail).toHaveBeenCalledWith('crawl_audit:11');
  });
});