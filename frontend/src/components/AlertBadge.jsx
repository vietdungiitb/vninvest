import React from 'react';
import { Link } from 'react-router-dom';

export default function AlertBadge({
  href,
  icon = '🐋',
  tone = '',
  severityLabel = '',
  sideLabel = '',
  matchedValueLabel = '',
  title = '',
  className = '',
}) {
  const computedTitle = title || [severityLabel, sideLabel, matchedValueLabel].filter(Boolean).join(' · ');

  return (
    <Link
      to={href || '/'}
      title={computedTitle}
      aria-label={computedTitle}
      className={`inline-flex w-fit max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] transition-transform duration-150 hover:-translate-y-[1px] hover:brightness-110 ${tone} ${className}`.trim()}
    >
      <span>{icon}</span>
      {severityLabel ? <span>{severityLabel}</span> : null}
      {sideLabel ? <span>{sideLabel}</span> : null}
      {matchedValueLabel ? <span className="text-[8px] font-black tracking-[0.14em] text-slate-300">{matchedValueLabel}</span> : null}
    </Link>
  );
}