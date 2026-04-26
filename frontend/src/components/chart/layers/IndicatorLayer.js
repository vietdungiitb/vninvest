/**
 * IndicatorLayer - Dispatches indicator series generation.
 */
export const getIndicatorSeries = (indicatorData) => {
  if (!indicatorData) return [];

  let series = [];

  // Moving Averages
  if (indicatorData.ma20) {
    series.push({
      name: 'MA20',
      type: 'line',
      data: indicatorData.ma20.map(p => p.value),
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 1, color: '#2196f3' }
    });
  }

  if (indicatorData.ma50) {
    series.push({
      name: 'MA50',
      type: 'line',
      data: indicatorData.ma50.map(p => p.value),
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 1, color: '#ff9800' }
    });
  }

  // Bollinger Bands
  if (indicatorData.bollinger) {
    const { upper, middle, lower } = indicatorData.bollinger;
    series.push(
      {
        name: 'BB Middle',
        type: 'line',
        data: middle.map(p => p.value),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1, type: 'dashed', color: 'rgba(255, 255, 255, 0.3)' }
      },
      {
        name: 'BB Upper',
        type: 'line',
        data: upper.map(p => p.value),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 0.5, color: 'rgba(255, 255, 255, 0.2)' },
        stack: 'confidence-band',
        areaStyle: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      {
        name: 'BB Lower',
        type: 'line',
        data: lower.map(p => p.value),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 0.5, color: 'rgba(255, 255, 255, 0.2)' },
        stack: 'confidence-band'
      }
    );
  }

  return series;
};
