import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantAdminQuery, TENANT_ADMIN_QUERY_SCOPE } from './tenant-admin/useTenantAdminQuery.js';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { tenantIdStorage } from '../adapters/core/transport.js';
import { useI18n } from '../context/LangContext.js';
import { useConfirm } from '../components/ConfirmModal.js';
import { ScreenerFilterBuilder } from '../components/screener/ScreenerFilterBuilder.js';
import { validateConditionValue } from '../components/screener/screenerValidation.js';
import { findDuplicateRule, uniqueRuleName } from '../components/screener/screenerRuleDedupe.js';
import { ScreenerResultsTable } from '../components/screener/ScreenerResultsTable.js';
import { ScreenerTemplates } from '../components/screener/ScreenerTemplates.js';
import { ScreenerHistory } from '../components/screener/ScreenerHistory.js';
import { ScreenerSchedulePanel } from '../components/screener/ScreenerSchedulePanel.js';
import { ScreenerCommunity } from '../components/screener/ScreenerCommunity.js';
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
      borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <div>
        <label htmlFor="screener-rule-name" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted, #94a3b8)', marginBottom: '4px', display: 'block' }}>
          {t('screener.ruleName')}
        </label>
        <input
          id="screener-rule-name"
          name="rule_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('screener.ruleNamePlaceholder')}
          style={{
            width: '100%', background: 'color-mix(in srgb, var(--bg-panel) 60%, transparent)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
            color: 'var(--text-primary, #f1f5f9)', fontSize: 'var(--fs-md)', borderRadius: '4px',
            padding: '0.5rem 0.75rem', outline: 'none',
          }}
        />
      </div>
      <ScreenerFilterBuilder
        conditions={conds}
        onChange={setConds}
        maxConditions={20}
      />
      {err && <p style={{ color: 'var(--accent-red)', fontSize: 'var(--fs-xs)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '0.5rem 1rem', background: 'var(--accent-cyan, #06b6d4)', color: 'var(--text-on-accent)', fontSize: 'var(--fs-md)',
            borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {t('screener.saveRule')}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '0.5rem 1rem', background: 'color-mix(in srgb, var(--bg-panel) 80%, transparent)', color: 'var(--text-secondary, #94a3b8)', fontSize: 'var(--fs-md)',
            borderRadius: 'var(--r-md)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))', cursor: 'pointer',
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
  const queryClient = useQueryClient();
  const { data: rulesData, isLoading: loading, error: rulesError } = useTenantAdminQuery<Rule[]>(
    ['screener', 'rules'],
    '/screener/rules/',
    {
      queryFn: () => coreApiAdapter.getScreenerRules().then((d: any) => (Array.isArray(d) ? d : d.results || [])),
    },
  );
  const rules: Rule[] = useMemo(() => (rulesData as Rule[] | undefined) ?? [], [rulesData]);
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
  // P1.4: async job polling (D1, Entry 77) — F-FE-03 fix: single timeout + mounted guard + poll ngay
  const [jobInfo, setJobInfo] = useState<{ job_id: string; rule: Rule } | null>(null);
  const [jobStatus, setJobStatus] = useState<{ status: string; scanned?: number; total?: number } | null>(null);
  const pollRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAppliedUrlRef = React.useRef(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current != null) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPoll();
    };
  }, [clearPoll]);

  useEffect(() => {
    if (rulesError) setError(t('screener.errors.loadRulesFailed'));
  }, [rulesError, t]);

  useEffect(() => {
    coreApiAdapter.getScreenerTemplates()
      .then((d: any) => setTemplates(Array.isArray(d) ? d : (d.templates || [])))
      .catch(() => setTemplates([]));
  }, []);

  // P2.1 URL share (?rule=&run=&sort=&order=&page=&limit=) — D8
  const syncUrl = useCallback((rule: Rule | null, params: ScanParams | null) => {
    if (!rule || !params) return;
    const next = new URLSearchParams();
    next.set('rule', String(rule.id));
    next.set('run', '1');
    if (params.sort) next.set('sort', params.sort);
    if (params.order) next.set('order', params.order);
    if (params.page) next.set('page', String(params.page));
    if (params.limit && params.limit !== DEFAULT_SCAN_PARAMS.limit) next.set('limit', String(params.limit));
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const handleSave = async (formData: Rule) => {
    try {
      if (editing === 'new') {
        await coreApiAdapter.createScreenerRule(formData);
      } else {
        await coreApiAdapter.updateScreenerRule(String((editing as Rule).id), formData);
      }
      setEditing(null);
      const tenantId = typeof window !== 'undefined' ? tenantIdStorage.getTenantId() : null;
      queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'rules'] });
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.saveRuleFailed'));
    }
  };

  // W8 P3 preset cộng đồng: bật/tắt chia sẻ rule với tenant (PUT partial is_public).
  const handleShare = async (rule: Rule) => {
    if (rule.id == null) return;
    try {
      await coreApiAdapter.updateScreenerRule(String(rule.id), { is_public: !rule.is_public });
      const tenantId = typeof window !== 'undefined' ? tenantIdStorage.getTenantId() : null;
      queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'rules'] });
      queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'public'] });
      setNotice(
        rule.is_public
          ? t('screener.community.unshared', { name: rule.name, defaultValue: `Đã ngừng chia sẻ '${rule.name}'.` })
          : t('screener.community.shared', { name: rule.name, defaultValue: `Đã chia sẻ '${rule.name}' với cộng đồng tenant.` }),
      );
    } catch {
      setError(t('screener.errors.saveRuleFailed'));
    }
  };

  const handleDelete = async (id: number) => {    const confirmed = await confirm({
      title: t("screener.deleteRuleTitle"),
      message: t("screener.deleteRuleConfirm"),
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await coreApiAdapter.deleteScreenerRule(String(id));
      const tenantId = typeof window !== 'undefined' ? tenantIdStorage.getTenantId() : null;
      queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'rules'] });
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
    // P2.3: BE auto-creates ScreenerRunHistory on run — invalidate server list
    try {
      const tenantId = typeof window !== 'undefined' ? tenantIdStorage.getTenantId() : null;
      queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId ?? 'none', 'screener', 'history'] });
    } catch {
      /* ignore */
    }
  }, [queryClient]);

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
      const tenantId2 = typeof window !== 'undefined' ? tenantIdStorage.getTenantId() : null;
      queryClient.invalidateQueries({ queryKey: [TENANT_ADMIN_QUERY_SCOPE, tenantId2 ?? 'none', 'screener', 'rules'] });
      setNotice(t('screener.saveRuleSuccess', { name, defaultValue: `Đã lưu rule '${name}'.` }));
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.saveRuleFailed'));
    } finally {
      setSavingId(null);
    }
  }, [t, rules, confirm, queryClient]);

  // P1.1: server-driven scan params (D2/D3 defaults). Page turns keep the
  // current table on screen (keepResults) and skip history spam.
  // P1.4: handles 202 queued → polling 1.5s, timeout 90s, cancel stops poll only.
  const runWithParams = async (rule: Rule, params: ScanParams, opts?: { keepResults?: boolean }) => {
    clearPoll();
    setRunning(rule.id ?? null);
    if (!opts?.keepResults) setResults(null);
    setPreviewInfo(null);
    setError('');
    setJobInfo(null);
    setJobStatus(null);
    let isQueued = false;
    try {
      const data: any = await coreApiAdapter.runScreenerRule(String(rule.id), params);
      // 202 queued path (P1.4)
      if (data && data.status === 'queued' && data.job_id) {
        isQueued = true;
        const job_id: string = data.job_id;
        setJobInfo({ job_id, rule });
        setJobStatus({ status: 'queued', scanned: 0, total: data.total ?? 0 });
        // Poll every 1.5s — single 90s guard (elapsed inside interval), immediate first poll, mounted guard (F-FE-03)
        let elapsed = 0;
        const poll = async () => {
          if (!mountedRef.current) return;
          try {
            const st: any = await (coreApiAdapter as any).getScreenerRunStatus(String(rule.id), job_id);
            if (!mountedRef.current) return;
            setJobStatus(st);
            if (st.status === 'completed') {
              clearPoll();
              try {
                const finalData: any = await coreApiAdapter.runScreenerRule(String(rule.id), params);
                if (!mountedRef.current) return;
                setScanParams(params);
                setActiveRule(rule);
                setResults(finalData);
                syncUrl(rule, params);
                if (!opts?.keepResults) saveHistoryEntry(rule.id ?? null, rule.name, finalData);
              } catch {
                if (mountedRef.current) setError(t('screener.errors.runRuleFailed'));
              } finally {
                if (mountedRef.current) {
                  setRunning(null);
                  setJobInfo(null);
                }
              }
            } else if (st.status === 'failed') {
              clearPoll();
              if (mountedRef.current) {
                setError(st.error || t('screener.errors.runRuleFailed'));
                setRunning(null);
                setJobInfo(null);
              }
            } else if (st.status === 'unknown') {
              clearPoll();
              try {
                const fallback: any = await coreApiAdapter.runScreenerRule(String(rule.id), params);
                if (!mountedRef.current) return;
                setScanParams(params);
                setActiveRule(rule);
                setResults(fallback);
                syncUrl(rule, params);
                if (!opts?.keepResults) saveHistoryEntry(rule.id ?? null, rule.name, fallback);
              } catch {
                if (mountedRef.current) setError(t('screener.errors.runRuleFailed'));
              } finally {
                if (mountedRef.current) {
                  setRunning(null);
                  setJobInfo(null);
                }
              }
            }
          } catch (e: unknown) {
            if (!mountedRef.current) return;
            const errResp = e as { response?: { data?: { detail?: string } } };
            if (errResp?.response?.data?.detail) setError(errResp.response.data.detail);
          }
          elapsed += 1500;
          if (elapsed >= 90000) {
            clearPoll();
            if (mountedRef.current) {
              setError(t('screener.errors.runTimeout'));
              setRunning(null);
            }
          }
        };
        pollRef.current = window.setInterval(poll, 1500) as unknown as number;
        // Immediate first poll after 300ms so queued UI doesn't idle 1.5s
        window.setTimeout(() => {
          if (mountedRef.current && pollRef.current != null) void poll();
        }, 300);
        return;
      }
      setScanParams(params);
      setActiveRule(rule);
      setResults(data);
      syncUrl(rule, params);
      if (!opts?.keepResults) saveHistoryEntry(rule.id ?? null, rule.name, data);
    } catch (err: unknown) {
      const errResp = err as { response?: { status?: number; data?: { detail?: string; retry_after?: number } } };
      const status = (err as any)?.response?.status;
      if (status === 429) {
        const retry = errResp?.response?.data?.retry_after ?? 60;
        setError(errResp?.response?.data?.detail || `Quá nhiều yêu cầu. Thử lại sau ${retry}s.`);
      } else {
        const detail = (errResp as any)?.response?.data?.detail;
        setError(detail || t('screener.errors.runRuleFailed'));
      }
    } finally {
      if (!isQueued) setRunning(null);
    }
  };

  const handleRun = (rule: Rule) => runWithParams(rule, { ...DEFAULT_SCAN_PARAMS });

  // W8 P3 preset cộng đồng: fork flows (component đã fork + invalidate).
  const handleFork = useCallback(async (created: Rule) => {
    setNotice(t('screener.community.forked', { name: created?.name ?? '', defaultValue: `Đã lưu bản sao '${created?.name ?? ''}'.` }));
  }, [t]);
  const handleForkRun = (created: Rule) => {
    setNotice('');
    return runWithParams(created, { ...DEFAULT_SCAN_PARAMS });
  };

  const handleServerPage = (page: number) => {
    if (activeRule) runWithParams(activeRule, { ...scanParams, page }, { keepResults: true });
  };

  const handleServerSort = (sort: string, order: "asc" | "desc") => {
    if (activeRule) runWithParams(activeRule, { ...scanParams, sort, order, page: 1 });
  };

  const handleCancelPoll = () => {
    clearPoll();
    setJobInfo(null);
    setJobStatus(null);
    setRunning(null);
  };

  // P2.1: apply URL on first load after rules fetched (D8)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasAppliedUrlRef.current || loading || rules.length === 0) return;
    const ruleIdStr = searchParams.get('rule');
    if (!ruleIdStr) return;
    const rid = parseInt(ruleIdStr, 10);
    if (!Number.isInteger(rid)) return;
    const found = rules.find((r) => r.id === rid);
    if (!found) {
      setError(t('screener.errors.loadRulesFailed') + ` (rule ${rid} không tồn tại)`);
      hasAppliedUrlRef.current = true;
      return;
    }
    hasAppliedUrlRef.current = true;
    const sort = searchParams.get('sort') || DEFAULT_SCAN_PARAMS.sort;
    const order = (searchParams.get('order') as ScanParams['order']) || DEFAULT_SCAN_PARAMS.order;
    const pageStr = searchParams.get('page');
    const limitStr = searchParams.get('limit');
    const page = pageStr ? parseInt(pageStr, 10) : DEFAULT_SCAN_PARAMS.page;
    const limit = limitStr ? parseInt(limitStr, 10) : DEFAULT_SCAN_PARAMS.limit;
    const params: ScanParams = {
      sort: sort || DEFAULT_SCAN_PARAMS.sort,
      order: order === 'asc' || order === 'desc' ? order : DEFAULT_SCAN_PARAMS.order,
      page: Number.isInteger(page) && page >= 1 ? page : 1,
      limit: [10, 25, 50, 100, 2000].includes(limit) ? limit : DEFAULT_SCAN_PARAMS.limit,
      include_ai: DEFAULT_SCAN_PARAMS.include_ai,
    };
    if (searchParams.get('run') === '1') {
      setTimeout(() => runWithParams(found, params), 0);
    } else {
      setActiveRule(found);
      setScanParams(params);
      setEditing(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, loading, searchParams, t]);

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
    padding: '24px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)',
    maxWidth: '1200px', margin: '0 auto',
  };

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'bold', color: 'var(--text-primary, #f1f5f9)' }}>{t('screener.title')}</h1>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
            {t('screener.subtitle')}
          </p>
        </div>
        {editing == null && (
          <button
            onClick={() => setEditing('new')}
            style={{
              padding: '0.5rem 1rem', background: 'var(--accent-cyan, #06b6d4)', color: 'var(--text-on-accent)',
              fontSize: 'var(--fs-md)', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {t('screener.createRule')}
          </button>
        )}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
        background: 'color-mix(in srgb, var(--accent-cyan) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-cyan) 18%, transparent)',
        color: 'var(--accent-shell)', padding: '0.5rem 1rem', borderRadius: 'var(--r-md)', fontSize: 'var(--fs-xs)',
      }}>
        <span>{t('screener.opsHint')}</span>
        <a href="/operations-center?tab=screener" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
          {t('screener.opsLink')}
        </a>
      </div>

      {error && (
        <div style={{
          background: 'color-mix(in srgb, var(--accent-rose) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-rose) 50%, transparent)',
          color: 'var(--accent-rose)', fontSize: 'var(--fs-md)', padding: '0.75rem 1rem', borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ color: 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
          >
            {DISMISS_LABEL}
          </button>
        </div>
      )}

      {notice && (
        <div style={{
          background: 'color-mix(in srgb, var(--accent-emerald) 12%, transparent)', border: '1px solid rgba(74,222,128,0.4)',
          color: 'var(--accent-emerald)', fontSize: 'var(--fs-md)', padding: '0.75rem 1rem', borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{notice}</span>
          <button
            onClick={() => setNotice('')}
            style={{ color: 'var(--accent-emerald)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
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
              height: '64px', background: 'color-mix(in srgb, var(--bg-panel) 40%, transparent)', borderRadius: 'var(--r-lg)',
              animation: 'pulse 2s infinite',
            }} />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div style={{
          background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
          borderRadius: 'var(--r-lg)', padding: '40px', textAlign: 'center',
          color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--fs-md)',
        }}>
          {t('screener.noRules')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rules.map((rule) => (
            <div key={rule.id} style={{
              background: 'var(--bg-panel, #0f172a)', border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
              borderRadius: 'var(--r-lg)', padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '0' }}>
                  <p style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>{rule.name}</p>
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
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
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.75rem',
                      background: running === rule.id ? 'color-mix(in srgb, var(--accent-emerald) 30%, transparent)' : 'color-mix(in srgb, var(--accent-emerald) 20%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-emerald) 30%, transparent)', color: 'var(--accent-emerald)', fontSize: 'var(--fs-xs)',
                      borderRadius: 'var(--r-md)', cursor: running === rule.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500, opacity: running === rule.id ? 0.6 : 1,
                    }}
                  >
                    {running === rule.id ? (
                      <>
                        <span style={{
                          width: '12px', height: '12px', border: '2px solid color-mix(in srgb, var(--accent-emerald) 30%, transparent)',
                          borderTopColor: 'var(--accent-emerald)', borderRadius: '50%', display: 'inline-block',
                          animation: 'spin 1s linear infinite',
                        }} />
                        {t('screener.running')}
                      </>
                    ) : t('screener.run')}
                  </button>
                  <button
                    onClick={() => setEditing(rule)}
                    style={{
                      padding: '0.5rem 0.75rem', background: 'color-mix(in srgb, var(--bg-panel) 60%, transparent)',
                      border: '1px solid var(--border-default, rgba(80, 120, 168, 0.28))', color: 'var(--text-secondary, #94a3b8)',
                      fontSize: 'var(--fs-xs)', borderRadius: 'var(--r-md)', cursor: 'pointer',
                    }}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleShare(rule)}
                    title={t('screener.community.shareHint', { defaultValue: 'Chia sẻ bộ lọc này với mọi thành viên trong tenant' })}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: rule.is_public ? 'color-mix(in srgb, var(--accent-cyan) 20%, transparent)' : 'color-mix(in srgb, var(--bg-panel) 60%, transparent)',
                      border: rule.is_public ? '1px solid color-mix(in srgb, var(--accent-cyan) 40%, transparent)' : '1px solid var(--border-default, rgba(80, 120, 168, 0.28))',
                      color: rule.is_public ? 'var(--accent-cyan)' : 'var(--text-secondary, #94a3b8)',
                      fontSize: 'var(--fs-xs)', borderRadius: 'var(--r-md)', cursor: 'pointer',
                    }}
                  >
                    {rule.is_public
                      ? t('screener.community.unshare', { defaultValue: 'Hủy chia sẻ' })
                      : t('screener.community.share', { defaultValue: 'Chia sẻ' })}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id!)}
                    style={{
                      padding: '0.5rem 0.75rem', background: 'color-mix(in srgb, var(--accent-rose) 15%, transparent)',
                       border: '1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent)', color: 'var(--accent-rose)',
                      fontSize: 'var(--fs-xs)', borderRadius: 'var(--r-md)', cursor: 'pointer',
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
          background: 'color-mix(in srgb, var(--accent-cyan) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-cyan) 35%, transparent)',
          color: 'var(--accent-cyan)', fontSize: 'var(--fs-sm)', padding: '0.5rem 1rem', borderRadius: 'var(--r-md)',
        }}>
          {t('screener.previewBanner', { defaultValue: 'Kết quả chạy thử — chưa lưu thành rule' })}
          {DOT_SEPARATOR}
          {previewInfo.ruleName}
        </div>
      )}
      {jobInfo && jobStatus && (
        <div style={{
          background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
          color: 'var(--accent-blue)', fontSize: 'var(--fs-sm)', padding: '0.75rem 1rem', borderRadius: 'var(--r-md)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span>
              {t('screener.jobQueued')}
              {jobStatus.total ? ` ${jobStatus.scanned ?? 0}/${jobStatus.total} mã` : ''}
              {jobStatus.status === 'running' ? ` · ${t('screener.jobRunning')}` : ''}
            </span>
            <button
              onClick={handleCancelPoll}
              style={{
                padding: '0.25rem 0.5rem', background: 'color-mix(in srgb, var(--bg-panel) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
                color: 'var(--accent-blue)', fontSize: 'var(--fs-xs)', borderRadius: 'var(--r-sm, 6px)', cursor: 'pointer',
              }}
            >
              {t('common.cancel' as any)}
            </button>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'color-mix(in srgb, var(--accent-blue) 20%, transparent)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: jobStatus.total ? `${Math.min(100, ((jobStatus.scanned ?? 0) / jobStatus.total) * 100)}%` : '30%',
              height: '100%', background: 'var(--accent-blue)', transition: 'width 0.5s',
              animation: jobStatus.status === 'queued' ? 'pulse 1.5s infinite' : undefined,
            }} />
          </div>
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'color-mix(in srgb, var(--accent-blue) 80%, transparent)' }}>
            {t('screener.jobCancelNote')}
          </span>
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
      <ScreenerSchedulePanel rules={rules} />
      <ScreenerCommunity onForkRun={handleForkRun} onFork={handleFork} />
      <p style={{ margin: 0, fontSize: 'var(--fs-2xs)', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.5 }}>
        {t('screener.methodologyNote')}
      </p>
    </div>
  );
}