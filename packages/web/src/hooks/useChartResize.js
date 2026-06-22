/**
 * useChartResize - Hook for handling chart resize when sidebar collapses/expands
 * Uses ResizeObserver to detect container size changes and trigger chart resize
 */
import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to observe container resize and trigger chart resize
 * @param {React.RefObject} chartRef - Ref to the chart instance (ECharts, etc.)
 * @param {React.RefObject} containerRef - Ref to the container element
 * @param {Array} dependencies - Additional dependencies to re-observe
 */
export function useChartResize(chartRef, containerRef, dependencies = []) {
  const resizeObserverRef = useRef(null);

  const resizeChart = useCallback(() => {
    if (chartRef.current && typeof chartRef.current.resize === 'function') {
      chartRef.current.resize();
    }
  }, [chartRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create ResizeObserver
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          // Debounce resize calls
          requestAnimationFrame(() => {
            resizeChart();
          });
        }
      }
    });

    // Start observing
    resizeObserverRef.current.observe(container);

    // Cleanup
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [containerRef, resizeChart, ...dependencies]);

  // Return manual resize function for external triggers
  return { resizeChart };
}

/**
 * Hook for ECharts specifically - handles both container and chart instance
 * @param {React.RefObject} echartsRef - Ref to ReactEChartsCore component
 * @param {React.RefObject} containerRef - Ref to container div
 * @param {Array} dependencies - Additional dependencies
 */
export function useEChartsResize(echartsRef, containerRef, dependencies = []) {
  const { resizeChart } = useChartResize(echartsRef, containerRef, dependencies);

  // ECharts specific: also listen for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      // Trigger resize on theme change to ensure proper rendering
      setTimeout(resizeChart, 0);
    };

    // Listen for dark mode changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, [resizeChart]);

  return { resizeChart };
}

export default useChartResize;