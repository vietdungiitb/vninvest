/**
 * PriceLayer - Handles candlestick and basic price-linked visuals.
 */
export const getPriceSeries = (data) => {
  if (!data || !data.points) return [];

  const values = data.points.map(p => [p.open, p.close, p.low, p.high]);

  return [
    {
      name: 'Price',
      type: 'candlestick',
      data: values,
      itemStyle: {
        color: '#ef5350', // Bearish
        color0: '#26a69a', // Bullish
        borderColor: '#ef5350',
        borderColor0: '#26a69a'
      },
      emphasis: {
        itemStyle: {
          borderWidth: 2
        }
      }
    }
  ];
};

/**
 * VolumeLayer - Handles the volume bars usually in the bottom grid.
 */
export const getVolumeSeries = (data, gridIndex = 1, xAxisIndex = 1, yAxisIndex = 1) => {
  if (!data || !data.points) return [];

  return [
    {
      name: 'Volume',
      type: 'bar',
      xAxisIndex,
      yAxisIndex,
      data: data.points.map(p => p.volume),
      itemStyle: {
        color: (params) => {
          const p = data.points[params.dataIndex];
          return p.close >= p.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)';
        }
      }
    }
  ];
};
