import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { socApi } from '../api/socApi';
import { useI18n } from '../context/LangContext';
import { createTranslator } from '../i18n';
import SOCPage from './SOCPage';

jest.mock('../api/socApi', () => ({
  socApi: {
    getServiceList: jest.fn(),
  },
}));

jest.mock('../context/LangContext', () => ({
  useI18n: jest.fn(),
}));

jest.mock('../components/soc/OverviewPanel', () => () => <div data-testid="overview-panel">overview panel</div>);
jest.mock('../components/soc/DataOpsPanel', () => () => <div data-testid="dataops-panel">dataops panel</div>);
jest.mock('../components/soc/PrefetchPanel', () => () => <div data-testid="prefetch-panel">prefetch panel</div>);
jest.mock('../components/soc/SignalsPanel', () => () => <div data-testid="signals-panel">signals panel</div>);
jest.mock('../components/soc/ScreenerPanel', () => () => <div data-testid="screener-panel">screener panel</div>);
jest.mock('../components/soc/MatrixPanel', () => () => <div data-testid="matrix-panel">matrix panel</div>);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderSOCPage(initialEntry) {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/operations-center"
          element={(
            <>
              <SOCPage />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('SOCPage routing and tab behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({ t: createTranslator('vi') });
    socApi.getServiceList.mockResolvedValue({
      results: [{ service_key: 'signal_whale_detector', name: 'Signals', domain: 'signals' }],
    });
  });

  it('renders the six tabs and switches panels using the ?tab= contract', async () => {
    const user = userEvent.setup();
    renderSOCPage('/operations-center?tab=signals');

    expect(await screen.findByRole('heading', { name: 'Trung tâm Hoạt động Dịch vụ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tín hiệu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DataOps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prefetch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Screener' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ma trận' })).toBeInTheDocument();
    expect(await screen.findByTestId('signals-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'DataOps' }));

    expect(await screen.findByTestId('dataops-panel')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=dataops');
    });
  });

  it('accepts legacy ?domain= and normalizes to ?tab= on the next tab switch', async () => {
    const user = userEvent.setup();
    renderSOCPage('/operations-center?domain=signals');

    expect(await screen.findByTestId('signals-panel')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Screener' }));

    expect(await screen.findByTestId('screener-panel')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=screener');
      expect(screen.getByTestId('location-search')).not.toHaveTextContent('domain=');
    });
  });

  it('defaults to overview when no tab is supplied', async () => {
    renderSOCPage('/operations-center');

    expect(await screen.findByTestId('overview-panel')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });
});