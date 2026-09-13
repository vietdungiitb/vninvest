import React, { useEffect, useState, useCallback } from 'react';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { useI18n } from '../context/LangContext.js';
import { useConfirm } from '../components/ConfirmModal.js';
import { ScreenerFilterBuilder } from '../components/screener/ScreenerFilterBuilder.js';
import { validateConditionValue } from '../components/screener/screenerValidation.js';
import { findDuplicateRule, uniqueRuleName } from '../components/screener/screenerRuleDedupe.js';
import { ScreenerResultsTable } from '../components/screener/ScreenerResultsTable.js';
import { ScreenerTemplates } from '../components/screener/ScreenerTemplates.js';
import { ScreenerHistory } from '../components/screener/ScreenerHistory.js';
import { loadScreenerRuns, saveScreenerRun, type ScreenerRunEntry } from '../components/screener/screenerHistoryStore.js';
import type { ScreenerCondition, ScreenerRule, ScreenerResult, ScreenerRow, ScreenerTemplate } from '../types/screener.d.ts';

type Rule = ScreenerRule;

// Module-level (not JSX literals) so react/jsx-no-literals stays clean.
const DISMISS_LABEL = "✕";
const DOT_SEPARATOR = " · ";

// P1.1 server scan params (D2/D3, Entry 73).
export interface ScanParams {
  sort: string;
  order: "asc" | "desc";
  page: number;
  limit: number;
  include_ai: number;
  [key: string]: string | number;
}
const DEFAULT_SCAN_PARAMS: ScanParams = { sort: "ai_score", order: "desc", page: 1, limit: 25, include_ai: 1 };


interface RuleEditorProps {
  initial: Rule | null;
  onSave: (data: Rule) => void;
  onCancel: () => void;
}

function RuleEditor({ initial, onSave, onCancel }: RuleEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [conds, setConds] = useState<ScreenerCondition[]>(
    initial?.rules_json?.length ? initial.rules_json.map((c) => ({ ...c })) : [{ field: 'rsi_14', op: 'lt', value: 30, logic: 'AND' }]
  );
  const [err, setErr] = useState('');

  const handleSave = () => {
    if (!name.trim()) { setErr(t('screener.errors.nameRequired')); return; }
    // P0.3: domain validation per field (R3.2); "" kept by the builder so
    // valueRequired/valueNumber are reachable again (R3.1).
    for (const c of conds) {
      const verr = validateConditionValue(c.field, c.value);
      if (verr?.kind === "required") { setErr(t('screener.errors.valueRequired')); return; }
      if (verr?.kind === "number") { setErr(t('screener.errors.valueNumber')); return; }
      if (verr?.kind === "range") {
        setErr(t('screener.errors.valueRange', {
          field: c.field,
          min: verr.min ?? "−∞",
          max: verr.max ?? "+∞",
          defaultValue: `Giá trị ${c.field} phải trong khoảng ${verr.min ?? "−∞"}–${verr.max ?? "+∞"}`,
        }));
        return;
      }
    }
    setErr('');
    onSave({ name: name.trim(), rules_json: conds.map((c) => ({ ...c, value: Number(c.value) })) });
  };

  return (
    <div style={{
      background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
      borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <div>
        <label htmlFor="screener-rule-name" style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', display: 'block' }}>
          {t('screener.ruleName')}
        </label>
        <input
          id="screener-rule-name"
          name="rule_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('screener.ruleNamePlaceholder')}
          style={{
            width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
            color: 'var(--text-primary, #f1f5f9)', fontSize: '14px', borderRadius: '4px',
            padding: '8px 12px', outline: 'none',
          }}
        />
      </div>
      <ScreenerFilterBuilder
        conditions={conds}
        onChange={setConds}
        maxConditions={20}
      />
      {err && <p style={{ color: 'var(--accent-red)', fontSize: '12px' }}>{err}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '6px 16px', background: 'var(--accent-cyan, #06b6d4)', color: '#fff', fontSize: '14px',
            borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {t('screener.saveRule')}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 16px', background: 'rgba(15,23,42,0.8)', color: 'var(--text-secondary, #94a3b8)', fontSize: '14px',
            borderRadius: '8px', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))', cursor: 'pointer',
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

export function ScreenerPage() {
  const { t, formatNumber } = useI18n();
  const confirm = useConfirm();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [results, setResults] = useState<ScreenerResult | null>(null);
  const [history, setHistory] = useState<ScreenerRunEntry[]>(() => loadScreenerRuns());
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<ScreenerTemplate[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  // P0.4: template preview (unsaved run) + save-as-rule with dedupe (R4.1/R4.2)
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [previewRuleId, setPreviewRuleId] = useState<number | null>(null);
  const [previewInfo, setPreviewInfo] = useState<{ ruleName: string } | null>(null);
  // P1.1: active server-scan context for pager/sort/export callbacks.
  const [scanParams, setScanParams] = useState<ScanParams>(DEFAULT_SCAN_PARAMS);
  const [activeRule, setActiveRule] = useState<Rule | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await coreApiAdapter.getScreenerRules();
      setRules(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError(t('screener.errors.loadRulesFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadRules(); }, [loadRules]);

  useEffect(() => {
    coreApiAdapter.getScreenerTemplates()
      .then((d: any) => setTemplates(Array.isArray(d) ? d : (d.templates || [])))
      .catch(() => setTemplates([]));
  }, []);

  const handleSave = async (formData: Rule) => {
    try {
      if (editing === 'new') {
        await coreApiAdapter.createScreenerRule(formData);
      } else {
        await coreApiAdapter.updateScreenerRule(String((editing as Rule).id), formData);
      }
      setEditing(null);
      await loadRules();
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.saveRuleFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t("screener.deleteRuleTitle"),
      message: t("screener.deleteRuleConfirm"),
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await coreApiAdapter.deleteScreenerRule(String(id));
      setRules((prev) => prev.filter((r) => r.id !== id));
      if (results?.rule_id === id) setResults(null);
    } catch {
      setError(t('screener.errors.deleteRuleFailed'));
    }
  };

  const saveHistoryEntry = useCallback((ruleId: number | null, ruleName: string, data: ScreenerResult) => {
    const entry: ScreenerRunEntry = {
      id: `${ruleId ?? 'r'}-${Date.now()}`,
      ruleId,
      ruleName,
      timestamp: Date.now(),
      rows: (data.matched || []).map((r: ScreenerRow) => ({
        symbol: r.symbol,
        close: r.close,
        action: r.ai_advisory?.strategy_action ?? null,
        score: r.ai_advisory?.ai_score_0_100 ?? null,
      })),
    };
    setHistory(saveScreenerRun(entry));
  }, []);

  // P0.4 "Chạy thử": run without saving to the rule list (R4.1). Reuses an
  // identical existing rule (with confirm) or a hidden is_active=False rule;
  // the previous preview rule is deleted first so at most one exists.
  const handlePreviewTemplate = useCallback(async (tmpl: ScreenerTemplate) => {
    setApplyingId(tmpl.id);
    setError('');
    setNotice('');
    try {
      const candidate = tmpl.rules_json;
      const dup = findDuplicateRule(rules, candidate);
      let ruleId: number | null;
      let ruleName: string;
      if (dup?.id != null) {
        const ok = await confirm({
          title: t('screener.templates.preview'),
          message: t('screener.duplicateRuleConfirm', {
            name: dup.name,
            defaultValue: `Đã có rule '${dup.name}' cấu hình giống hệt. Tiếp tục với rule này?`,
          }),
          variant: "default",
        });
        if (!ok) return;
        ruleId = dup.id;
        ruleName = dup.name;
      } else {
        if (previewRuleId != null) {
          try { await coreApiAdapter.deleteScreenerRule(String(previewRuleId)); } catch { /* already gone */ }
        }
        const created = await coreApiAdapter.createScreenerRule({
          name: `[Thử] ${t(tmpl.name_key)}`,
          rules_json: candidate,
          is_active: false,
        });
        ruleId = created.id ?? null;
        ruleName = created.name || t(tmpl.name_key);
        setPreviewRuleId(ruleId);
      }
      const data = await coreApiAdapter.runScreenerRule(String(ruleId));
      setResults(data);
      setPreviewInfo({ ruleName });
      saveHistoryEntry(ruleId, ruleName, data);
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.runRuleFailed'));
    } finally {
      setApplyingId(null);
    }
  }, [t, rules, previewRuleId, confirm, saveHistoryEntry]);

  // P0.4 "Lưu thành rule": dedupe by config, suffix on name clash, no auto-run (R4.2).
  const handleSaveTemplate = useCallback(async (tmpl: ScreenerTemplate) => {
    setSavingId(tmpl.id);
    setError('');
    setNotice('');
    try {
      const candidate = tmpl.rules_json;
      const dup = findDuplicateRule(rules, candidate);
      if (dup) {
        const ok = await confirm({
          title: t('screener.templates.saveAsRule'),
          message: t('screener.duplicateRuleConfirm', {
            name: dup.name,
            defaultValue: `Đã có rule '${dup.name}' cấu hình giống hệt. Tiếp tục với rule này?`,
          }),
          variant: "default",
        });
        if (!ok) return;
        setEditing(dup);
        return;
      }
      const name = uniqueRuleName(t(tmpl.name_key), rules);
      await coreApiAdapter.createScreenerRule({ name, rules_json: candidate, is_active: true });
      await loadRules();
      setNotice(t('screener.saveRuleSuccess', { name, defaultValue: `Đã lưu rule '${name}'.` }));
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.saveRuleFailed'));
    } finally {
      setSavingId(null);
    }
  }, [t, rules, confirm, loadRules]);

  // P1.1: server-driven scan params (D2/D3 defaults). Page turns keep the
  // current table on screen (keepResults) and skip history spam.
  const runWithParams = async (rule: Rule, params: ScanParams, opts?: { keepResults?: boolean }) => {
    setRunning(rule.id ?? null);
    if (!opts?.keepResults) setResults(null);
    setPreviewInfo(null);
    setError('');
    try {
      const data = await coreApiAdapter.runScreenerRule(String(rule.id), params);
      setScanParams(params);
      setActiveRule(rule);
      setResults(data);
      if (!opts?.keepResults) saveHistoryEntry(rule.id ?? null, rule.name, data);
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.runRuleFailed'));
    } finally {
      setRunning(null);
    }
  };

  const handleRun = (rule: Rule) => runWithParams(rule, { ...DEFAULT_SCAN_PARAMS });

  const handleServerPage = (page: number) => {
    if (activeRule) runWithParams(activeRule, { ...scanParams, page }, { keepResults: true });
  };

  const handleServerSort = (sort: string, order: "asc" | "desc") => {
    if (activeRule) runWithParams(activeRule, { ...scanParams, sort, order, page: 1 });
  };

  // P1.1: export fetches the full set (limit=2000) independent of the pager.
  const fetchAllRows = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    if (!activeRule) return (results?.matched ?? []) as Array<Record<string, unknown>>;
    const data = await coreApiAdapter.runScreenerRule(String(activeRule.id), {
      ...scanParams,
      page: 1,
      limit: 2000,
    });
    return (data.matched ?? []) as Array<Record<string, unknown>>;
  }, [activeRule, scanParams, results]);

  const pageStyle: React.CSSProperties = {
    padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px',
    maxWidth: '1200px', margin: '0 auto',
  };

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary, #f1f5f9)' }}>{t('screener.title')}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
            {t('screener.subtitle')}
          </p>
        </div>
        {editing == null && (
          <button
            onClick={() => setEditing('new')}
            style={{
              padding: '8px 16px', background: 'var(--accent-cyan, #06b6d4)', color: '#fff',
              fontSize: '14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {t('screener.createRule')}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
          color: '#fca5a5', fontSize: '14px', padding: '12px 16px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
          >
            {DISMISS_LABEL}
          </button>
        </div>
      )}

      {notice && (
        <div style={{
          background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)',
          color: '#86efac', fontSize: '14px', padding: '12px 16px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{notice}</span>
          <button
            onClick={() => setNotice('')}
            style={{ color: '#86efac', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
          >
            {DISMISS_LABEL}
          </button>
        </div>
      )}

      {editing != null && (
        <RuleEditor
          initial={editing === 'new' ? null : editing as Rule}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2].map((i) => (
            <div key={i} style={{
              height: '64px', background: 'rgba(15,23,42,0.4)', borderRadius: '12px',
              animation: 'pulse 2s infinite',
            }} />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div style={{
          background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
          borderRadius: '12px', padding: '40px', textAlign: 'center',
          color: 'var(--text-muted, #94a3b8)', fontSize: '14px',
        }}>
          {t('screener.noRules')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rules.map((rule) => (
            <div key={rule.id} style={{
              background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '0' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>{rule.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                    {Array.isArray(rule.rules_json) ? formatNumber(rule.rules_json.length) : '?'} {t('screener.conditionsCount')}
                    {DOT_SEPARATOR}
                    {Array.isArray(rule.rules_json) ? rule.rules_json.map((c) => {
                      const logic = c.logic ? ` ${c.logic} ` : '';
                      return `${logic}${c.field} ${c.op} ${c.value}`;
                    }).join('') : JSON.stringify(rule.rules_json)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleRun(rule)}
                    disabled={running === rule.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                      background: running === rule.id ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.2)',
                      border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '12px',
                      borderRadius: '8px', cursor: running === rule.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500, opacity: running === rule.id ? 0.6 : 1,
                    }}
                  >
                    {running === rule.id ? (
                      <>
                        <span style={{
                          width: '12px', height: '12px', border: '2px solid rgba(74,222,128,0.3)',
                          borderTopColor: '#4ade80', borderRadius: '50%', display: 'inline-block',
                          animation: 'spin 1s linear infinite',
                        }} />
                        {t('screener.running')}
                      </>
                    ) : t('screener.run')}
                  </button>
                  <button
                    onClick={() => setEditing(rule)}
                    style={{
                      padding: '6px 12px', background: 'rgba(15,23,42,0.6)',
                      border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))', color: 'var(--text-secondary, #94a3b8)',
                      fontSize: '12px', borderRadius: '8px', cursor: 'pointer',
                    }}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id!)}
                    style={{
                      padding: '6px 12px', background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
                      fontSize: '12px', borderRadius: '8px', cursor: 'pointer',
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results && previewInfo && (
        <div style={{
          background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.35)',
          color: '#67e8f9', fontSize: '13px', padding: '10px 16px', borderRadius: '8px',
        }}>
          {t('screener.previewBanner', { defaultValue: 'Kết quả chạy thử — chưa lưu thành rule' })}
          {DOT_SEPARATOR}
          {previewInfo.ruleName}
        </div>
      )}
      {results && (
        <ScreenerResultsTable
          results={results}
          serverMeta={
            results.page != null
              ? {
                  page: results.page,
                  limit: results.limit ?? scanParams.limit,
                  pages: results.pages ?? 1,
                  sort: results.sort ?? scanParams.sort,
                  order: results.order ?? scanParams.order,
                }
              : null
          }
          busy={running !== null}
          onServerPage={handleServerPage}
          onServerSort={handleServerSort}
          fetchAllRows={fetchAllRows}
        />
      )}
      <ScreenerTemplates
        templates={templates}
        applyingId={applyingId}
        savingId={savingId}
        onPreview={handlePreviewTemplate}
        onSave={handleSaveTemplate}
      />
      <ScreenerHistory runs={history} />
    </div>
  );
}