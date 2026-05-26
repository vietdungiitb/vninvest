import React from 'react';
import { render } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import { StockDetailPage } from '@vninvest/web';

import StockDetailPageHost from './StockDetailPageHost';
import { packageShellHostEnv } from './packageShellHostRuntime';

jest.mock('@vninvest/web', () => ({
  __esModule: true,
  StockDetailPage: jest.fn(({ symbol }) => (
    <div data-testid="stock-detail-page">Stock detail package page {symbol}</div>
  )),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
}));

describe('StockDetailPageHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('delegates /stocks/:symbol to the package StockDetailPage with normalized symbol', () => {
    useParams.mockReturnValue({ symbol: 'fpt' });

    render(<StockDetailPageHost />);

    expect(StockDetailPage).toHaveBeenCalledTimes(1);
    expect(StockDetailPage.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        env: packageShellHostEnv,
        symbol: 'FPT',
      }),
    );
  });
});