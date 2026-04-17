/**
 * components/Layout.jsx
 * Unified shell: Bloomberg-style Sidebar + TopNav.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useI18n } from '../context/LangContext';
import { fetchLegalPages } from '../api/client';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

export default function Layout() {
  const { t, locale } = useI18n();

  // Legal pages state
  const [legalPages, setLegalPages] = useState([]);
  const [legalModal, setLegalModal] = useState(null);

  const loadLegal = useCallback(async () => {
    try {
      const pages = await fetchLegalPages(null, locale || 'vi');
      setLegalPages(pages);
    } catch {
      // fail-soft
    }
  }, [locale]);

  useEffect(() => {
    loadLegal();
  }, [loadLegal]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="panel-scrollbar flex-1 overflow-y-auto bg-slate-950">
          <Outlet />
        </main>
        {legalPages.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-800 px-4 py-2">
            {legalPages.map((page) => (
              <button
                key={page.slug}
                type="button"
                onClick={() => setLegalModal(page)}
                className="text-[11px] text-slate-500 transition-colors hover:text-slate-300"
              >
                {page.title || t(`legal.${page.slug}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legal content modal */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-base font-semibold text-gray-100">{legalModal.title}</h2>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
                aria-label={t('legal.close')}
              >
                ×
              </button>
            </div>
            {legalModal.summary && (
              <p className="px-6 pt-4 text-xs text-gray-400 italic">{legalModal.summary}</p>
            )}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans">
                {legalModal.content_markdown || t('legal.noContent')}
              </pre>
            </div>
            <div className="px-6 py-3 border-t border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-sm text-white transition-colors"
              >
                {t('legal.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
