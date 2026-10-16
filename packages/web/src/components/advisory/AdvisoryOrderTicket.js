import { createElement, useState } from 'react';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';

const e = createElement;

export function AdvisoryOrderTicket({ advisory, symbol, onClose, placeOrder = null }) {
  const { t } = useI18n();
  const item = advisory || {};
  const resolvedSymbol = String(symbol || item.symbol || '').toUpperCase();
  const side = String(item.side || '').toUpperCase();
  const sideResolved = side === 'BUY' || side === 'SELL';
  const [price, setPrice] = useState(item.matched_value != null && Number(item.matched_value) > 0 ? String(item.matched_value) : '');
  const [quantity, setQuantity] = useState('100');
  const [token, setToken] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const priceNum = Number(price);
  const qtyNum = Math.floor(Number(quantity));
  const lotValid = qtyNum > 0 && qtyNum % 100 === 0;
  const formValid = sideResolved && resolvedSymbol && Number.isFinite(priceNum) && priceNum > 0 && lotValid;

  async function handleConfirm() {
    if (!sideResolved) {
      setError(t('aiAdvisory.order.sideUnknown', { defaultValue: 'Không xác định được chiều lệnh (BUY/SELL) — không cho phép thử nghiệm.' }));
      return;
    }
    if (!formValid) {
      setError(t('aiAdvisory.order.invalid', { defaultValue: 'Giá phải > 0 và số lượng phải là bội số của 100.' }));
      return;
    }
    if (!token.trim()) {
      setError(t('aiAdvisory.order.tokenRequired', { defaultValue: 'Cần trading token DNSE (không được lưu).' }));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const post = placeOrder || ((data) => coreApiAdapter.placeDNSEOrder(data));
      // PA-5: BE fail-closed (SAFE-01) — `mode` bắt buộc trong body, `Idempotency-Key`
      // bắt buộc là header (adapter tự sinh key mới mỗi lần submit). Chỉ gửi
      // `paper`; `live` bị từ chối (`live_ordering_disabled`) cho tới khi có policy
      // + OTP + risk limit + commercial license vnbroker.
      const res = await post({
        mode: 'paper',
        market_type: 'STOCK',
        order_category: 'NORMAL',
        trading_token: token.trim(),
        payload: {
          symbol: resolvedSymbol,
          side,
          price: priceNum,
          quantity: qtyNum,
          order_type: 'LO',
        },
      });
      setDone(res);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || t('aiAdvisory.order.failed', { defaultValue: 'Gửi lệnh thử nghiệm thất bại.' }));
    } finally {
      setSubmitting(false);
    }
  }

  return e(
    'div',
    { className: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4', role: 'dialog', 'aria-modal': 'true' },
    e(
      'div',
      { className: 'w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4' },
      e('h3', { className: 'text-sm font-black text-slate-100 uppercase tracking-widest' }, t('aiAdvisory.order.title', { defaultValue: 'Phiếu lệnh thử nghiệm (PAPER)' })),
      e(
        'div',
        { className: 'rounded-2xl bg-slate-950/50 border border-slate-800/60 p-3 text-xs text-slate-400 space-y-1' },
        e('div', null, `${resolvedSymbol} · ${side || '—'}`),
        e('div', null, t('aiAdvisory.order.reference', { price: item.matched_value ?? '—', defaultValue: `Giá tham chiếu: ${item.matched_value ?? '—'}` }))
      ),
      !confirming
        ? e(
          'div',
          { className: 'space-y-3' },
          e('label', { className: 'block text-xs text-slate-400' }, t('aiAdvisory.order.price', { defaultValue: 'Giá đặt (VNĐ)' }), e('input', { type: 'number', min: 0, value: price, onChange: (ev) => setPrice(ev.target.value), className: 'mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 font-mono' })),
          e('label', { className: 'block text-xs text-slate-400' }, t('aiAdvisory.order.quantity', { defaultValue: 'Số lượng (lô 100)' }), e('input', { type: 'number', min: 100, step: 100, value: quantity, onChange: (ev) => setQuantity(ev.target.value), className: 'mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 font-mono' })),
          e('p', { className: 'text-[11px] text-amber-400/90 italic' }, t('aiAdvisory.order.disclaimer', { defaultValue: 'Mô phỏng thử nghiệm: không tiền thật, không ra thị trường. Đây không phải lời khuyên đầu tư.' }))
        )
        : e(
          'div',
          { className: 'space-y-3' },
          e('p', { className: 'text-xs text-slate-300' }, t('aiAdvisory.order.review', { symbol: resolvedSymbol, side: side, quantity: qtyNum || 0, price: priceNum || 0, defaultValue: `Xác nhận: ${side} ${qtyNum || 0} ${resolvedSymbol} giá ${priceNum || 0}?` })),
          e('label', { className: 'block text-xs text-slate-400' }, t('aiAdvisory.order.token', { defaultValue: 'Trading token DNSE (không lưu)' }), e('input', { type: 'password', value: token, onChange: (ev) => setToken(ev.target.value), autoComplete: 'off', className: 'mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 font-mono' })),
          error ? e('p', { className: 'text-xs text-rose-400' }, error) : null,
          done ? e('p', { className: 'text-xs text-emerald-300' }, t('aiAdvisory.order.done', { defaultValue: 'Đã gửi lệnh thử nghiệm.' })) : null
        ),
      !sideResolved
        ? e('p', { className: 'text-xs text-rose-400' }, t('aiAdvisory.order.sideUnknown', { defaultValue: 'Không xác định được chiều lệnh (BUY/SELL) — không cho phép thử nghiệm.' }))
        : null,
      error && !confirming ? e('p', { className: 'text-xs text-rose-400' }, error) : null,
      e(
        'div',
        { className: 'flex gap-2 justify-end' },
        e('button', { type: 'button', onClick: onClose, className: 'px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200' }, t('aiAdvisory.order.cancel', { defaultValue: 'Đóng' })),
        !confirming
          ? e('button', { type: 'button', disabled: !formValid, onClick: () => { setError(''); setConfirming(true); }, className: 'px-4 py-2 rounded-xl text-xs font-black bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50' }, t('aiAdvisory.order.reviewAction', { defaultValue: 'Xem lại lệnh' }))
          : !done && e('button', { type: 'button', disabled: submitting, onClick: handleConfirm, className: 'px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50' }, submitting ? t('aiAdvisory.order.submitting', { defaultValue: 'Đang gửi…' }) : t('aiAdvisory.order.confirm', { defaultValue: 'Xác nhận lệnh thử nghiệm' }))
      )
    )
  );
}

export default AdvisoryOrderTicket;
