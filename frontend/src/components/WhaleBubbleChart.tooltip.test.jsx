import { createWhaleTooltipFormatter } from '../utils/whaleTooltipFormatter';

describe('WhaleBubbleChart tooltip formatter', () => {
  const t = () => undefined;

  it('binds bubble tooltip content to the hovered bubble point and its exact bucket', () => {
    const formatter = createWhaleTooltipFormatter({
      t,
      buyStrengthByTimestamp: new Map([[1713949200, 61.2]]),
      institutionalStrengthByTimestamp: new Map([[1713949200, 74.5]]),
      priceByTimestamp: new Map([[1713949200, 25200]]),
    });

    const html = formatter({
      value: [1713949200000, 1500000000, 32],
      data: {
        metadata: {
          x: 1713949200,
          y: 120,
          yPct: 0.48,
          side: 'BUY',
          price: 25200,
          volume: 60000,
          matchedValue: 1512000000,
          referencePrice: 25080,
          isLarge: true,
          isExtreme: false,
        },
      },
    });

    expect(html).toContain('MUA CHỦ ĐỘNG');
    expect(html).toContain('16h00');
    expect(html).toContain('25.200 đ');
    expect(html).toContain('60.000');
    expect(html).toContain('1,51 tỷ đồng');
    expect(html).toContain('Mua 61.2 | Tổ chức 74.5');
    expect(html).not.toContain('Giá tại bucket');
  });

  it('binds line tooltip content to the hovered line point without leaking other point payloads', () => {
    const formatter = createWhaleTooltipFormatter({
      t,
      buyStrengthByTimestamp: new Map([[1713949200, 61.2]]),
      institutionalStrengthByTimestamp: new Map([[1713949200, 74.5]]),
      priceByTimestamp: new Map([[1713949200, 25200]]),
    });

    const html = formatter({
      seriesName: 'Dòng tiền mua tích cực',
      value: [1713949200000, 3450000000],
    });

    expect(html).toContain('Dòng tiền mua tích cực');
    expect(html).toContain('16h00');
    expect(html).toContain('3,45 tỷ');
    expect(html).toContain('Giá tại bucket');
    expect(html).toContain('25.200 đ');
    expect(html).toContain('Sức mạnh mua:');
    expect(html).toContain('61.2');
    expect(html).toContain('Sức mạnh tổ chức:');
    expect(html).toContain('74.5');
    expect(html).not.toContain('Giá khớp:');
    expect(html).not.toContain('Khối lượng:');
    expect(html).not.toContain('Whale / Extreme:');
  });
});