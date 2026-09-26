import { createElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';

const e = createElement;

export function AdvisoryAlertDialog({ advisory, symbol, onClose, createAlert = null }) {
  const { t } = useI18n();
  const item = advisory || {};
  const resolvedSymbol = String(symbol || item.symbol || '').toUpperCase();
  const side = String(item.side || '').toUpperCase();
  const sideHint = side === 'SELL' ? 'ABOVE' : side === 'BUY' ? 'BELOW' : '';
  const [condition, setCondition] = useState(sideHint);
  const [target, setTarget] = useState(item.matched_value != null && Number(item.matched_value) > 0 ? String(item.matched_value) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!condition) {
      setError(t('aiAdvisory.alert.conditionRequired', { defaultValue: 'Chọn điều kiện cảnh báo trước khi gửi.' }));
      return;
    }
    const price = Number(target);
    if (!resolvedSymbol || !Number.isFinite(price) || price <= 0) {
      setError(t('aiAdvisory.alert.targetRequired', { defaultValue: 'Giá mục tiêu phải > 0.' }));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const post = createAlert || ((payload) => coreApiAdapter.createPriceAlert(payload));
      const res = await post({
        symbol: resolvedSymbol,
        condition: condition === 'ABOVE' ? 'ABOVE' : 'BELOW',
        target_price: price,
        cooldown_seconds: 300,
        is_active: true,
      });
      setCreated(res);
    } catch (_) {
      setError(t('aiAdvisory.alert.createFailed', { defaultValue: 'Không tạo được cảnh báo.' }));
    } finally {
      setSubmitting(false);
    }
  }

  return e(
    'div',
    { className: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4', role: 'dialog', 'aria-modal': 'true' },
    e(
      'form',
      { onSubmit: handleSubmit, className: 'w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4' },
      e('h3', { className: 'text-sm font-black text-slate-100 uppercase tracking-widest' }, t('aiAdvisory.alert.title', { defaultValue: 'Tạo cảnh báo từ tư vấn' })),
      e(
        'div',
        { className: 'rounded-2xl bg-slate-950/50 border border-slate-800/60 p-3 text-xs text-slate-400 space-y-1' },
        e('div', null, `${resolvedSymbol} · ${side || '—'}`),
        e('div', null, t('aiAdvisory.alert.contextLine', {
          confidence: item.confidence != null ? `${item.confidence}%` : '—',
          intensity: item.whale_intensity != null ? `${item.whale_intensity}%` : '—',
          defaultValue: `Tin cậy ${item.confidence != null ? `${item.confidence}%` : '—'} · Cường độ ${item.whale_intensity != null ? `${item.whale_intensity}%` : '—'}`,
        }))
      ),
      e(
        'label',
        { className: 'block text-xs text-slate-400' },
        t('aiAdvisory.alert.condition', { defaultValue: 'Điều kiện' }),
        e(
          'select',
          {
            value: condition,
            onChange: (ev) => setCondition(ev.target.value),
            className: 'mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100',
          },
          e('option', { value: 'ABOVE' }, t('aiAdvisory.alert.above', { defaultValue: 'Giá vượt lên trên' })),
          e('option', { value: 'BELOW' }, t('aiAdvisory.alert.below', { defaultValue: 'Giá rơi xuống dưới' }))
        )
      ),
      e(
        'label',
        { className: 'block text-xs text-slate-400' },
        t('aiAdvisory.alert.target', { defaultValue: 'Giá mục tiêu (VNĐ)' }),
        e('input', {
          type: 'number',
          min: 0,
          value: target,
          onChange: (ev) => setTarget(ev.target.value),
          className: 'mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 font-mono',
        })
      ),
      error ? e('p', { className: 'text-xs text-rose-400' }, error) : null,
      created
        ? e(
          'div',
          { className: 'rounded-2xl border border-emerald-800 bg-emerald-950/30 p-3 text-xs text-emerald-300 space-y-2' },
          e('p', null, t('aiAdvisory.alert.created', { defaultValue: 'Đã tạo cảnh báo.' })),
          e(Link, { to: `/alert-center?symbol=${encodeURIComponent(resolvedSymbol)}`, className: 'inline-block underline hover:text-emerald-200' }, t('aiAdvisory.alert.viewAlerts', { defaultValue: 'Xem cảnh báo' }))
        )
        : null,
      e(
        'div',
        { className: 'flex gap-2 justify-end' },
        e('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200' }, t('aiAdvisory.alert.cancel', { defaultValue: 'Đóng' })),
        !created && e('button', { type: 'submit', disabled: submitting, className: 'px-4 py-2 rounded-xl text-xs font-black bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50' }, submitting ? t('aiAdvisory.alert.submitting', { defaultValue: 'Đang tạo…' }) : t('aiAdvisory.alert.submit', { defaultValue: 'Tạo cảnh báo' }))
      )
    )
  );
}

export default AdvisoryAlertDialog;
