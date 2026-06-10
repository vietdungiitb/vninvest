import { createTranslator } from './index';

describe('createTranslator compatibility', () => {
  test('supports string default fallback signature t(key, "default")', () => {
    const t = createTranslator('vi');
    expect(t('missing.translation.key', 'Bản dịch mặc định')).toBe('Bản dịch mặc định');
  });

  test('keeps object defaultValue signature t(key, { defaultValue })', () => {
    const t = createTranslator('vi');
    expect(t('missing.translation.key', { defaultValue: 'Mặc định object' })).toBe('Mặc định object');
  });
});
