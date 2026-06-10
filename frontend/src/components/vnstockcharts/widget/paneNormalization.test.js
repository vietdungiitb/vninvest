import { normalizePaneDescriptorsForExplicitScaleSlots } from './paneNormalization';

describe('paneNormalization', () => {
  test('maps legacy BollingerBands types before the widget renders panes', () => {
    const panes = normalizePaneDescriptorsForExplicitScaleSlots([
      {
        id: 'price',
        label: 'Price',
        pinned: true,
        visible: true,
        heightRatio: 1,
        splitScale: false,
        tooltip: 'ohlc',
        series: [{ type: 'BollingerBands', yAxis: 'right' }],
      },
    ]);

    expect(panes[0].series).toHaveLength(1);
    expect(panes[0].series[0].type).toBe('BollingerBand');
  });
});