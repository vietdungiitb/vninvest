const COLORS = {
  buy: '#10b981',
  sell: '#ef4444',
  internal: '#64748b',
};

function formatTooltipMoney(value) {
  const numericValue = Number(value || 0);
  const absValue = Math.abs(numericValue);

  if (absValue >= 1_000_000_000) {
    return `${(numericValue / 1_000_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} tỷ đồng`;
  }

  if (absValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} triệu đồng`;
  }

  return `${numericValue.toLocaleString('vi-VN')} đồng`;
}

function formatTooltipPriceDelta(value) {
  const numericValue = Number(value || 0);
  const sign = numericValue > 0 ? '+' : '';
  return `${sign}${numericValue.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} đ`;
}

function formatAxisTime(value) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}h${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatCompactSignedValue(value) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return '--';
  const sign = numericValue > 0 ? '+' : '';
  if (Math.abs(numericValue) >= 1_000_000_000) {
    return `${sign}${(numericValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  }
  if (Math.abs(numericValue) >= 1_000_000) {
    return `${sign}${(numericValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu`;
  }
  return `${sign}${numericValue.toLocaleString('vi-VN')}`;
}

function getSeriesPointTimestampMs(seriesPoint) {
  const rawValue = Array.isArray(seriesPoint?.value) ? seriesPoint.value[0] : null;
  return Number.isFinite(rawValue) ? rawValue : null;
}

export function createWhaleTooltipFormatter({
  t,
  buyStrengthByTimestamp,
  institutionalStrengthByTimestamp,
  priceByTimestamp,
}) {
  return (param) => {
    if (!param) return '';
    const axisValue = param?.value?.[0] ?? param?.axisValue;
    const timeLabel = axisValue ? formatAxisTime(axisValue) : '--';
    const meta = param?.data?.metadata || null;

    if (meta) {
      const pointTimestampSec = Number.isFinite(meta.x) ? meta.x : null;
      const buyStrengthAtBucket = pointTimestampSec == null ? null : buyStrengthByTimestamp.get(pointTimestampSec);
      const institutionalStrengthAtBucket = pointTimestampSec == null ? null : institutionalStrengthByTimestamp.get(pointTimestampSec);
      const sideColor = meta.side === 'BUY' ? COLORS.buy : meta.side === 'SELL' ? COLORS.sell : COLORS.internal;
      const sideLabel = meta.side === 'BUY'
        ? (t('whaleChart.buyFlow') || 'MUA CHỦ ĐỘNG')
        : meta.side === 'SELL'
          ? (t('whaleChart.sellFlow') || 'BÁN CHỦ ĐỘNG')
          : (t('whaleChart.internal') || 'NỘI BỘ / KHÔNG RÕ');
      return `
        <div style="min-width: 240px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid #334155; padding-bottom:4px;">
            <span style="color:${sideColor}; font-weight:800; font-size:12px;">${sideLabel}</span>
            <span style="color:#94a3b8; font-size:10px;">${timeLabel}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span style="color:#64748b;">Giá khớp:</span>
            <span style="color:#f1f5f9; font-weight:700;">${meta.price.toLocaleString('vi-VN')} đ</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span style="color:#64748b;">Khối lượng:</span>
            <span style="color:#f1f5f9; font-weight:700;">${meta.volume.toLocaleString('vi-VN')}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span style="color:#64748b;">Giá trị:</span>
            <span style="color:#10b981; font-weight:700;">${formatTooltipMoney(meta.matchedValue)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <span style="color:#64748b;">Giá tham chiếu:</span>
            <span style="color:#f1f5f9; font-weight:700;">${meta.referencePrice != null ? `${meta.referencePrice.toLocaleString('vi-VN')} đ` : '--'}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:#64748b;">Biến động:</span>
            <span style="color:${meta.y >= 0 ? '#10b981' : '#ef4444'}; font-weight:700;">${formatTooltipPriceDelta(meta.y)} (${meta.yPct.toFixed(2)}%)</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:4px; border-top:1px solid #1e293b;">
            <span style="color:#64748b;">Whale / Extreme:</span>
            <span style="color:#f1f5f9; font-weight:700;">${meta.isLarge ? 'Có' : 'Không'} / ${meta.isExtreme ? 'Có' : 'Không'}</span>
          </div>
          ${(buyStrengthAtBucket != null || institutionalStrengthAtBucket != null) ? `
          <div style="display:flex; justify-content:space-between; margin-top:2px;">
            <span style="color:#64748b;">Strength cùng bucket:</span>
            <span style="color:#f1f5f9; font-weight:700;">${buyStrengthAtBucket != null ? `Mua ${buyStrengthAtBucket.toFixed(1)}` : '--'}${institutionalStrengthAtBucket != null ? ` | Tổ chức ${institutionalStrengthAtBucket.toFixed(1)}` : ''}</span>
          </div>` : ''}
        </div>
      `;
    }

    const pointValue = Number(Array.isArray(param?.value) ? param.value[1] : param?.value ?? 0);
    const seriesName = param?.seriesName || 'Whale Analytics';
    const pointTimestampMs = getSeriesPointTimestampMs(param);
    const pointTimestampSec = pointTimestampMs == null ? null : Math.floor(pointTimestampMs / 1000);
    const priceAtBucket = pointTimestampSec == null ? null : priceByTimestamp.get(pointTimestampSec);
    const buyStrengthAtBucket = pointTimestampSec == null ? null : buyStrengthByTimestamp.get(pointTimestampSec);
    const institutionalStrengthAtBucket = pointTimestampSec == null ? null : institutionalStrengthByTimestamp.get(pointTimestampSec);
    const formattedValue = seriesName === 'Đường giá intraday'
      ? `${pointValue.toLocaleString('vi-VN')} đ`
      : seriesName.includes('Strength') || seriesName.includes('Sức mạnh')
        ? `${pointValue.toFixed(1)}`
        : formatCompactSignedValue(pointValue);

    return `
      <div style="min-width: 220px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid #334155; padding-bottom:4px;">
          <span style="color:#e2e8f0; font-weight:800; font-size:12px;">${seriesName}</span>
          <span style="color:#94a3b8; font-size:10px;">${timeLabel}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#64748b;">Giá trị:</span>
          <span style="color:#f1f5f9; font-weight:700;">${formattedValue}</span>
        </div>
        ${(priceAtBucket != null && seriesName !== 'Đường giá intraday') ? `
        <div style="display:flex; justify-content:space-between; margin-top:2px;">
          <span style="color:#64748b;">Giá tại bucket:</span>
          <span style="color:#f1f5f9; font-weight:700;">${priceAtBucket.toLocaleString('vi-VN')} đ</span>
        </div>` : ''}
        ${(buyStrengthAtBucket != null && !seriesName.includes('Sức mạnh mua')) ? `
        <div style="display:flex; justify-content:space-between; margin-top:2px;">
          <span style="color:#64748b;">Sức mạnh mua:</span>
          <span style="color:#f1f5f9; font-weight:700;">${buyStrengthAtBucket.toFixed(1)}</span>
        </div>` : ''}
        ${(institutionalStrengthAtBucket != null && !seriesName.includes('Sức mạnh tổ chức')) ? `
        <div style="display:flex; justify-content:space-between; margin-top:2px;">
          <span style="color:#64748b;">Sức mạnh tổ chức:</span>
          <span style="color:#f1f5f9; font-weight:700;">${institutionalStrengthAtBucket.toFixed(1)}</span>
        </div>` : ''}
      </div>
    `;
  };
}