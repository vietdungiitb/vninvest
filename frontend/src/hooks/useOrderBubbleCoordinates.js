/**
 * Custom hook for converting intraday order data to ECharts bubble chart coordinates
 * Handles coordinate transformation, size normalization, and data categorization
 */
import { useMemo } from 'react';

const MARKET_OPEN_HOUR = 9;
const ONE_BILLION_VND = 1_000_000_000;
const BUBBLE_MIN_DIAMETER = 12;
const BUBBLE_MAX_DIAMETER = 88;
const BUBBLE_DIAMETER_PER_BILLION = 16;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function baseColorBySide(side) {
  const normalized = String(side || '').trim().toLowerCase();
  if (normalized === 'buy' || normalized === 'bu' || normalized === 'b') return '#10b981';
  if (normalized === 'sell' || normalized === 'sd' || normalized === 's') return '#ef4444';
  return '#64748b';
}

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

    const orderVolumes = orders
      .map((o) => Number(o?.volume || 0))
      .filter((v) => Number.isFinite(v) && v > 0);
    const minVolume = orderVolumes.length ? Math.min(...orderVolumes) : 0;
    const maxVolume = orderVolumes.length ? Math.max(...orderVolumes) : 0;

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
        
        // Diameter: linear by matched value so 10B is ~10x 1B by design.
        const matchedValue = parseFloat(order.matched_value || (parseFloat(order.price) * parseFloat(order.volume)) || 0);
        const rawDiameter = (matchedValue / ONE_BILLION_VND) * BUBBLE_DIAMETER_PER_BILLION;
        const size = clamp(rawDiameter, BUBBLE_MIN_DIAMETER, BUBBLE_MAX_DIAMETER);

        const volume = parseInt(order.volume, 10) || 0;
        const volumeNorm = maxVolume > minVolume
          ? clamp((volume - minVolume) / (maxVolume - minVolume), 0, 1)
          : 0.5;
        const sideHex = baseColorBySide(order.side);
        const baseAlpha = clamp(0.42 + volumeNorm * 0.43, 0.42, 0.85);
        const hoverAlpha = clamp(baseAlpha + 0.12, 0.54, 0.97);
        const strokeAlpha = clamp(baseAlpha + 0.1, 0.56, 1);
        
        const bubble = {
          x: xMinutes,
          y: yVnd,
          yPct: yPct,
          yValue: matchedValue, // New Y-axis option: Trading Value
          value: [xMinutes, yVnd, size], // Default coordinates (legacy price delta)
          price: priceNum,
          volume,
          matchedValue,
          timestamp: orderTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          fullTimestamp: orderTime.toLocaleTimeString('vi-VN'),
          side: order.side,
          color: hexToRgba(sideHex, baseAlpha),
          hoverColor: hexToRgba(sideHex, hoverAlpha),
          strokeColor: hexToRgba(sideHex, strokeAlpha),
          volumeNorm,
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
