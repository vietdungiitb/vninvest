import React from 'react';

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

const IconFirst = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0L9 10.414l5.293-5.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zM4 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);
const IconPrev = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);
const IconNext = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
  </svg>
);
const IconLast = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L11 9.586l-5.293 5.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414zM15 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);
const IconSpinner = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const NAV_BTN_BASE = 'v2-chip-focus rounded border p-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const NAV_BTN_DEFAULT = `${NAV_BTN_BASE} border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-slate-100`;
const NAV_BTN_NEXT = `${NAV_BTN_BASE} border-cyan-700/70 bg-cyan-950/25 text-cyan-200 hover:bg-cyan-900/35`;

function OffsetPaginationBar({ total, page, size, onPageChange, onSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/90 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2 text-slate-500">
        {/* B4: `whitespace-nowrap` + `shrink-0` — trong sidebar hẹp (~320px),
            chuỗi "0–0 / 0" bị bóp và dấu gạch nối xuống dòng, đọc ra thành
            "0—/0—/0". Không sửa gì khác để không ảnh hưởng layout rộng. */}
        <span className="whitespace-nowrap shrink-0">{from}–{to} / {total}</span>
        <span aria-hidden="true">•</span>
        <span className="whitespace-nowrap shrink-0">Kích thước trang</span>
        <select
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="v2-chip-focus rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300 hover:border-slate-600 focus:border-cyan-600 focus:text-cyan-200 focus:outline-none"
        >
          {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onPageChange(1)} disabled={page <= 1}
          title="Đầu" className={NAV_BTN_DEFAULT}>
          <IconFirst />
        </button>
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          title="Trước" className={NAV_BTN_DEFAULT}>
          <IconPrev />
        </button>
        <span className="min-w-[52px] whitespace-nowrap text-center text-slate-400 tabular-nums">
          Trang {page} / {totalPages}
        </span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          title="Tiếp" className={NAV_BTN_NEXT}>
          <IconNext />
        </button>
        <button type="button" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}
          title="Cuối" className={NAV_BTN_DEFAULT}>
          <IconLast />
        </button>
      </div>
    </div>
  );
}

function CursorPaginationBar({
  currentPage,
  hasPrev,
  hasNext,
  hasLast,
  loading,
  onFirst,
  onPrev,
  onNext,
  onLast,
  pageSize,
  onSizeChange,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/90 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="whitespace-nowrap shrink-0">Trang {currentPage || 1}</span>
        <span aria-hidden="true">•</span>
        <span className="whitespace-nowrap shrink-0">Kích thước trang</span>
        <select
          value={pageSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="v2-chip-focus rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300 hover:border-slate-600 focus:border-cyan-600 focus:text-cyan-200 focus:outline-none"
        >
          {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onFirst} disabled={!hasPrev || loading}
          title="Đầu" className={NAV_BTN_DEFAULT}>
          <IconFirst />
        </button>
        <button type="button" onClick={onPrev} disabled={!hasPrev || loading}
          title="Trước" className={NAV_BTN_DEFAULT}>
          <IconPrev />
        </button>
        <button type="button" onClick={onNext} disabled={!hasNext || loading}
          title="Tiếp" className={NAV_BTN_NEXT}>
          {loading ? <IconSpinner /> : <IconNext />}
        </button>
        <button type="button" onClick={onLast} disabled={!hasLast || loading}
          title="Cuối" className={NAV_BTN_DEFAULT}>
          <IconLast />
        </button>
      </div>
    </div>
  );
}

export default function PaginationBar({ mode = 'offset', ...props }) {
  if (mode === 'cursor') return <CursorPaginationBar {...props} />;
  return <OffsetPaginationBar {...props} />;
}
