/**
 * Custom hook for converting intraday order data to ECharts bubble chart coordinates
 * Handles coordinate transformation, size normalization, and data categorization
 */
import { useMemo } from 'react';

const MARKET_OPEN_HOUR = 9;

export function useOrderBubbleCoordinates(orders, refPrice, sessionStart) {
  /**
   * Convert raw order data to bubble chart coordinates
   * 
   * @param {Array} orders - IntradayTick objects with ts, price, volume, side, matched_value
   * @param {Number} refPrice - Reference price for Y-axis centering
   * @param {Date|String} sessionStart - Session start time (9:00 AM)
   * @returns {Object} - {buy, sell, internal} arrays with coordinates
   */

  const bubbles = useMemo(() => {
    if (!orders || !sessionStart) {
      return { buy: [], sell: [], internal: [] };
    }

    const sessionStartDate = new Date(sessionStart);
    const hasReferencePrice = refPrice !== null && refPrice !== undefined && Number.isFinite(Number(refPrice));
    const categorized = { buy: [], sell: [], internal: [] };

    orders.forEach((order) => {
      try {
        // Parse timestamp
        const orderTime = new Date(order.ts);
        if (Number.isNaN(orderTime.getTime())) {
          return;
        }
        
        // X-axis: minutes since session start
        const timeDiff = orderTime - sessionStartDate;
        const xMinutes = timeDiff / (1000 * 60);
        
        // Y-axis: price difference from reference
        const priceNum = parseFloat(order.price);
        const refPriceNum = hasReferencePrice ? parseFloat(refPrice) : null;
        const yVnd = hasReferencePrice ? (priceNum - refPriceNum) : 0;
        const yPct = hasReferencePrice && refPriceNum ? (((priceNum - refPriceNum) / refPriceNum) * 100) : 0;
        
        // Size: normalize matched_value using adjusted sqrt for visual scaling
        const matchedValue = parseFloat(order.matched_value || (parseFloat(order.price) * parseFloat(order.volume)) || 0);
        const size = Math.max(6, Math.min(80, Math.sqrt(matchedValue) / 500)); 
        
        const bubble = {
          x: xMinutes,
          y: yVnd,
          yPct: yPct,
          yValue: matchedValue, // New Y-axis option: Trading Value
          value: [xMinutes, yVnd, size], // Default coordinates (legacy price delta)
          price: priceNum,
          volume: parseInt(order.volume),
          matchedValue,
          timestamp: orderTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          fullTimestamp: orderTime.toLocaleTimeString('vi-VN'),
          side: order.side,
          isLarge: matchedValue >= 1_000_000_000,
          isExtreme: order.is_extreme,
        };

        // Categorize by side
        const normalizedSide = String(order.side || '').trim().toLowerCase();
        if (normalizedSide === 'buy' || normalizedSide === 'bu' || normalizedSide === 'b') {
          categorized.buy.push(bubble);
        } else if (normalizedSide === 'sell' || normalizedSide === 'sd' || normalizedSide === 's') {
          categorized.sell.push(bubble);
        } else {
          categorized.internal.push(bubble);
        }
      } catch (error) {
        console.warn('[useOrderBubbleCoordinates] Error processing order:', error, order);
      }
    });

    return categorized;
  }, [orders, refPrice, sessionStart]);

  return bubbles;
}

/**
 * Format a number as Vietnamese currency
 */
export function formatVND(value) {
  if (value === null || value === undefined) return '--';
  if (Math.abs(value) >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + 'B';
  }
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(2) + 'k';
  }
  return value.toFixed(2);
}

/**
 * Format time delta in minutes
 */
export function formatTimeFromMinutes(minutes) {
  if (minutes < 60) {
    return `${Math.floor(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}h${mins}m`;
}
