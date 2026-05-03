import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import StickyAlertBar from './StickyAlertBar';

const mockUseI18n = jest.fn();

jest.mock('../context/LangContext', () => ({
  useI18n: () => mockUseI18n(),
}));

describe('StickyAlertBar', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue({
      t: (key, params) => params?.defaultValue || key,
      formatTime: (value) => `TIME:${value}`,
    });
  });

  it('renders only the top 3 alerts in sticky order', () => {
    render(
      <MemoryRouter>
        <StickyAlertBar
          alerts={[
            { id: 'a1', symbol: 'FPT', severity: 'critical', type: 'buy', ts: '2026-05-03T09:00:00Z', to: '/stocks/FPT' },
            { id: 'a2', symbol: 'VNM', severity: 'high', type: 'sell', ts: '2026-05-03T09:05:00Z', to: '/stocks/VNM' },
            { id: 'a3', symbol: 'MBB', severity: 'medium', type: 'flow', ts: '2026-05-03T09:10:00Z', to: '/stocks/MBB' },
            { id: 'a4', symbol: 'VCB', severity: 'low', type: 'neutral', ts: '2026-05-03T09:15:00Z', to: '/stocks/VCB' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('sticky-alert-bar').className).toContain('sticky');
    expect(screen.getByText('Thanh cảnh báo ghim')).toBeTruthy();
    expect(screen.getByText('FPT')).toBeTruthy();
    expect(screen.getByText('VNM')).toBeTruthy();
    expect(screen.getByText('MBB')).toBeTruthy();
    expect(screen.queryByText('VCB')).toBeNull();
    expect(screen.getByText('TIME:2026-05-03T09:00:00Z')).toBeTruthy();
  });
});