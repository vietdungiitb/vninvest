/**
 * pages/PortfolioManagement.jsx
 * Sprint 23 — Quản lý Danh mục & Tiểu khoản (CRUD)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { getSubAccounts } from '../api/client';
import { useI18n } from '../context/LangContext';

// ── constants ────────────────────────────────────────────────────────────────
const CONFIRM_KEYWORD = 'XAC NHAN XOA';

// ── tiny helpers ─────────────────────────────────────────────────────────────
function Badge({ children, color = 'gray' }) {
  const map = {
    gray: 'bg-gray-800 text-gray-400',
    emerald: 'bg-emerald-950/50 text-emerald-400',
    amber: 'bg-amber-950/50 text-amber-400',
    cyan: 'bg-cyan-950/50 text-cyan-400',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[color] || map.gray}`}>
      {children}
    </span>
  );
}

function saTypeColor(type) {
  if (type === '1') return 'emerald';
  if (type === '6') return 'amber';
  return 'cyan';
}

function getSubAccountTypeOptions(t) {
  return [
    { value: '1', label: t('portfolioManagement.subAccountForm.types.cash') },
    { value: '3', label: t('portfolioManagement.subAccountForm.types.special') },
    { value: '6', label: t('portfolioManagement.subAccountForm.types.margin') },
  ];
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────
function DeleteConfirmModal({ title, description, onConfirm, onCancel, busy, t }) {
  const [input, setInput] = useState('');
  const match = input.trim() === CONFIRM_KEYWORD;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border border-red-900/60 bg-gray-950 p-6 shadow-2xl">
        <h3 className="text-base font-bold text-red-400 mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-4">{description}</p>
        <p className="text-xs text-gray-500 mb-1">
          {t('portfolioManagement.confirmKeywordHint', { keyword: CONFIRM_KEYWORD }).split(CONFIRM_KEYWORD)[0]}
          <span className="font-mono font-bold text-red-300">{CONFIRM_KEYWORD}</span>
          {t('portfolioManagement.confirmKeywordHint', { keyword: CONFIRM_KEYWORD }).split(CONFIRM_KEYWORD)[1] || ''}
        </p>
        <input
          className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100
                     focus:outline-none focus:ring-1 focus:ring-red-600 mb-4"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={CONFIRM_KEYWORD}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {t('portfolioManagement.cancelButton')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!match || busy}
            className="rounded-md bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-40"
          >
            {busy ? t('portfolioManagement.deleting') : t('portfolioManagement.deleteButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PortfolioFormModal ────────────────────────────────────────────────────────
function PortfolioFormModal({ initial, onSave, onCancel, busy, t }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [err, setErr] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setErr(t('portfolioManagement.errors.portfolioNameRequired')); return; }
    if (trimmed.length > 100) { setErr(t('portfolioManagement.errors.nameTooLong')); return; }
    setErr('');
    onSave({ name: trimmed });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-950 p-6 shadow-2xl">
        <h3 className="text-base font-bold text-gray-100 mb-4">
          {isEdit ? t('portfolioManagement.portfolioForm.editTitle') : t('portfolioManagement.portfolioForm.createTitle')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('portfolioManagement.portfolioForm.nameLabel')}</label>
            <input
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('portfolioManagement.portfolioForm.namePlaceholder')}
              maxLength={100}
              autoFocus
            />
            {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} disabled={busy}
              className="rounded-md border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50">
              {t('portfolioManagement.cancelButton')}
            </button>
            <button type="submit" disabled={busy}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors disabled:opacity-50">
              {busy ? t('portfolioManagement.saving') : (isEdit ? t('portfolioManagement.saveButton') : t('portfolioManagement.createButton'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SubAccountFormModal ───────────────────────────────────────────────────────
function SubAccountFormModal({ portfolioId, initial, onSave, onCancel, busy, t }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [saType, setSaType] = useState(initial?.type || '1');
  const [marginRatio, setMarginRatio] = useState(String(initial?.margin_ratio || '1.000'));
  const [err, setErr] = useState('');
  const subAccountTypeOptions = getSubAccountTypeOptions(t);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setErr(t('portfolioManagement.errors.subAccountNameRequired')); return; }
    if (trimmed.length > 100) { setErr(t('portfolioManagement.errors.nameTooLong')); return; }
    const parsedMarginRatio = Number.parseFloat(marginRatio);
    if (!Number.isFinite(parsedMarginRatio) || parsedMarginRatio <= 0) {
      setErr(t('portfolioManagement.errors.marginRatioPositive'));
      return;
    }
    setErr('');
    onSave({
      name: trimmed,
      type: saType,
      margin_ratio: parsedMarginRatio.toFixed(3),
      portfolio: portfolioId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-950 p-6 shadow-2xl">
        <h3 className="text-base font-bold text-gray-100 mb-4">
          {isEdit ? t('portfolioManagement.subAccountForm.editTitle') : t('portfolioManagement.subAccountForm.createTitle')}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('portfolioManagement.subAccountForm.nameLabel')}</label>
            <input
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('portfolioManagement.subAccountForm.namePlaceholder')}
              maxLength={100}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('portfolioManagement.subAccountForm.typeLabel')}</label>
            <select
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={saType}
              onChange={(e) => setSaType(e.target.value)}
            >
              {subAccountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('portfolioManagement.subAccountForm.marginRatioLabel')}</label>
            <input
              className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100
                         focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={marginRatio}
              onChange={(e) => setMarginRatio(e.target.value)}
              placeholder={t('portfolioManagement.subAccountForm.marginRatioPlaceholder')}
              inputMode="decimal"
            />
            <p className="mt-1 text-[11px] text-gray-500">{t('portfolioManagement.subAccountForm.marginRatioHint')}</p>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onCancel} disabled={busy}
              className="rounded-md border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50">
              {t('portfolioManagement.cancelButton')}
            </button>
            <button type="submit" disabled={busy}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors disabled:opacity-50">
              {busy ? t('portfolioManagement.saving') : (isEdit ? t('portfolioManagement.saveButton') : t('portfolioManagement.addButton'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SubAccountList (inline per portfolio) ────────────────────────────────────
function SubAccountList({ portfolio, subAccounts, onAddSA, onEditSA, onDeleteSA, t }) {
  const mine = subAccounts.filter((sa) => sa.portfolio === portfolio.id);
  if (mine.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-gray-700 bg-gray-900/40 p-4 text-center">
        <p className="text-xs text-gray-500 mb-2">{t('portfolioManagement.noSubAccounts')}</p>
        <button
          type="button"
          onClick={() => onAddSA(portfolio)}
          className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2"
        >
          {t('portfolioManagement.addFirstSubAccount')}
        </button>
      </div>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {mine.map((sa) => (
        <li key={sa.id}
          className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge color={saTypeColor(sa.type)}>{sa.type_display || sa.type}</Badge>
            <span className="text-sm text-gray-200 truncate">{sa.name}</span>
            {sa.margin_ratio && (
              <span className="text-[10px] text-gray-500 truncate hidden sm:block">· {t('portfolioManagement.badges.marginPrefix')} {sa.margin_ratio}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => onEditSA(sa)}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              title={t('portfolioManagement.editButton')}
            >
              {t('portfolioManagement.editButton')}
            </button>
            <button
              type="button"
              onClick={() => onDeleteSA(sa)}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-950/40 hover:text-red-300 transition-colors"
              title={t('portfolioManagement.deleteButton')}
            >
              {t('portfolioManagement.deleteButton')}
            </button>
          </div>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => onAddSA(portfolio)}
          className="mt-1 flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          <span className="text-base leading-none">+</span> {t('portfolioManagement.addSubAccount')}
        </button>
      </li>
    </ul>
  );
}

// ── PortfolioCard ─────────────────────────────────────────────────────────────
function PortfolioCard({
  portfolio, isActive, subAccounts,
  onSetActive, onEdit, onDelete,
  onAddSA, onEditSA, onDeleteSA,
  t,
}) {
  const [expanded, setExpanded] = useState(false);
  const saCount = subAccounts.filter((sa) => sa.portfolio === portfolio.id).length;

  return (
    <div className={`rounded-xl border transition-colors ${
      isActive ? 'border-brand-600 bg-gray-900' : 'border-gray-800 bg-gray-900/50'
    }`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Active indicator */}
        <button
          type="button"
          onClick={() => onSetActive(portfolio.id)}
          title={isActive ? t('portfolioManagement.selectedPortfolio') : t('portfolioManagement.choosePortfolio')}
          className={`h-3 w-3 flex-shrink-0 rounded-full border-2 transition-colors ${
            isActive ? 'border-brand-400 bg-brand-400' : 'border-gray-600 bg-transparent hover:border-brand-500'
          }`}
        />
        {/* Name */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left text-sm font-semibold text-gray-100 hover:text-white truncate"
        >
          {portfolio.name}
        </button>
        {/* SA count badge */}
        <span className="text-[11px] text-gray-500 flex-shrink-0">
          {t('portfolioManagement.subAccountCount', { count: saCount })}
        </span>
        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(portfolio)}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            {t('portfolioManagement.editButton')}
          </button>
          <button
            type="button"
            onClick={() => onDelete(portfolio)}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-950/40 hover:text-red-300 transition-colors"
          >
            {t('portfolioManagement.deleteButton')}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>
      {/* Expandable SubAccount list */}
      {expanded && (
        <div className="px-4 pb-4">
          <SubAccountList
            portfolio={portfolio}
            subAccounts={subAccounts}
            onAddSA={onAddSA}
            onEditSA={onEditSA}
            onDeleteSA={onDeleteSA}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PortfolioManagement() {
  const {
    portfolios, activePortfolioId, setActivePortfolioId,
    createPortfolio, updatePortfolio, deletePortfolio,
    createSubAccount, updateSubAccount, deleteSubAccount,
  } = usePortfolio();
  const { t } = useI18n();

  const [subAccounts, setSubAccounts] = useState([]);
  const [globalError, setGlobalError] = useState('');

  // Modal state machine — one type at a time
  const [modal, setModal] = useState(null);
  // modal: null | { type: 'createPortfolio' }
  //               | { type: 'editPortfolio', portfolio }
  //               | { type: 'deletePortfolio', portfolio }
  //               | { type: 'createSA', portfolio }
  //               | { type: 'editSA', sa }
  //               | { type: 'deleteSA', sa }
  const [busy, setBusy] = useState(false);

  const closeModal = () => setModal(null);

  // ── Load all SubAccounts ──
  const loadSubAccounts = useCallback(async () => {
    try {
      const res = await getSubAccounts();
      setSubAccounts(res.data);
    } catch (err) {
      setGlobalError(t('portfolioManagement.errors.loadSubAccountsFailed'));
      console.error(err);
    }
  }, [t]);

  useEffect(() => {
    loadSubAccounts();
  }, [loadSubAccounts]);

  // ── Portfolio handlers ──
  const handleCreatePortfolio = async (data) => {
    setBusy(true);
    setGlobalError('');
    try {
      await createPortfolio(data);
      closeModal();
      await loadSubAccounts();
    } catch (err) {
      setGlobalError(err?.response?.data?.name?.[0] || t('portfolioManagement.errors.createPortfolioFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePortfolio = async (data) => {
    if (!modal?.portfolio) return;
    setBusy(true);
    setGlobalError('');
    try {
      await updatePortfolio(modal.portfolio.id, data);
      closeModal();
    } catch (err) {
      setGlobalError(err?.response?.data?.name?.[0] || t('portfolioManagement.errors.updatePortfolioFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!modal?.portfolio) return;
    setBusy(true);
    setGlobalError('');
    try {
      await deletePortfolio(modal.portfolio.id);
      closeModal();
      await loadSubAccounts();
    } catch (err) {
      setGlobalError(err?.response?.data?.detail || t('portfolioManagement.errors.deletePortfolioFailed'));
    } finally {
      setBusy(false);
    }
  };

  // ── SubAccount handlers ──
  const handleCreateSA = async (data) => {
    setBusy(true);
    setGlobalError('');
    try {
      await createSubAccount(data);
      closeModal();
      await loadSubAccounts();
    } catch (err) {
      setGlobalError(err?.response?.data?.name?.[0] || t('portfolioManagement.errors.createSubAccountFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateSA = async (data) => {
    if (!modal?.sa) return;
    setBusy(true);
    setGlobalError('');
    try {
      await updateSubAccount(modal.sa.id, data);
      closeModal();
      await loadSubAccounts();
    } catch (err) {
      setGlobalError(err?.response?.data?.name?.[0] || t('portfolioManagement.errors.updateSubAccountFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSA = async () => {
    if (!modal?.sa) return;
    setBusy(true);
    setGlobalError('');
    try {
      await deleteSubAccount(modal.sa.id);
      closeModal();
      await loadSubAccounts();
    } catch (err) {
      setGlobalError(err?.response?.data?.detail || t('portfolioManagement.errors.deleteSubAccountFailed'));
    } finally {
      setBusy(false);
    }
  };

  // ── Empty state ──
  if (portfolios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 px-4 text-center">
        <div className="mb-6 text-5xl">📁</div>
        <h2 className="text-xl font-bold text-gray-100 mb-2">{t('portfolioManagement.emptyTitle')}</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-xs">
          {t('portfolioManagement.emptyDescription')}
        </p>
        <button
          type="button"
          onClick={() => setModal({ type: 'createPortfolio' })}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          {t('portfolioManagement.emptyCta')}
        </button>
        {modal?.type === 'createPortfolio' && (
          <PortfolioFormModal
            onSave={handleCreatePortfolio}
            onCancel={closeModal}
            busy={busy}
            t={t}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">{t('portfolioManagement.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('portfolioManagement.summary', { portfolios: portfolios.length, subAccounts: subAccounts.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: 'createPortfolio' })}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          {t('portfolioManagement.createPortfolioCta')}
        </button>
      </div>

      {/* Global error */}
      {globalError && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
          <span>{globalError}</span>
          <button type="button" onClick={() => setGlobalError('')} className="text-red-400 hover:text-red-200 ml-4">✕</button>
        </div>
      )}

      {/* Portfolio cards */}
      <div className="space-y-3">
        {portfolios.map((p) => (
          <PortfolioCard
            key={p.id}
            portfolio={p}
            isActive={p.id === activePortfolioId}
            subAccounts={subAccounts}
            onSetActive={setActivePortfolioId}
            onEdit={(pf) => setModal({ type: 'editPortfolio', portfolio: pf })}
            onDelete={(pf) => setModal({ type: 'deletePortfolio', portfolio: pf })}
            onAddSA={(pf) => setModal({ type: 'createSA', portfolio: pf })}
            onEditSA={(sa) => setModal({ type: 'editSA', sa })}
            onDeleteSA={(sa) => setModal({ type: 'deleteSA', sa })}
            t={t}
          />
        ))}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'createPortfolio' && (
        <PortfolioFormModal onSave={handleCreatePortfolio} onCancel={closeModal} busy={busy} t={t} />
      )}
      {modal?.type === 'editPortfolio' && (
        <PortfolioFormModal
          initial={modal.portfolio}
          onSave={handleUpdatePortfolio}
          onCancel={closeModal}
          busy={busy}
          t={t}
        />
      )}
      {modal?.type === 'deletePortfolio' && (
        <DeleteConfirmModal
          title={t('portfolioManagement.deletePortfolioTitle', { name: modal.portfolio.name })}
          description={t('portfolioManagement.deletePortfolioDescription')}
          onConfirm={handleDeletePortfolio}
          onCancel={closeModal}
          busy={busy}
          t={t}
        />
      )}
      {modal?.type === 'createSA' && (
        <SubAccountFormModal
          portfolioId={modal.portfolio.id}
          onSave={handleCreateSA}
          onCancel={closeModal}
          busy={busy}
          t={t}
        />
      )}
      {modal?.type === 'editSA' && (
        <SubAccountFormModal
          portfolioId={modal.sa.portfolio}
          initial={modal.sa}
          onSave={handleUpdateSA}
          onCancel={closeModal}
          busy={busy}
          t={t}
        />
      )}
      {modal?.type === 'deleteSA' && (
        <DeleteConfirmModal
          title={t('portfolioManagement.deleteSubAccountTitle', { name: modal.sa.name })}
          description={t('portfolioManagement.deleteSubAccountDescription')}
          onConfirm={handleDeleteSA}
          onCancel={closeModal}
          busy={busy}
          t={t}
        />
      )}
    </div>
  );
}
