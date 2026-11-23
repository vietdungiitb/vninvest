/**
 * corporateEventMapper.test.js — Task 3 fail-before.
 *
 * Control timezone (L-V01): Asia/Ho_Chi_Minh = UTC+7, khong DST.
 * 2024-09-24T00:00+07:00 == 2024-09-23T17:00:00Z == 1727110800000 ms epoch.
 */
import {
  exDateToTimestampMs,
  mapCorporateActionToCorporateEvent,
  mapNewsListToNewsItems,
  mapNewsToNewsItem,
} from './corporateEventMapper.js';

describe('exDateToTimestampMs', () => {
  test('control: 2024-09-24 -> 1727110800000', () => {
    expect(exDateToTimestampMs('2024-09-24')).toBe(1727110800000);
  });

  test('ngay khong hop le -> null', () => {
    expect(exDateToTimestampMs('')).toBeNull();
    expect(exDateToTimestampMs('not-a-date')).toBeNull();
    expect(exDateToTimestampMs(null)).toBeNull();
  });
});

describe('mapCorporateActionToCorporateEvent', () => {
  test('DIV -> type D, so la number, id gop source+event', () => {
    const out = mapCorporateActionToCorporateEvent({
      action_type: 'DIV',
      ex_date: '2024-09-24',
      cash_amount_per_share: 950.0,
      stock_ratio_pct: null,
      source: 'VCI',
      source_event_id: 'vci-div-1',
      raw_title: 'Tra co tuc 950d/CP',
      parse_status: 'structured',
    });
    expect(out).not.toBeNull();
    expect(out.type).toBe('D');
    expect(out.timestamp).toBe(1727110800000);
    expect(out.date).toBe('2024-09-24');
    expect(out.id).toBe('VCI:vci-div-1');
    expect(out.title).toBe('Tra co tuc 950d/CP');
    expect(typeof out.data.cash_amount_per_share).toBe('number');
  });

  test('ISS -> type S', () => {
    const out = mapCorporateActionToCorporateEvent({
      action_type: 'ISS',
      ex_date: '2024-09-24',
      cash_amount_per_share: null,
      stock_ratio_pct: 20.0,
      source: 'VCI',
      source_event_id: 'vci-iss-1',
      raw_title: 'Thuong co phieu 20%',
      parse_status: 'structured',
    });
    expect(out.type).toBe('S');
    expect(out.timestamp).toBe(1727110800000);
  });

  test('action_type la -> N (khong bia type)', () => {
    const out = mapCorporateActionToCorporateEvent({
      action_type: 'XYZ',
      ex_date: '2024-09-24',
      source: 'VCI',
      source_event_id: 'x-1',
    });
    expect(out.type).toBe('N');
  });

  test('thieu ex_date -> null (bo item, khong crash)', () => {
    expect(mapCorporateActionToCorporateEvent({ action_type: 'DIV' })).toBeNull();
    expect(mapCorporateActionToCorporateEvent(null)).toBeNull();
  });
});

describe('mapNewsToNewsItem', () => {
  test('map dung publishedAt ms + snippet tu summary', () => {
    const out = mapNewsToNewsItem(
      {
        news_id: 'kbs:1',
        title: 'VNM bao loi nhuan',
        summary: 'Tom tat',
        url: 'https://example.vn/tin',
        published_at: '2024-09-24T08:00:00+07:00',
        source: 'KBS',
      },
      'VNM',
    );
    expect(out).not.toBeNull();
    expect(out.id).toBe('kbs:1');
    expect(out.symbol).toBe('VNM');
    expect(out.publishedAt).toBe(Date.parse('2024-09-24T08:00:00+07:00'));
    expect(out.snippet).toBe('Tom tat');
  });

  test('published_at hong -> null', () => {
    expect(mapNewsToNewsItem({ title: 'x', published_at: 'khong-phai-ngay' })).toBeNull();
    expect(mapNewsToNewsItem(null)).toBeNull();
  });

  test('mapNewsListToNewsItems ton trong limit + bo item hong', () => {
    const items = mapNewsListToNewsItems(
      [
        { news_id: '1', title: 'a', url: 'u1', published_at: '2024-09-24T08:00:00+07:00' },
        { news_id: '2', title: 'b', url: 'u2', published_at: 'hong' },
        { news_id: '3', title: 'c', url: 'u3', published_at: '2024-09-25T08:00:00+07:00' },
      ],
      5,
    );
    expect(items.map((i) => i.id)).toEqual(['1', '3']);
  });
});
