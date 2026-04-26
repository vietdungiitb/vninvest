import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import PropTypes from 'prop-types';
import { getPriceSeries, getVolumeSeries } from './layers/PriceLayer';
import { getIndicatorSeries } from './layers/IndicatorLayer';

/**
 * TechnicalChartContainer - Modern ECharts wrapper for financial charts.
 * Following React 19 patterns: ref as direct prop, useRef(null).
 */
const TechnicalChartContainer = ({ 
  data, 
  indicators = [], 
  onPointHover,
  className = '',
  height = 450,
  theme = 'dark'
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const option = useMemo(() => {
    if (!data || !data.points || data.points.length === 0) return {};

    const dates = data.points.map(p => p.date);
    const values = data.points.map(p => [p.open, p.close, p.low, p.high, p.volume]);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        borderColor: '#333',
        textStyle: { color: '#ccc' },
        formatter: (params) => {
          // Custom tooltip logic will go here in Slice 3
          return params[0].name;
        }
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#777' }
      },
      grid: [
        { left: '3%', right: '3%', height: '65%', top: '10%' },
        { left: '3%', right: '3%', top: '78%', height: '15%' }
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false, lineStyle: { color: '#444' } },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax'
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          min: 'dataMin',
          max: 'dataMax'
        }
      ],
      yAxis: [
        {
          scale: true,
          splitLine: { lineStyle: { color: '#222' } },
          axisLine: { lineStyle: { color: '#444' } }
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        }
      ],
      series: [
        ...getPriceSeries(data),
        ...getVolumeSeries(data),
        ...getIndicatorSeries(data.indicator_series)
      ]
    };
  }, [data, indicators, theme]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, theme);
    }

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option, theme]);

  return (
    <div 
      ref={chartRef} 
      className={`technical-chart-container ${className}`}
      style={{ width: '100%', height: `${height}px` }}
    />
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
TechnicalChartContainer.propTypes = {
  data: PropTypes.object.isRequired,
  indicators: PropTypes.array,
  onPointHover: PropTypes.func,
  className: PropTypes.string,
  height: PropTypes.number,
  theme: PropTypes.string
};

export default TechnicalChartContainer;
