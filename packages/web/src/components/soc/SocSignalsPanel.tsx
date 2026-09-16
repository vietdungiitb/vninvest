import { createElement, useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { toneColor, statusColor as socStatusColor } from "./socStatusColors.js";
import { formatLastCheck } from "./socTime.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import styles from "./soc.module.css";

interface RecentSignal {
  id?: number;
  symbol: string;
  type: "whale" | "dark_pool" | "screener";
  action?: "buy" | "sell" | string;
  volume?: number;
  price?: number;
  detected_at: string;
  metadata?: Record<string, unknown>;
  session_date?: string | null;
  whale_volume?: number;
  total_volume?: number;
  strength?: string;
  total_value?: number;
  signal_count?: number;
  significance?: string;
  rule_name?: string;
  severity?: string;
}

/** Raw item BE trả về: {recent:[{id,symbol,severity,metadata,session_date,value,side,timestamp,title,...}]} */
interface RecentRawItem {
  id?: number;
  symbol: string;
  side?: string;
  timestamp?: string;
  value?: number | string | null;
  order_value_vnd?: number | string | null;
  matched_value_vnd?: number | string | null;
  severity?: string;
  metadata?: Record<string, unknown>;
  session_date?: string | null;
  title?: string;
}

interface RecentEnvelope {
  recent?: RecentRawItem[];
  results?: RecentSignal[];
  data?: RecentSignal[];
  total_today?: number;
  total_filtered?: number;
  page?: number;
  page_size?: number;
}

interface RecentQuery {
  page?: number;
  page_size?: number;
  type?: string;
  symbol?: string;
  severity?: string;
  direction?: string;
}

interface FeedExportPayload {
  columns?: string[];
  rows?: unknown[][];
  count?: number;
  truncated?: boolean;
}

// ─── W2.2 triage: delivery của operator (BE signals_triage.py, không nhồi recent envelope) ─
interface SignalDelivery {
  delivery_id: string;
  alert_id?: string;
  delivery_state: string;
  symbol?: string;
  alert_type?: string;
  severity?: string;
  title?: string;
  triggered_at?: string | null;
  transitioned?: boolean;
}

interface DeliveriesEnvelope {
  results?: SignalDelivery[];
  data?: SignalDelivery[];
}

// ─── W2.3 rules: config rows + precision proxy per rule ─────────────────
interface SignalRule {
  rule_key: string;
  alert_family: string;
  label?: string;
  kind: string;
  enabled: boolean | null;
  value?: unknown;
  alert_count?: number;
  acked?: number;
  muted?: number;
  suppressed?: number;
  precision_proxy?: number | null;
  hit_rate?: number | null;
}

interface RulesListResponse {
  rules?: SignalRule[];
  generated_at?: string;
}

interface RulePerformanceResponse {
  overall?: {
    alert_count?: number;
    acked?: number;
    muted?: number;
    suppressed?: number;
    precision_proxy?: number | null;
    hit_rate?: number | null;
  };
  by_family?: Array<{ alert_family: string; alert_count?: number; acked?: number; muted?: number; suppressed?: number; precision_proxy?: number | null; hit_rate?: number | null }>;
  top_noisy?: SignalRule[];
  generated_at?: string;
}

interface RuleRequestResponse {
  request_id?: string;
  pending?: boolean;
  rule_key?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: string;
}

/** W2.2: FE feed type → BE AlertTypeChoices (signal_intelligence/models.py:16-19). */
export function feedTypeToAlertType(feedType: string): string {
  if (feedType === "dark_pool") return "dark_flow";
  if (feedType === "screener") return "signal";
  return "whale";
}

/** W2.2: join delivery ↔ feed row theo (symbol, alert_type, triggered_at). */
export function deliveryKeyForSignal(s: RecentSignal): string {
  return `${(s.symbol || "").toUpperCase()}|${feedTypeToAlertType(s.type)}|${s.detected_at || ""}`;
}

export function deliveryKeyForDelivery(d: SignalDelivery): string {
  return `${(d.symbol || "").toUpperCase()}|${(d.alert_type || "").toLowerCase()}|${d.triggered_at || ""}`;
}

export function buildDeliveryMap(deliveries: SignalDelivery[]): Map<string, SignalDelivery> {
  const m = new Map<string, SignalDelivery>();
  for (const d of deliveries ?? []) {
    if (!d?.delivery_id) continue;
    const k = deliveryKeyForDelivery(d);
    if (!m.has(k)) m.set(k, d);
  }
  return m;
}

export function pickDeliveries(res: DeliveriesEnvelope | SignalDelivery[] | null | undefined): SignalDelivery[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  return res.results ?? res.data ?? [];
}

function toNumberOrUndefined(v: number | string | null | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** W0.1 mapper: BE canonical → FE RecentSignal (timestamp→detected_at, side→action, value→volume). */
export function mapRecentItem(raw: RecentRawItem, type: RecentSignal["type"]): RecentSignal {
  return {
    id: raw.id,
    symbol: raw.symbol,
    type,
    action: raw.side,
    volume: toNumberOrUndefined(raw.value ?? raw.order_value_vnd ?? raw.matched_value_vnd),
    price: undefined,
    detected_at: raw.timestamp ?? "",
    metadata: raw.metadata ?? {},
    session_date: raw.session_date ?? null,
    severity: raw.severity,
  };
}

function pickRecentList(res: RecentEnvelope | null | undefined): RecentRawItem[] {
  if (!res) return [];
  return (res.recent as RecentRawItem[] | undefined)
    ?? (res.results as unknown as RecentRawItem[] | undefined)
    ?? (res.data as unknown as RecentRawItem[] | undefined)
    ?? [];
}

/** Key expand duy nhất mỗi tín hiệu: ưu tiên id, fallback symbol+detected_at+idx. */
export function signalKey(s: RecentSignal, idx: number): string {
  if (s.id != null) return `${s.type}-${s.id}`;
  return `${s.type}-${s.symbol}-${s.detected_at}-${idx}`;
}

/** W2.1: uid ổn định để diff poll (không phụ thuộc idx phân trang). */
export function signalUid(s: RecentSignal): string {
  if (s.id != null) return `id:${s.type}:${s.id}`;
  return `k:${s.type}-${s.symbol}-${s.detected_at}`;
}

/** W2.5: dựng CSV từ rows JSON của feed export (RFC 4180 tối thiểu). */
export function buildSignalsCsv(columns: string[], rows: unknown[][]): string {
  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((_, i) => esc(r[i])).join(","))].join("\n");
}

const TERMINAL_JOB_STATUSES = new Set(["success", "partial", "failed", "skipped"]);

/** W1.4: tiến độ started→finished cho mat card (dùng CSS matCardBar có sẵn). */
export function matProgress(status: string | undefined | null): { pct: number; active: boolean } {
  const s = (status || "").toLowerCase();
  if (s === "success" || s === "partial" || s === "healthy") return { pct: 100, active: false };
  if (s === "failed") return { pct: 100, active: false };
  if (s === "running" || s === "queued") return { pct: 50, active: true };
  return { pct: 0, active: false };
}

interface PerformanceMetrics {
  signals_today?: number;
  whale_signals?: number;
  dark_pool_signals?: number;
  screener_alerts?: number;
  detection_rate?: number;
  avg_latency_ms?: number;
  // W0.2: summary/ canonical keys (FE đọc summary, không đọc performance cho counts)
  active_alerts?: number;
  whale_alerts?: number;
  dark_flow_alerts?: number;
  signal_alerts?: number;
  avg_signal_latency_ms?: number;
  sentiment?: {
    bullish?: number;
    bearish?: number;
    neutral?: number;
  };
}

interface MaterializationService {
  service_key: string;
  status: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  run_log_id: number | null;
}

interface MaterializationExecPlan {
  service_key: string;
  execution_supported: boolean;
  will_run: boolean;
  symbol: string | null;
}

interface MaterializationStatus {
  services: MaterializationService[];
  execution_plan: MaterializationExecPlan[];
  unified_alerts_available?: number;
  session_dates_available?: number;
  latest_detection_job_run_log_id?: number | null;
}

type SubTab = "overview" | "job-console" | "materialization" | "config" | "detection" | "retention" | "rules";

interface SignalTabData<T> {
  loading: boolean;
  loaded: boolean;
  error: string;
  data: T | null;
}

interface SignalOwnership {
  can_apply?: boolean;
  write_block_reason?: string;
  owner_team?: string;
  writer?: string;
  write_surface?: string;
  mode?: string;
  [k: string]: unknown;
}

const TYPE_ICONS: Record<string, string> = {
  whale: "Waves",
  dark_pool: "EyeOff",
  screener: "Search",
};

const TYPE_COLORS: Record<string, string> = {
  whale: "var(--accent-cyan, #06b6d4)",
  dark_pool: "#a78bfa",
  screener: toneColor("warning"),
};

const TYPE_BG: Record<string, string> = {
  whale: "rgba(6, 182, 212, 0.2)",
  dark_pool: "rgba(167, 139, 250, 0.2)",
  screener: "rgba(245, 158, 11, 0.2)",
};

function formatVolume(v: number | undefined | null): string {
  if (v == null) return "";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return String(v);
}

function getActionLabel(action: string | undefined): { cls: string; text: string } {
  if (!action) return { cls: styles.signalLabelNeutral, text: "\u2014" };
  const a = action.toLowerCase();
  if (a === "buy" || a === "b" || a === "accumulate") return { cls: styles.signalLabelBuy, text: "BUY" };
  if (a === "sell" || a === "s" || a === "distribute") return { cls: styles.signalLabelSell, text: "SELL" };
  return { cls: styles.signalLabelNeutral, text: action.toUpperCase() };
}

export function SocSignalsPanel() {
  const { t, localeTag } = useI18n() as unknown as { t: (k: string, o?: any) => string; localeTag: string };

  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [matError, setMatError] = useState("");

  const [signals, setSignals] = useState<RecentSignal[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [materialization, setMaterialization] = useState<MaterializationStatus | null>(null);

  const [typeFilter, setTypeFilter] = useState("all");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [debouncedSymbol, setDebouncedSymbol] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [jobDomain, setJobDomain] = useState("whale");
  const [jobSymbol, setJobSymbol] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobPolling, setJobPolling] = useState(false);
  const [jobRunId, setJobRunId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  // W1.3: lazy data cho 3 subtabs mới (chỉ fetch khi mở tab — tiết kiệm req)
  const emptyTab = <T,>(): SignalTabData<T> => ({ loading: false, loaded: false, error: "", data: null });
  const [configTab, setConfigTab] = useState<SignalTabData<{ config: Record<string, unknown>; ownership: SignalOwnership }>>(emptyTab());
  const [detectionTab, setDetectionTab] = useState<SignalTabData<{ whale: Record<string, unknown>; dark: Record<string, unknown>; screener: Record<string, unknown> }>>(emptyTab());
  const [retentionTab, setRetentionTab] = useState<SignalTabData<Record<string, unknown>>>(emptyTab());
  const [testSymbol, setTestSymbol] = useState("VNM");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ symbol?: string; test_result?: string; detection_possible?: boolean } | null>(null);
  const [retentionPreview, setRetentionPreview] = useState<SignalTabData<{ valid?: boolean; errors?: string[]; retention_days?: Record<string, unknown>; impact?: Record<string, unknown> }>>(emptyTab());

  // W2.1 poll-diff: tín hiệu mới từ poll + badge chưa đọc
  const [newUids, setNewUids] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const prevUidsRef = useRef<Set<string>>(new Set());
  const prevTitleRef = useRef("");
  const titleSavedRef = useRef(false);
  // W2.5 export CSV
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  // W2.2 triage ack/mute (deliveries của operator, fetch song song — không nhồi recent)
  const [deliveries, setDeliveries] = useState<SignalDelivery[]>([]);
  const [triageError, setTriageError] = useState("");
  const [triageMsg, setTriageMsg] = useState("");
  const [unackedOnly, setUnackedOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [acking, setAcking] = useState(false);
  const [muteTarget, setMuteTarget] = useState<SignalDelivery | null>(null);
  const [muteMinutes, setMuteMinutes] = useState("60");
  const [muteReason, setMuteReason] = useState("");
  const [muteSaving, setMuteSaving] = useState(false);

  // W2.3 rule management: lazy data (chỉ fetch khi mở subtab Rules)
  const [rulesTab, setRulesTab] = useState<SignalTabData<{ rules: SignalRule[] }>>(emptyTab());
  const [rulesPerf, setRulesPerf] = useState<SignalTabData<RulePerformanceResponse>>(emptyTab());
  const [ruleModal, setRuleModal] = useState<SignalRule | null>(null);
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [ruleThreshold, setRuleThreshold] = useState("");
  const [ruleCooldown, setRuleCooldown] = useState("");
  const [ruleRatio, setRuleRatio] = useState("");
  const [ruleReason, setRuleReason] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleResult, setRuleResult] = useState<RuleRequestResponse | null>(null);
  const [ruleMsg, setRuleMsg] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState("");

  const filterTypes = ["all", "whale", "dark_pool", "screener"];

  const mountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const intervalDelayRef = useRef(15000); // W1.5: 10s->15s
  const jobPollRef = useRef<number | null>(null);
  const jobDeadlineRef = useRef(0);
  const isFirstFilterRun = useRef(true);

  type SocSignalsAdapter = {
    getSocSignalMetrics: () => Promise<PerformanceMetrics>;
    getSocWhaleRecent: (params?: RecentQuery) => Promise<RecentEnvelope>;
    getSocDarkPoolRecent: (params?: RecentQuery) => Promise<RecentEnvelope>;
    getSocScreenerRecent: (params?: RecentQuery) => Promise<RecentEnvelope>;
    getSocSignalMaterialization: () => Promise<MaterializationStatus>;
    runSocSignalJob: (domain: string, symbol: string) => Promise<{ status?: string; run_log_id?: number; message?: string }>;
    getSocSignalJobStatus: (runLogId: number) => Promise<{ status?: string; run_log_id?: number; error_detail?: string }>;
    getSocSignalConfig: () => Promise<{ config?: Record<string, unknown>; config_payload?: Record<string, unknown>; ownership?: SignalOwnership; note?: string }>;
    getSocSignalOwnership: () => Promise<SignalOwnership>;
    getSocWhaleDetection: () => Promise<Record<string, unknown>>;
    getSocDarkPoolDetection: () => Promise<Record<string, unknown>>;
    getSocScreenerDetection: () => Promise<Record<string, unknown>>;
    getSocSignalRetention: () => Promise<Record<string, unknown>>;
    testSocWhaleDetection: (symbol?: string) => Promise<{ symbol?: string; test_result?: string; detection_possible?: boolean }>;
    previewSocSignalRetention: (config?: Record<string, unknown>) => Promise<{ valid?: boolean; errors?: string[]; retention_days?: Record<string, unknown>; impact?: Record<string, unknown> }>;
    exportSocSignalFeed: (params?: RecentQuery) => Promise<FeedExportPayload>;
    getSocSignalDeliveries: (params?: { page?: number; page_size?: number; delivery_state?: string; symbol?: string; unacked_only?: boolean }) => Promise<DeliveriesEnvelope | SignalDelivery[]>;
    markSocSignalDeliverySeen: (deliveryId: string) => Promise<SignalDelivery>;
    ackSocSignalDelivery: (deliveryId: string) => Promise<SignalDelivery>;
    muteSocSignalDeliveries: (payload: { symbol?: string; alert_family?: string; mute_minutes?: number; cooldown_seconds?: number; reason?: string }) => Promise<{ symbol?: string; alert_family?: string; mute_until?: string | null }>;
    getSocSignalRules: () => Promise<RulesListResponse>;
    getSocSignalRulesPerformance: () => Promise<RulePerformanceResponse>;
    requestSocSignalRuleChange: (payload: Record<string, unknown>) => Promise<RuleRequestResponse>;
    feedbackSocSignalRule: (payload: { alert_id: string; signal: "up" | "down"; reason?: string }) => Promise<SignalDelivery & { signal?: string; feedback_reason?: string }>;
  };

  const getAdapter = () => defaultCoreApiAdapter as unknown as SocSignalsAdapter;

  // W0.3: feed (summary + 3 recents) tách khỏi materialization — 1 section lỗi không sập tab.
  // W1.1: gửi filter xuống BE (page_size=100 để gộp 3 nguồn rồi phân trang client).
  const fetchFeed = async (query?: RecentQuery) => {
    const adapter = getAdapter();
    const q: RecentQuery = {
      page_size: 100,
      ...(query?.symbol ? { symbol: query.symbol } : {}),
      ...(query?.severity ? { severity: query.severity } : {}),
      ...(query?.direction ? { direction: query.direction } : {}),
    };
    try {
      const [summary, whaleRes, darkPoolRes, screenerRes] = await Promise.all([
        adapter.getSocSignalMetrics(),
        adapter.getSocWhaleRecent(q),
        adapter.getSocDarkPoolRecent(q),
        adapter.getSocScreenerRecent(q),
      ]);

      const whaleList = pickRecentList(whaleRes).map((s) => mapRecentItem(s, "whale"));
      const darkPoolList = pickRecentList(darkPoolRes).map((s) => mapRecentItem(s, "dark_pool"));
      const screenerList = pickRecentList(screenerRes).map((s) => mapRecentItem(s, "screener"));

      const merged = [...whaleList, ...darkPoolList, ...screenerList].sort((a, b) => {
        const da = a.detected_at ? new Date(a.detected_at).getTime() : 0;
        const db = b.detected_at ? new Date(b.detected_at).getTime() : 0;
        return db - da;
      });

      if (!mountedRef.current) return;
      setSignals(merged);
      setMetrics(summary);
      setFeedError("");
      // W2.1: diff với snapshot poll trước — chỉ tính khi đã có snapshot (bỏ qua lần đầu)
      const uids = merged.map(signalUid);
      if (prevUidsRef.current.size > 0) {
        const arrivals = uids.filter((id) => !prevUidsRef.current.has(id));
        if (arrivals.length > 0 && mountedRef.current) {
          // F-P2A-A: cộng dồn nhiều poll (unread tích lũy cùng số row highlight)
          setNewUids((prev) => [...prev, ...arrivals]);
          setUnread((u) => u + arrivals.length);
        }
      }
      prevUidsRef.current = new Set(uids);
    } catch (err) {
      if (!mountedRef.current) return;
      setFeedError(err instanceof Error ? err.message : "Cannot load signal feed.");
      throw err;
    }
  };

  const fetchMaterialization = async () => {
    try {
      const matStatus = await getAdapter().getSocSignalMaterialization();
      if (!mountedRef.current) return;
      setMaterialization(matStatus);
      setMatError("");
    } catch (err) {
      if (!mountedRef.current) return;
      setMatError(err instanceof Error ? err.message : "Cannot load materialization.");
      throw err;
    }
  };

  // W2.2: deliveries fetch riêng — lỗi triage không sập feed/mat (auxiliary, không tính poll ok).
  const fetchDeliveries = async () => {
    try {
      const res = await getAdapter().getSocSignalDeliveries({ page_size: 100 });
      if (!mountedRef.current) return;
      setDeliveries(pickDeliveries(res));
      setTriageError("");
    } catch (err) {
      if (!mountedRef.current) return;
      setTriageError(err instanceof Error ? err.message : "Cannot load deliveries.");
    }
  };

  // W2.3: fetch rules list + performance (lazy theo subtab, không cộng req vào poll).
  const fetchRulesTab = async () => {
    setRulesTab((s) => ({ ...s, loading: true }));
    try {
      const [list, perf] = await Promise.all([
        getAdapter().getSocSignalRules(),
        getAdapter().getSocSignalRulesPerformance(),
      ]);
      if (!mountedRef.current) return;
      setRulesTab({ loading: false, loaded: true, error: "", data: { rules: list.rules ?? [] } });
      setRulesPerf({ loading: false, loaded: true, error: "", data: perf });
    } catch (err) {
      if (!mountedRef.current) return;
      setRulesTab({ loading: false, loaded: false, error: errMsg(err, "Cannot load signal rules."), data: null });
      setRulesPerf({ loading: false, loaded: false, error: "", data: null });
    }
  };

  const notePollResult = (ok: boolean) => {
    if (ok) {
      const hadBackoff = consecutiveErrorsRef.current >= 3;
      consecutiveErrorsRef.current = 0;
      if (hadBackoff) restartInterval(15000);
    } else {
      consecutiveErrorsRef.current += 1;
      // R2: after 3 consecutive poll failures, slow 15s → 60s
      if (consecutiveErrorsRef.current >= 3 && intervalDelayRef.current === 15000) {
        restartInterval(60000);
      }
    }
  };

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    let ok = true;
    try {
      await fetchFeed();
    } catch {
      ok = false;
    }
    try {
      await fetchMaterialization();
    } catch {
      ok = false;
    }
    await fetchDeliveries();
    if (!mountedRef.current) return;
    // R2: silent poll chỉ hiện banner section, không spam; backoff sau 3 lỗi liên tiếp
    if (!isSilent || !ok) notePollResult(ok);
    if (!isSilent) setLoading(false);
  };

  const pollOnce = async () => {
    let ok = true;
    try {
      await fetchFeed();
    } catch {
      ok = false;
    }
    try {
      await fetchMaterialization();
    } catch {
      ok = false;
    }
    await fetchDeliveries();
    if (!mountedRef.current) return;
    notePollResult(ok);
  };

  const restartInterval = (delayMs: number) => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    // W1.5-gọn cho P0: jitter 0–3s tránh 5 req dồn cùng lúc
    const jittered = delayMs + Math.floor(Math.random() * 3000);
    intervalDelayRef.current = delayMs;
    intervalRef.current = window.setInterval(() => {
      void pollOnce();
    }, jittered);
  };

  const stopJobPoll = () => {
    if (jobPollRef.current !== null) {
      window.clearInterval(jobPollRef.current);
      jobPollRef.current = null;
    }
    if (mountedRef.current) setJobPolling(false);
  };

  useEffect(() => {
    mountedRef.current = true;
    void fetchData(false);
    restartInterval(15000);
    // W0.4: tab ẩn → pause poll nền, hiện → fetch ngay (pattern overview W13)
    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      } else {
        void pollOnce();
        restartInterval(intervalDelayRef.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      stopJobPoll();
      // W2.1: unmount trả lại title gốc
      if (titleSavedRef.current && typeof document !== "undefined") {
        document.title = prevTitleRef.current;
        prevTitleRef.current = "";
        titleSavedRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // W1.1: debounce 300ms cho ô tìm mã (pattern overview W9)
  useEffect(() => {
    const h = window.setTimeout(() => setDebouncedSymbol(symbolFilter.trim().toUpperCase()), 300);
    return () => window.clearTimeout(h);
  }, [symbolFilter]);

  // W1.1: filter đổi → reset page + fetch lại feed với query BE
  // W2.1: đổi filter coi như xem mới — reset snapshot poll-diff, tránh báo "mới" giả
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    setPage(1);
    setExpandedId(null);
    setSelectedIds([]);
    prevUidsRef.current = new Set();
    setNewUids([]);
    setUnread(0);
    void fetchFeed({
      symbol: debouncedSymbol || undefined,
      severity: severityFilter !== "all" ? severityFilter : undefined,
      direction: directionFilter !== "all" ? directionFilter : undefined,
    }).then(() => notePollResult(true)).catch(() => notePollResult(false));
    restartInterval(intervalDelayRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSymbol, severityFilter, directionFilter]);

  // W2.1: badge chưa đọc lên <title>, trả lại khi đã đọc hết
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (unread > 0) {
      if (!titleSavedRef.current) {
        prevTitleRef.current = document.title;
        titleSavedRef.current = true;
      }
      document.title = `(${unread}) ${prevTitleRef.current}`;
    } else if (titleSavedRef.current) {
      document.title = prevTitleRef.current;
      prevTitleRef.current = "";
      titleSavedRef.current = false;
    }
  }, [unread]);

  const markAllRead = () => {
    setNewUids([]);
    setUnread(0);
  };

  const errMsg = (err: unknown, fallback: string): string => (err instanceof Error ? err.message : fallback);

  // W1.3: lazy-load 3 subtabs khi mở lần đầu (không cộng req vào poll chính)
  useEffect(() => {
    if (subTab === "config" && !configTab.loaded && !configTab.loading) {
      setConfigTab((s) => ({ ...s, loading: true }));
      const adapter = getAdapter();
      Promise.all([adapter.getSocSignalConfig(), adapter.getSocSignalOwnership()])
        .then(([cfg, ownership]) => {
          if (!mountedRef.current) return;
          setConfigTab({
            loading: false,
            loaded: true,
            error: "",
            data: { config: cfg.config ?? cfg.config_payload ?? {}, ownership: (cfg.ownership as SignalOwnership) ?? ownership },
          });
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setConfigTab({ loading: false, loaded: false, error: errMsg(err, "Cannot load signal config."), data: null });
        });
    }
    if (subTab === "detection" && !detectionTab.loaded && !detectionTab.loading) {
      setDetectionTab((s) => ({ ...s, loading: true }));
      const adapter = getAdapter();
      Promise.all([adapter.getSocWhaleDetection(), adapter.getSocDarkPoolDetection(), adapter.getSocScreenerDetection()])
        .then(([whale, dark, screener]) => {
          if (!mountedRef.current) return;
          setDetectionTab({ loading: false, loaded: true, error: "", data: { whale, dark, screener } });
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setDetectionTab({ loading: false, loaded: false, error: errMsg(err, "Cannot load detection settings."), data: null });
        });
    }
    if (subTab === "retention" && !retentionTab.loaded && !retentionTab.loading) {
      setRetentionTab((s) => ({ ...s, loading: true }));
      getAdapter().getSocSignalRetention()
        .then((policy) => {
          if (!mountedRef.current) return;
          setRetentionTab({ loading: false, loaded: true, error: "", data: policy });
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setRetentionTab({ loading: false, loaded: false, error: errMsg(err, "Cannot load retention policy."), data: null });
        });
    }
    // W2.3: rules list + performance — lazy, không cộng vào poll chính (1 lần cho mỗi session)
    if (subTab === "rules" && !rulesTab.loaded && !rulesTab.loading) {
      void fetchRulesTab();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  // ─── W2.2 triage: join deliveries ↔ feed + ack/mute handlers ──────────────
  const deliveryMap = useMemo(() => buildDeliveryMap(deliveries), [deliveries]);
  const deliveryFor = (s: RecentSignal): SignalDelivery | undefined => deliveryMap.get(deliveryKeyForSignal(s));

  const deliveryBadgeCls = (state: string): string => {
    const s = (state || "").toLowerCase();
    if (s === "acknowledged") return styles.signalLabelBuy;
    if (s === "muted" || s === "suppressed") return styles.signalLabelSell;
    return styles.signalLabelNeutral;
  };

  const deliveryStateLabel = (state: string): string =>
    t(`soc.signals_overview.delivery_state_${(state || "new").toLowerCase()}`, { defaultValue: state || "new" });

  const applyDeliveryUpdate = (updated: SignalDelivery | null | undefined, fallback: SignalDelivery) => {
    const next = { ...fallback, ...(updated ?? {}) };
    if (!mountedRef.current) return;
    setDeliveries((prev) => prev.map((x) => (x.delivery_id === next.delivery_id ? next : x)));
  };

  // seen tự đánh khi expand row (BE transition guard new→seen)
  const markSeen = async (d: SignalDelivery) => {
    try {
      const updated = await getAdapter().markSocSignalDeliverySeen(d.delivery_id);
      applyDeliveryUpdate(updated, { ...d, delivery_state: "seen" });
    } catch {
      // silent — badge giữ "Mới", không spam banner poll
    }
  };

  const triageFailMsg = (err: unknown): string =>
    `${t("soc.signals_overview.triage_failed", { defaultValue: "Thao tác triage thất bại." })} ${errMsg(err, "")}`.trim();

  const handleAckOne = async (d: SignalDelivery) => {
    setAcking(true);
    setTriageMsg("");
    try {
      const updated = await getAdapter().ackSocSignalDelivery(d.delivery_id);
      applyDeliveryUpdate(updated, { ...d, delivery_state: "acknowledged" });
      setSelectedIds((prev) => prev.filter((id) => id !== d.delivery_id));
      if (mountedRef.current) setTriageMsg(t("soc.signals_overview.triage_ack_done", { n: 1, defaultValue: "Đã ghi nhận 1 tín hiệu." }));
    } catch (err) {
      if (mountedRef.current) setTriageMsg(triageFailMsg(err));
    } finally {
      if (mountedRef.current) setAcking(false);
    }
  };

  const handleAckSelected = async () => {
    const targets = deliveries.filter((d) => selectedIds.includes(d.delivery_id) && d.delivery_state !== "acknowledged");
    if (targets.length === 0) return;
    setAcking(true);
    setTriageMsg("");
    let done = 0;
    for (const d of targets) {
      try {
        const updated = await getAdapter().ackSocSignalDelivery(d.delivery_id);
        applyDeliveryUpdate(updated, { ...d, delivery_state: "acknowledged" });
        done += 1;
      } catch {
        // tiếp tục bulk — tổng kết cuối
      }
    }
    if (!mountedRef.current) return;
    setSelectedIds([]);
    setTriageMsg(done === targets.length
      ? t("soc.signals_overview.triage_ack_done", { n: done, defaultValue: `Đã ghi nhận ${done} tín hiệu.` })
      : `${t("soc.signals_overview.triage_failed", { defaultValue: "Thao tác triage thất bại." })} (${done}/${targets.length})`);
    setAcking(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleMuteSubmit = async () => {
    if (!muteTarget) return;
    const minutes = Number(muteMinutes) || 0;
    setMuteSaving(true);
    try {
      await getAdapter().muteSocSignalDeliveries({
        symbol: muteTarget.symbol || "",
        alert_family: muteTarget.alert_type || "",
        mute_minutes: minutes,
        reason: muteReason.trim(),
      });
      if (!mountedRef.current) return;
      setTriageMsg(t("soc.signals_overview.triage_mute_done", {
        symbol: muteTarget.symbol || "",
        defaultValue: `Đã tắt tiếng ${muteTarget.symbol || ""}.`,
      }));
      setMuteTarget(null);
      setMuteReason("");
      void fetchDeliveries();
    } catch (err) {
      if (mountedRef.current) setTriageMsg(triageFailMsg(err));
    } finally {
      if (mountedRef.current) setMuteSaving(false);
    }
  };

  // ─── W2.3 feedback thumbs on feed row (precision) ───────────────────────
  const handleSignalFeedback = async (d: SignalDelivery, signal: "up" | "down") => {
    if (!d.alert_id || feedbackBusy) return;
    setFeedbackBusy(d.delivery_id);
    setTriageMsg("");
    try {
      const updated = await getAdapter().feedbackSocSignalRule({
        alert_id: d.alert_id,
        signal,
        reason: signal === "down" ? "precision feedback: inaccurate" : "",
      });
      applyDeliveryUpdate(updated, {
        ...d,
        delivery_state: signal === "up" ? "acknowledged" : "suppressed",
      });
      setSelectedIds((prev) => prev.filter((id) => id !== d.delivery_id));
      if (mountedRef.current) {
        setTriageMsg(t("soc.signals_overview.feedback_thanks", { defaultValue: "Đã ghi phản hồi." }));
      }
    } catch (err) {
      if (mountedRef.current) setTriageMsg(triageFailMsg(err));
    } finally {
      if (mountedRef.current) setFeedbackBusy("");
    }
  };

  // ─── W2.3 rule change request modal ─────────────────────────────────────
  const openRuleModal = (rule: SignalRule) => {
    setRuleResult(null);
    setRuleMsg("");
    setRuleEnabled(rule.enabled !== false);
    setRuleThreshold(rule.value != null ? String(rule.value) : "");
    setRuleCooldown(rule.value != null ? String(rule.value) : "");
    setRuleRatio(rule.value != null ? String(rule.value) : "");
    setRuleReason("");
    setRuleModal(rule);
  };

  const handleRuleRequestSubmit = async () => {
    if (!ruleModal) return;
    setRuleSaving(true);
    setRuleMsg("");
    const ruleKey = ruleModal.rule_key;
    const payload: Record<string, unknown> = {
      rule_key: ruleKey,
      change_reason: ruleReason.trim() || "SOC request",
    };
    if (ruleModal.kind === "enabled") payload.enabled = ruleEnabled;
    if (ruleModal.kind === "threshold") payload.threshold_vnd = Number(ruleThreshold) || 0;
    if (ruleModal.kind === "cooldown") payload.cooldown_seconds = Number(ruleCooldown) || 0;
    if (ruleModal.kind === "ratio") {
      payload[ruleKey === "whale_top_pct" ? "top_pct" : "block_ratio_min"] = Number(ruleRatio) || 0;
    }
    try {
      const res = await getAdapter().requestSocSignalRuleChange(payload);
      if (!mountedRef.current) return;
      setRuleResult(res);
      setRuleMsg(t("soc.signals_overview.rule_request_sent", { defaultValue: "Đã gửi yêu cầu đổi rule. Owner sẽ duyệt (bridge-write)." }));
      setRuleModal(null);
    } catch (err) {
      if (mountedRef.current) {
        setRuleMsg(`${t("soc.signals_overview.rule_request_failed", { defaultValue: "Gửi yêu cầu thất bại." })} ${errMsg(err, "")}`.trim());
      }
    } finally {
      if (mountedRef.current) setRuleSaving(false);
    }
  };

  const filteredSignals = useMemo(() => {
    const q = symbolFilter.trim().toUpperCase();
    return signals.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (q && !s.symbol.toUpperCase().includes(q)) return false;
      // W1.1: lọc client thêm 1 lớp (BE đã lọc qua query — dự phòng khi envelope cũ)
      if (severityFilter !== "all" && (s.severity || "").toLowerCase() !== severityFilter) return false;
      if (directionFilter !== "all" && (s.action || "").toLowerCase() !== directionFilter) return false;
      // W2.2: "Chưa ack" — ẩn row đã acknowledged, giữ new/seen/muted + row chưa có delivery
      if (unackedOnly) {
        const d = deliveryMap.get(deliveryKeyForSignal(s));
        if (d && d.delivery_state === "acknowledged") return false;
      }
      return true;
    });
  }, [signals, typeFilter, symbolFilter, severityFilter, directionFilter, deliveryMap, unackedOnly]);

  // W1.1: phân trang client trên feed đã gộp 3 nguồn (BE paging theo từng nguồn, không gộp được)
  const totalPages = Math.max(1, Math.ceil(filteredSignals.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedSignals = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSignals.slice(start, start + pageSize);
  }, [filteredSignals, safePage, pageSize]);
  const pageFrom = filteredSignals.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageTo = Math.min(safePage * pageSize, filteredSignals.length);

  const stats = useMemo(() => {
    // W0.2: counts lấy từ summary/ canonical (active/whale/dark_flow/signal_alerts),
    // không đọc performance (BE không có 4 keys này — F-SG-04).
    const total = metrics?.active_alerts ?? metrics?.signals_today ?? signals.length;
    const whaleCount = metrics?.whale_alerts ?? metrics?.whale_signals ?? signals.filter((s) => s.type === "whale").length;
    const darkPoolCount = metrics?.dark_flow_alerts ?? metrics?.dark_pool_signals ?? signals.filter((s) => s.type === "dark_pool").length;
    const screenerCount = metrics?.signal_alerts ?? metrics?.screener_alerts ?? signals.filter((s) => s.type === "screener").length;
    const detectionRate = metrics?.detection_rate ?? null;
    // W0.2: BE key chuẩn là avg_signal_latency_ms (F-SG-03).
    const avgLatency = metrics?.avg_signal_latency_ms ?? metrics?.avg_latency_ms ?? null;
    return { total, whaleCount, darkPoolCount, screenerCount, detectionRate, avgLatency };
  }, [signals, metrics]);

  const sentiment = metrics?.sentiment ?? { bullish: 0, bearish: 0, neutral: 0 };
  const totalSentiment = (sentiment.bullish || 0) + (sentiment.bearish || 0) + (sentiment.neutral || 0);
  const bullPct = totalSentiment > 0 ? ((sentiment.bullish || 0) / totalSentiment) * 100 : 0;
  const bearPct = totalSentiment > 0 ? ((sentiment.bearish || 0) / totalSentiment) * 100 : 0;
  const neutPct = totalSentiment > 0 ? ((sentiment.neutral || 0) / totalSentiment) * 100 : 0;

  const handleRunJob = async () => {
    const sym = jobSymbol.trim().toUpperCase();
    if (!sym) return;
    if (!/^[A-Z0-9]{3,4}$/.test(sym)) {
      setJobStatus(t("soc.signals_overview.symbol_invalid", { defaultValue: "Mã không hợp lệ (3-4 ký tự A-Z0-9)" }));
      return;
    }
    setJobLoading(true);
    setJobPolling(false);
    setJobStatus(null);
    setJobRunId(null);
    stopJobPoll();
    try {
      const adapter = getAdapter();
      const result = await adapter.runSocSignalJob(jobDomain, sym);
      const runId = result.run_log_id ?? null;
      setJobRunId(runId);
      if (runId == null) {
        setJobStatus(result.status || result.message || t("soc.signals_overview.job_queued"));
        return;
      }
      // W0.4: poll status theo run_log_id 3s/lần đến terminal, timeout 5 phút.
      setJobPolling(true);
      setJobStatus(t("soc.signals_overview.job_polling", { defaultValue: "Đang theo dõi job..." }));
      jobDeadlineRef.current = Date.now() + 5 * 60 * 1000;
      const checkOnce = async (): Promise<boolean> => {
        if (!mountedRef.current) return true;
        if (Date.now() > jobDeadlineRef.current) {
          if (mountedRef.current) setJobStatus(t("soc.signals_overview.job_timeout", { defaultValue: "Job quá 5 phút chưa xong — kiểm tra lại sau." }));
          return true;
        }
        try {
          const st = await adapter.getSocSignalJobStatus(runId);
          if (!mountedRef.current) return true;
          const s = (st.status || "").toLowerCase();
          if (TERMINAL_JOB_STATUSES.has(s)) {
            setJobStatus(s === "failed" ? (st.error_detail || `Job ${s}`) : `Job ${s} (run #${runId})`);
            return true;
          }
          setJobStatus(t("soc.signals_overview.job_polling", { defaultValue: "Đang theo dõi job..." }) + ` (${st.status || "queued"})`);
          return false;
        } catch (err) {
          if (!mountedRef.current) return true;
          setJobStatus(err instanceof Error ? err.message : "Job failed.");
          return true;
        }
      };
      const done = await checkOnce();
      if (!done && mountedRef.current) {
        jobPollRef.current = window.setInterval(() => {
          void (async () => {
            const finished = await checkOnce();
            if (finished) stopJobPoll();
          })();
        }, 3000);
      } else {
        stopJobPoll();
      }
    } catch (err) {
      setJobStatus(err instanceof Error ? err.message : "Job failed.");
    } finally {
      if (mountedRef.current) setJobLoading(false);
    }
  };

  const signalTypeLabel = (type: string): string => {
    if (type === "whale") return t("soc.signals_overview.filter_whale");
    if (type === "dark_pool") return t("soc.signals_overview.filter_dark_pool");
    if (type === "screener") return t("soc.signals_overview.filter_screener");
    return type;
  };

  // W1.4: từ mat card nhảy sang job console xem đúng run_log_id
  const handleViewJobStatus = async (runId: number) => {
    setSubTab("job-console");
    setJobRunId(runId);
    setJobStatus(t("soc.signals_overview.job_polling", { defaultValue: "Đang theo dõi job..." }));
    try {
      const st = await getAdapter().getSocSignalJobStatus(runId);
      if (!mountedRef.current) return;
      const s = (st.status || "").toLowerCase();
      setJobStatus(s === "failed" ? (st.error_detail || `Job ${s}`) : `Job ${s || "unknown"} (run #${runId})`);
    } catch (err) {
      if (!mountedRef.current) return;
      setJobStatus(err instanceof Error ? err.message : "Job failed.");
    }
  };

  // ─── Stat card ─────────────────────────────────────────────────────────
  const statCard = (label: string, value: string | number, color: string) =>
    createElement("div", { className: styles.metricCardSm, key: label },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color, fontSize: "1rem" } }, String(value)),
    );

  // W2.5: xuất CSV feed qua blob client-side (pattern overview Step 6)
  const handleExportFeed = async () => {
    setExporting(true);
    setExportError("");
    try {
      const payload = await getAdapter().exportSocSignalFeed({
        type: typeFilter !== "all" ? typeFilter : undefined,
        symbol: debouncedSymbol || undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
        direction: directionFilter !== "all" ? directionFilter : undefined,
      });
      const csv = buildSignalsCsv(payload.columns ?? [], payload.rows ?? []);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signals-feed-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (mountedRef.current) setExportError(errMsg(err, "Export failed."));
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  };

  // ─── Signal row ────────────────────────────────────────────────────────
  const renderSignalRow = (s: RecentSignal, idx: number) => {
    const key = signalKey(s, idx);
    const isExpanded = expandedId === key;
    const isNew = newUids.includes(signalUid(s));
    const action = getActionLabel(s.action);
    // W2.2: delivery join theo (symbol, alert_type, triggered_at) — row không khớp thì không badge
    const delivery = deliveryFor(s);
    const selectable = !!delivery && delivery.delivery_state !== "acknowledged";
    const handleClick = () => {
      const willExpand = !isExpanded;
      setExpandedId(isExpanded ? null : key);
      // W2.2: seen tự đánh khi expand row (chỉ khi còn new)
      if (willExpand && delivery && delivery.delivery_state === "new" && delivery.delivery_id) {
        void markSeen(delivery);
      }
    };
    const handleKeyDown = (e: { key: string; preventDefault: () => void }) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    };
    const metaJson = s.metadata ? JSON.stringify(s.metadata, null, 2) : null;
    const when = formatLastCheck(s.detected_at, localeTag, t);

    return createElement(
      "div",
      { key },
      createElement(
        "div",
        {
          className: `${styles.signalRow} ${isExpanded ? styles.signalRowExpanded : ""} ${isNew ? styles.signalRowNew : ""}`,
          onClick: handleClick,
          onKeyDown: handleKeyDown,
          role: "button",
          tabIndex: 0,
          "aria-expanded": isExpanded,
        },
        selectable
          ? createElement("input", {
              type: "checkbox",
              checked: selectedIds.includes(delivery.delivery_id),
              "aria-label": `${t("soc.signals_overview.triage_ack", { defaultValue: "Đã nhận" })} ${s.symbol}`,
              onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
              onChange: () => toggleSelect(delivery.delivery_id),
            })
          : null,
        createElement("div", {
          className: styles.signalIcon,
          style: { background: TYPE_BG[s.type] ?? "transparent", color: TYPE_COLORS[s.type] },
        }, createElement(LucideIcon, { name: TYPE_ICONS[s.type] || "Activity", className: "h-3.5 w-3.5" })),
        createElement("div", { className: styles.signalSymbol }, s.symbol),
        createElement("div", { className: `${styles.signalLabel} ${action.cls}` }, action.text),
        createElement("div", { className: styles.signalVolume },
          s.volume != null ? formatVolume(s.volume) : "",
        ),
        createElement("div", { className: styles.signalTime, title: when.title },
          when.display,
        ),
        // W2.2: cột trạng thái delivery
        delivery
          ? createElement("div", {
              className: `${styles.signalLabel} ${deliveryBadgeCls(delivery.delivery_state)}`,
              title: deliveryStateLabel(delivery.delivery_state),
            }, deliveryStateLabel(delivery.delivery_state))
          : null,
      ),
      isExpanded && metaJson
        ? createElement("div", { className: styles.signalMeta },
            metaJson,
            // W2.2: Ack single + Mute trong chi tiết expand
            delivery
              ? createElement("div", { style: { display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" } },
                  delivery.delivery_state !== "acknowledged" && delivery.delivery_state !== "suppressed"
                    ? createElement("button", {
                        className: styles.runBtn,
                        disabled: acking,
                        onClick: (e: { stopPropagation: () => void }) => {
                          e.stopPropagation();
                          void handleAckOne(delivery);
                        },
                      }, t("soc.signals_overview.triage_ack", { defaultValue: "Đã nhận" }))
                    : null,
                  delivery.delivery_state !== "acknowledged" && delivery.delivery_state !== "suppressed" && delivery.alert_id
                    ? createElement("button", {
                        className: styles.pageBtn,
                        disabled: feedbackBusy === delivery.delivery_id,
                        title: t("soc.signals_overview.feedback_up", { defaultValue: "Chính xác" }),
                        onClick: (e: { stopPropagation: () => void }) => {
                          e.stopPropagation();
                          void handleSignalFeedback(delivery, "up");
                        },
                      }, t("soc.signals_overview.feedback_up", { defaultValue: "Chính xác" }))
                    : null,
                  delivery.delivery_state !== "muted" && delivery.delivery_state !== "suppressed" && delivery.alert_id
                    ? createElement("button", {
                        className: styles.pageBtn,
                        disabled: feedbackBusy === delivery.delivery_id,
                        title: t("soc.signals_overview.feedback_down", { defaultValue: "Không chính xác" }),
                        onClick: (e: { stopPropagation: () => void }) => {
                          e.stopPropagation();
                          void handleSignalFeedback(delivery, "down");
                        },
                      }, t("soc.signals_overview.feedback_down", { defaultValue: "Không chính xác" }))
                    : null,
                  createElement("button", {
                    className: styles.pageBtn,
                    onClick: (e: { stopPropagation: () => void }) => {
                      e.stopPropagation();
                      setMuteReason("");
                      setMuteTarget(delivery);
                    },
                  }, t("soc.signals_overview.triage_mute", { defaultValue: "Tắt tiếng" })),
                )
              : null,
          )
        : null,
    );
  };

  // ─── Radar Empty State ────────────────────────────────────────────────
  const renderRadarEmptyState = () => {
    return createElement("div", { className: styles.radarContainer },
      createElement("div", { className: styles.radarRingOuter },
        createElement("div", { className: styles.radarRingInner },
          createElement("div", { className: styles.radarSweep })
        )
      ),
      createElement("p", { className: styles.radarTextTitle }, t("soc.signals_overview.no_signals")),
      createElement("p", { className: styles.radarTextSub }, t("soc.signals_overview.scanning_hint"))
    );
  };

  // ─── Sentiment tab ─────────────────────────────────────────────────────
  const renderOverviewTab = () => {
    return createElement("div", null,
      createElement("h4", { },
        t("soc.signals_overview.sentiment"),
      ),
      createElement(
        "div",
        { className: styles.sentimentBar },
        totalSentiment === 0
          ? createElement("div", {
              className: styles.sentimentSegment,
              style: { width: "100%", background: "rgba(148, 163, 184, 0.15)", color: "var(--color-text-muted, #94a3b8)" },
            }, t("soc.signals_overview.no_data"))
          : [
              sentiment.bullish != null && sentiment.bullish > 0
                ? createElement("div", {
                    key: "bull",
                    className: styles.sentimentSegment,
                    style: { width: `${bullPct.toFixed(1)}%`, background: "rgba(52, 211, 153, 0.35)", color: toneColor("success") },
                  }, `${bullPct.toFixed(1)}%`)
                : null,
              sentiment.neutral != null && sentiment.neutral > 0
                ? createElement("div", {
                    key: "neut",
                    className: styles.sentimentSegment,
                    style: { width: `${neutPct.toFixed(1)}%`, background: "rgba(148, 163, 184, 0.25)", color: "var(--color-text-muted, #94a3b8)" },
                  }, `${neutPct.toFixed(1)}%`)
                : null,
              sentiment.bearish != null && sentiment.bearish > 0
                ? createElement("div", {
                    key: "bear",
                    className: styles.sentimentSegment,
                    style: { width: `${bearPct.toFixed(1)}%`, background: "rgba(239, 68, 68, 0.35)", color: toneColor("danger") },
                  }, `${bearPct.toFixed(1)}%`)
                : null,
            ].filter(Boolean)
      ),
      createElement("div", { },
        createElement("span", { },
          `\u25B2 ${t("soc.signals_overview.bullish")}: ${sentiment.bullish ?? 0}`,
        ),
        createElement("span", { },
          `\u25C6 ${t("soc.signals_overview.neutral")}: ${sentiment.neutral ?? 0}`,
        ),
        createElement("span", { },
          `\u25BC ${t("soc.signals_overview.bearish")}: ${sentiment.bearish ?? 0}`,
        ),
      )
    );
  };

  // ─── W1.3 helpers: đọc-only config/detection/retention ──────────────────
  const formatConfigValue = (v: unknown): string => {
    if (v == null) return "—";
    if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const renderKVCard = (title: string, obj: Record<string, unknown> | null | undefined, keyPrefix: string) =>
    createElement("div", { className: styles.matCard, key: keyPrefix },
      createElement("div", { className: styles.matCardLabel }, title),
      ...Object.entries(obj ?? {}).map(([k, v]) =>
        createElement("div", { key: k }, `${k}: ${formatConfigValue(v)}`),
      ),
    );

  const renderConfigTab = () => {
    if (configTab.loading) {
      return createElement("p", { className: styles.emptyState }, t("soc.pages.status_loading"));
    }
    if (configTab.error && !configTab.data) {
      return createElement("div", { className: styles.inlineError }, configTab.error);
    }
    const cfg = configTab.data?.config ?? {};
    const own = configTab.data?.ownership ?? {};
    return createElement("div", null,
      configTab.error ? createElement("div", { className: styles.inlineError }, configTab.error) : null,
      createElement("div", { className: styles.matGrid },
        renderKVCard(t("soc.signals_overview.config_tab"), cfg, "cfg"),
        renderKVCard("ownership", {
          mode: own.mode,
          can_apply: own.can_apply,
          owner_team: own.owner_team,
          writer: own.writer,
          write_surface: own.write_surface,
          write_block_reason: own.write_block_reason,
        }, "own"),
      ),
      createElement("div", { }, t("soc.signals_overview.bridge_write_note", { defaultValue: "SOC chỉ đọc — ghi cấu hình qua service chủ sở hữu (bridge-write)." })),
    );
  };

  const handleTestWhale = async () => {
    const sym = testSymbol.trim().toUpperCase() || "VNM";
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await getAdapter().testSocWhaleDetection(sym);
      if (mountedRef.current) setTestResult(res);
    } catch (err) {
      if (!mountedRef.current) return;
      setTestResult({ symbol: sym, test_result: errMsg(err, "failed") });
    } finally {
      if (mountedRef.current) setTestLoading(false);
    }
  };

  const renderDetectionTab = () => {
    if (detectionTab.loading) {
      return createElement("p", { className: styles.emptyState }, t("soc.pages.status_loading"));
    }
    if (detectionTab.error && !detectionTab.data) {
      return createElement("div", { className: styles.inlineError }, detectionTab.error);
    }
    return createElement("div", null,
      detectionTab.error ? createElement("div", { className: styles.inlineError }, detectionTab.error) : null,
      createElement("div", { className: styles.matGrid },
        renderKVCard(signalTypeLabel("whale"), detectionTab.data?.whale, "det-whale"),
        renderKVCard(signalTypeLabel("dark_pool"), detectionTab.data?.dark, "det-dark"),
        renderKVCard(signalTypeLabel("screener"), detectionTab.data?.screener, "det-screener"),
      ),
      createElement("div", { className: styles.jobInputRow },
        createElement("input", {
          className: styles.searchInput,
          type: "text",
          placeholder: t("soc.signals_overview.symbol_placeholder"),
          value: testSymbol,
          onChange: (e: { target: { value: string } }) => setTestSymbol(e.target.value.toUpperCase()),
        }),
        createElement("button", {
          className: styles.runBtn,
          disabled: testLoading,
          onClick: () => { void handleTestWhale(); },
        }, testLoading
          ? t("soc.signals_overview.job_running")
          : t("soc.signals_overview.test_button", { defaultValue: "Chạy thử" })),
      ),
      testResult
        ? createElement("div", { },
            `test_result: ${formatConfigValue(testResult.test_result)}, detection_possible: ${formatConfigValue(testResult.detection_possible)}, symbol: ${formatConfigValue(testResult.symbol)}`,
          )
        : null,
      createElement("div", { },
        t("soc.signals_overview.smoke_label", { defaultValue: "Kết quả smoke — endpoint kiểm tra hiện trả stub, xem W2.4 honest metrics." }),
      ),
    );
  };

  const handlePreviewRetention = async () => {
    setRetentionPreview((s) => ({ ...s, loading: true }));
    try {
      const res = await getAdapter().previewSocSignalRetention({});
      if (!mountedRef.current) return;
      setRetentionPreview({ loading: false, loaded: true, error: "", data: res });
    } catch (err) {
      if (!mountedRef.current) return;
      setRetentionPreview({ loading: false, loaded: false, error: errMsg(err, "Preview failed."), data: null });
    }
  };

  const renderRetentionTab = () => {
    if (retentionTab.loading) {
      return createElement("p", { className: styles.emptyState }, t("soc.pages.status_loading"));
    }
    if (retentionTab.error && !retentionTab.data) {
      return createElement("div", { className: styles.inlineError }, retentionTab.error);
    }
    const preview = retentionPreview.data;
    return createElement("div", null,
      retentionTab.error ? createElement("div", { className: styles.inlineError }, retentionTab.error) : null,
      createElement("div", { className: styles.matGrid },
        renderKVCard(t("soc.signals_overview.retention_tab"), retentionTab.data ?? {}, "ret"),
      ),
      createElement("div", { className: styles.jobInputRow },
        createElement("button", {
          className: styles.runBtn,
          disabled: retentionPreview.loading,
          onClick: () => { void handlePreviewRetention(); },
        }, retentionPreview.loading
          ? t("soc.signals_overview.job_running")
          : t("soc.signals_overview.retention_preview", { defaultValue: "Xem ảnh hưởng" })),
      ),
      retentionPreview.error ? createElement("div", { className: styles.inlineError }, retentionPreview.error) : null,
      preview
        ? createElement("div", { className: styles.matGrid },
            renderKVCard("retention_days", preview.retention_days, "pv-days"),
            renderKVCard("impact", preview.impact, "pv-impact"),
          )
        : null,
      createElement("div", { }, t("soc.signals_overview.bridge_write_note", { defaultValue: "SOC chỉ đọc — ghi cấu hình qua service chủ sở hữu (bridge-write)." })),
    );
  };

  // ─── Job console tab ───────────────────────────────────────────────────
  const renderJobConsoleTab = () =>
    createElement("div", null,
      createElement("div", { className: styles.jobInputRow },
        createElement("select", {
          className: styles.jobDomainSelect,
          value: jobDomain,
          onChange: (e: { target: { value: string } }) => setJobDomain(e.target.value),
        },
          createElement("option", { value: "whale" }, signalTypeLabel("whale")),
          createElement("option", { value: "dark_pool" }, signalTypeLabel("dark_pool")),
        ),
        createElement("input", {
          className: styles.searchInput,
          type: "text",
          placeholder: t("soc.signals_overview.symbol_placeholder"),
          value: jobSymbol,
          onChange: (e: { target: { value: string } }) => setJobSymbol(e.target.value.toUpperCase()),

        }),
        createElement("button", {
          className: styles.runBtn,
          disabled: jobLoading || jobPolling || !jobSymbol.trim(),
          onClick: handleRunJob,
        },
          jobLoading || jobPolling
            ? t("soc.signals_overview.job_running")
            : t("soc.signals_overview.run_job"),
        ),
      ),
      createElement("div", { },
        t("soc.signals_overview.job_console_hint"),
      ),
      jobRunId != null
        ? createElement("div", { },
            t("soc.signals_overview.job_run_id", { defaultValue: "Run #{id}", id: String(jobRunId) }),
          )
        : null,
      jobStatus
        ? (jobStatus.includes("fail") || jobStatus.includes("error") || jobStatus.includes("l\u1ed7i")
            ? createElement("div", { className: styles.inlineError,  }, jobStatus)
            : createElement("div", { className: styles.inlineSuccess,  }, jobStatus))
        : null,
    );

  // ─── Materialization tab ───────────────────────────────────────────────
  const renderMaterializationTab = () => {
    const matErrLabel = matError
      ? `${t("soc.signals_overview.materialization_error", { defaultValue: "Không tải được trạng thái vật chất hóa." })} ${matError}`
      : "";
    if (matError && !materialization) {
      return createElement("div", null,
        createElement("div", { className: styles.inlineError }, matErrLabel),
        createElement("p", { className: styles.emptyState }, t("soc.signals_overview.no_materialization")),
      );
    }
    if (!materialization) {
      return createElement("p", { className: styles.emptyState }, t("soc.signals_overview.no_materialization"));
    }
    const services = materialization.services || [];
    if (services.length === 0) {
      return createElement("p", { className: styles.emptyState }, t("soc.signals_overview.no_materialization"));
    }
    const getStatusColor = (st: string): string => socStatusColor(st);
    const summaryChildren: ReactNode[] = [];
    if (materialization.unified_alerts_available != null) {
      summaryChildren.push(
        createElement("span", { key: "alerts" },
          `${t("soc.signals_overview.total_alerts")}: ${materialization.unified_alerts_available}`,
        ),
      );
    }
    if (materialization.session_dates_available != null) {
      summaryChildren.push(
        createElement("span", { key: "sessions" },
          `${t("soc.signals_overview.session_dates")}: ${materialization.session_dates_available}`,
        ),
      );
    }
    if (materialization.latest_detection_job_run_log_id != null) {
      const latestId = materialization.latest_detection_job_run_log_id;
      summaryChildren.push(
        createElement("span", { key: "runlog" },
          createElement("button", {
            className: styles.pageBtn,
            onClick: () => { void handleViewJobStatus(latestId); },
          }, t("soc.signals_overview.job_run_id", { defaultValue: "Run #{id}", id: String(latestId) })),
        ),
      );
    }
    const execPlan = materialization.execution_plan || [];
    return createElement("div", null,
      matError ? createElement("div", { className: styles.inlineError }, matErrLabel) : null,
      createElement("div", { className: styles.matGrid },
        ...services.map((svc: MaterializationService) => {
          const finished = svc.last_finished_at
            ? formatLastCheck(svc.last_finished_at, localeTag, t)
            : null;
          const started = svc.last_started_at
            ? formatLastCheck(svc.last_started_at, localeTag, t)
            : null;
          const progress = matProgress(svc.status);
          return createElement("div", { className: styles.matCard, key: svc.service_key },
            createElement("div", null,
              createElement("div", { className: styles.matCardLabel }, svc.service_key),
              started
                ? createElement("div", { title: started.title },
                    started.display,
                  )
                : null,
              finished
                ? createElement("div", { title: finished.title },
                    finished.display,
                  )
                : null,
              svc.run_log_id != null
                ? createElement("div", { },
                    t("soc.signals_overview.job_run_id", { defaultValue: "Run #{id}", id: String(svc.run_log_id) }),
                    " ",
                    createElement("button", {
                      className: styles.pageBtn,
                      onClick: () => { void handleViewJobStatus(svc.run_log_id as number); },
                    }, t("soc.signals_overview.job_view", { defaultValue: "Xem job" })),
                  )
                : null,
              createElement("div", { className: styles.matCardBar },
                createElement("div", {
                  className: styles.matCardBarFill,
                  style: { width: `${progress.pct}%`, background: getStatusColor(svc.status) },
                }),
              ),
            ),
            createElement("div", { className: styles.matCardStatus, style: { color: getStatusColor(svc.status) } },
              svc.status ? svc.status.toUpperCase() : "—",
            ),
          );
        }),
      ),
      execPlan.length > 0
        ? createElement("div", null,
            createElement("h4", null, t("soc.signals_overview.execution_plan", { defaultValue: "Kế hoạch thực thi" })),
            ...execPlan.map((p: MaterializationExecPlan) =>
              createElement("div", { key: p.service_key },
                `${p.service_key}: ${p.will_run
                  ? t("soc.signals_overview.will_run", { defaultValue: "sẽ chạy" })
                  : t("soc.signals_overview.will_skip", { defaultValue: "bỏ qua" })}${p.symbol ? ` (${p.symbol})` : ""}`,
              ),
            ),
          )
        : null,
      summaryChildren.length > 0
        ? createElement("div", { },
            ...summaryChildren,
          )
        : null,
    );
  };

  // ─── Sub-tab content map ──────────────────────────────────────────────
  // ─── W2.3 Rules subtab: config rows + precision metrics + request modal ─
  const fmtPct = (v: number | null | undefined): string => {
    if (v == null || Number.isNaN(Number(v))) return t("soc.signals_overview.rules_insufficient_data", { defaultValue: "chưa đủ dữ liệu" });
    return `${Math.round(Number(v) * 100)}%`;
  };

  const ruleKindLabel = (kind: string) => {
    const map: Record<string, string> = {
      enabled: t("soc.signals_overview.rule_enable", { defaultValue: "Bật" }),
      threshold: "threshold_vnd",
      cooldown: "cooldown_seconds",
      ratio: "top_pct / block_ratio_min",
    };
    return map[kind] ?? kind;
  };

  const renderRuleModal = () => {
    if (!ruleModal) return null;
    const close = () => {
      if (!ruleSaving) setRuleModal(null);
    };
    const inputs: Array<ReturnType<typeof createElement>> = [];
    if (ruleModal.kind === "enabled") {
      inputs.push(
        createElement("label", { key: "en", className: styles.schedulerModalField, htmlFor: "rule-enabled" },
          t("soc.signals_overview.rule_state_enabled", { defaultValue: "Bật" })),
        createElement("select", {
          key: "en-sel",
          id: "rule-enabled",
          className: styles.jobDomainSelect,
          value: ruleEnabled ? "1" : "0",
          onChange: (e: { target: { value: string } }) => setRuleEnabled(e.target.value === "1"),
        },
          createElement("option", { value: "1" }, t("soc.signals_overview.rule_enable", { defaultValue: "Bật" })),
          createElement("option", { value: "0" }, t("soc.signals_overview.rule_disable", { defaultValue: "Tắt" })),
        ),
      );
    } else if (ruleModal.kind === "threshold") {
      inputs.push(
        createElement("label", { key: "th", className: styles.schedulerModalField, htmlFor: "rule-threshold" }, "threshold_vnd"),
        createElement("input", {
          key: "th-in",
          id: "rule-threshold",
          className: styles.schedulerModalInput,
          type: "number",
          min: 0,
          value: ruleThreshold,
          onChange: (e: { target: { value: string } }) => setRuleThreshold(e.target.value),
        }),
      );
    } else if (ruleModal.kind === "cooldown") {
      inputs.push(
        createElement("label", { key: "cd", className: styles.schedulerModalField, htmlFor: "rule-cooldown" }, "cooldown_seconds"),
        createElement("input", {
          key: "cd-in",
          id: "rule-cooldown",
          className: styles.schedulerModalInput,
          type: "number",
          min: 0,
          value: ruleCooldown,
          onChange: (e: { target: { value: string } }) => setRuleCooldown(e.target.value),
        }),
      );
    } else if (ruleModal.kind === "ratio") {
      inputs.push(
        createElement("label", { key: "rt", className: styles.schedulerModalField, htmlFor: "rule-ratio" },
          `${ruleModal.rule_key === "whale_top_pct" ? "top_pct" : "block_ratio_min"} (0–1)`),
        createElement("input", {
          key: "rt-in",
          id: "rule-ratio",
          className: styles.schedulerModalInput,
          type: "number",
          min: 0,
          max: 1,
          step: 0.01,
          value: ruleRatio,
          onChange: (e: { target: { value: string } }) => setRuleRatio(e.target.value),
        }),
      );
    }
    inputs.push(
      createElement("label", { key: "rs", className: styles.schedulerModalField, htmlFor: "rule-reason" },
        t("soc.signals_overview.rule_change_reason", { defaultValue: "Lý do" })),
      createElement("textarea", {
        key: "rs-ta",
        id: "rule-reason",
        className: styles.schedulerModalTextarea,
        rows: 2,
        placeholder: t("soc.signals_overview.rule_reason_placeholder", { defaultValue: "VD: Ngưỡng lớn gây nhiễu..." }),
        value: ruleReason,
        onChange: (e: { target: { value: string } }) => setRuleReason(e.target.value),
      }),
    );
    return createElement("div", { className: styles.schedulerModalOverlay, onClick: close },
      createElement("div", {
        className: styles.schedulerModalCard,
        role: "dialog",
        "aria-label": t("soc.signals_overview.rule_request", { defaultValue: "Gửi yêu cầu đổi" }),
        onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
      },
        createElement("h3", { className: styles.schedulerModalTitle },
          `${t("soc.signals_overview.rule_preview", { defaultValue: "Xem trước thay đổi" })} — ${ruleModal.label || ruleModal.rule_key}`),
        createElement("p", { className: styles.schedulerModalBody },
          `${ruleModal.alert_family} · ${ruleKindLabel(ruleModal.kind)} · ${ruleModal.enabled === true ? t("soc.signals_overview.rule_enabled", { defaultValue: "Đang bật" }) : t("soc.signals_overview.rule_disabled", { defaultValue: "Đang tắt" })}${
            ruleModal.value != null ? ` · ${String(ruleModal.value)}` : ""
          }`),
        ...inputs,
        ruleResult
          ? createElement("p", { className: styles.triageNote },
              `${t("soc.signals_overview.rule_request_sent", { defaultValue: "Đã gửi yêu cầu đổi rule. Owner sẽ duyệt (bridge-write)." })}${ruleResult.request_id ? ` [${ruleResult.request_id}]` : ""}`)
          : null,
        createElement("div", { className: styles.schedulerModalActions },
          createElement("button", { type: "button", onClick: close, className: styles.schedulerModalCancel },
            t("common.cancel")),
          createElement("button", {
            type: "button",
            disabled: ruleSaving,
            onClick: () => { void handleRuleRequestSubmit(); },
            className: styles.schedulerModalProceed,
          }, t("soc.signals_overview.rule_request", { defaultValue: "Gửi yêu cầu đổi" })),
        ),
      ),
    );
  };

  const renderRulesTab = () => {
    if (rulesTab.loading) {
      return createElement("p", { className: styles.loadingText }, t("soc.pages.status_loading"));
    }
    const rules = rulesTab.data?.rules ?? [];
    const perf = rulesPerf.data;
    return createElement("div", null,
      rulesTab.error
        ? createElement("div", { className: styles.inlineError }, rulesTab.error)
        : null,
      rulesPerf.error
        ? createElement("div", { className: styles.inlineError }, rulesPerf.error)
        : null,
      createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" } },
        createElement("h4", {},
          t("soc.signals_overview.rules_tab", { defaultValue: "Rules" })),
        createElement("button", {
          className: styles.runBtn,
          onClick: () => { void fetchRulesTab(); },
        }, t("soc.signals_overview.rules_refresh", { defaultValue: "Làm mới" })),
      ),
      createElement("p", { className: styles.triageNote },
        t("soc.signals_overview.rules_note", { defaultValue: "SOC không áp dụng rule trực tiếp — gửi yêu cầu, owner duyệt (bridge-write)." })),
      ruleMsg
        ? createElement("p", { className: styles.triageNote }, ruleMsg)
        : null,
      renderRuleModal(),
      perf?.overall
        ? createElement("div", { className: styles.metricGrid },
            statCard(t("soc.signals_overview.alert_count", { defaultValue: "Số tín hiệu" }), perf.overall.alert_count ?? 0, "#f1f5f9"),
            statCard(t("soc.signals_overview.overall_precision", { defaultValue: "Precision tổng" }), fmtPct(perf.overall.precision_proxy), toneColor("success")),
            statCard(t("soc.signals_overview.hit_rate", { defaultValue: "Tỷ lệ phản hồi" }), fmtPct(perf.overall.hit_rate), toneColor("warning")),
          )
        : null,
      perf?.top_noisy && perf.top_noisy.length > 0
        ? createElement("div", { className: styles.matCard, style: { marginTop: "0.75rem" } },
            createElement("h4", {}, t("soc.signals_overview.noisy_rules", { defaultValue: "Rule hay báo nhiều nhất" })),
            ...perf.top_noisy.map((rule) =>
              createElement("div", {
                key: rule.rule_key,
                style: { display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.25rem 0" },
              },
                createElement("span", {}, rule.label || rule.rule_key),
                createElement("span", {}, `${rule.alert_count ?? 0} · p=${fmtPct(rule.precision_proxy)}`),
              )),
          )
        : null,
      createElement("div", { className: styles.matCard, style: { marginTop: "0.75rem" } },
        rules.length === 0
          ? createElement("p", { className: styles.emptyState }, t("soc.signals_overview.no_data"))
          : rules.map((rule) =>
              createElement("div", {
                key: rule.rule_key,
                className: styles.rulesRow,
              },
                createElement("div", { style: { flex: 1, minWidth: 0 } },
                  createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" } },
                    createElement("strong", {}, rule.label || rule.rule_key),
                    createElement("span", { className: styles.signalLabel, style: { fontSize: "0.72rem", opacity: 0.7 } },
                      `${rule.alert_family} · ${rule.kind}`),
                  ),
                  createElement("div", { style: { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.25rem" } },
                    createElement("span", { className: styles.triageNote },
                      `${t("soc.signals_overview.rule_state_enabled", { defaultValue: "Bật" })}: ${rule.enabled ? t("soc.signals_overview.rule_enabled", { defaultValue: "Đang bật" }) : t("soc.signals_overview.rule_disabled", { defaultValue: "Đang tắt" }) }`),
                    createElement("span", { className: styles.triageNote },
                      `${t("soc.signals_overview.rule_value", { defaultValue: "Giá trị" })}: ${rule.value != null ? String(rule.value) : "—"}`),
                    createElement("span", { className: styles.triageNote },
                      `${t("soc.signals_overview.alert_count", { defaultValue: "Số tín hiệu" })}: ${rule.alert_count ?? 0}`),
                    createElement("span", { className: styles.triageNote },
                      `${t("soc.signals_overview.precision", { defaultValue: "Độ chính xác" })}: ${fmtPct(rule.precision_proxy)}`),
                    createElement("span", { className: styles.triageNote },
                      `${t("soc.signals_overview.hit_rate", { defaultValue: "Tỷ lệ phản hồi" })}: ${fmtPct(rule.hit_rate)}`),
                  ),
                ),
                createElement("button", {
                  className: styles.runBtn,
                  onClick: () => openRuleModal(rule),
                }, t("soc.signals_overview.rule_request", { defaultValue: "Gửi yêu cầu đổi" })),
              )),
      ),
    );
  };
  const subTabContent: Record<SubTab, () => ReturnType<typeof createElement>> = {
    overview: renderOverviewTab,
    "job-console": renderJobConsoleTab,
    materialization: renderMaterializationTab,
    config: renderConfigTab,
    detection: renderDetectionTab,
    retention: renderRetentionTab,
    rules: renderRulesTab,
  };

  const subTabKeys: { key: SubTab; label: string }[] = [
    { key: "overview", label: t("soc.signals_overview.overview") },
    { key: "job-console", label: t("soc.signals_overview.job_console") },
    { key: "materialization", label: t("soc.signals_overview.materialization") },
    { key: "config", label: t("soc.signals_overview.config_tab", { defaultValue: "Cấu hình" }) },
    { key: "detection", label: t("soc.signals_overview.detection_tab", { defaultValue: "Phát hiện" }) },
    { key: "retention", label: t("soc.signals_overview.retention_tab", { defaultValue: "Lưu trữ" }) },
    { key: "rules", label: t("soc.signals_overview.rules_tab", { defaultValue: "Rules" }) },
  ];

  // ─── Feed pagination (W1.1: reuse pattern overview W10) ─────────────────
  const renderFeedPagination = () => {
    if (filteredSignals.length === 0) return null;
    const win = 5;
    let start = Math.max(1, safePage - Math.floor(win / 2));
    const end = Math.min(totalPages, start + win - 1);
    start = Math.max(1, end - win + 1);
    const numbers: number[] = [];
    for (let p = start; p <= end; p += 1) numbers.push(p);
    return createElement("div", null,
      createElement("div", { className: styles.pagination, role: "navigation" },
        createElement("button", {
          className: styles.pageBtn,
          disabled: safePage <= 1,
          "aria-label": "Previous page",
          onClick: () => setPage(safePage - 1),
        }, "‹"),
        ...numbers.map((p) =>
          createElement("button", {
            key: p,
            className: `${styles.pageBtn} ${p === safePage ? styles.filterBtnActive : ""}`,
            "aria-label": `Page ${p}`,
            "aria-current": p === safePage ? "page" : undefined,
            onClick: () => setPage(p),
          }, String(p)),
        ),
        createElement("button", {
          className: styles.pageBtn,
          disabled: safePage >= totalPages,
          "aria-label": "Next page",
          onClick: () => setPage(safePage + 1),
        }, "›"),
        createElement("label", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } },
          t("soc.overview.page_size_label"),
        ),
        createElement("select", {
          className: styles.jobDomainSelect,
          value: String(pageSize),
          "aria-label": t("soc.overview.page_size_label"),
          onChange: (e: { target: { value: string } }) => { setPageSize(Number(e.target.value) || 20); setPage(1); },
        },
          ...[20, 50, 100].map((n) => createElement("option", { key: n, value: String(n) }, String(n))),
        ),
      ),
      createElement("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center" } },
        t("soc.overview.showing_range", { from: String(pageFrom), to: String(pageTo), total: String(filteredSignals.length) }),
      ),
    );
  };

  // ─── W2.2 Mute modal (reuse pattern schedulerModal — lý do + thời hạn) ─────
  const renderMuteModal = () => {
    if (!muteTarget) return null;
    const close = () => {
      if (!muteSaving) {
        setMuteTarget(null);
        setMuteReason("");
      }
    };
    return createElement("div", { className: styles.schedulerModalOverlay, onClick: close },
      createElement("div", {
        className: styles.schedulerModalCard,
        role: "dialog",
        "aria-label": t("soc.signals_overview.triage_mute_title", { defaultValue: "Tắt tiếng tín hiệu" }),
        onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
      },
        createElement("h3", { className: styles.schedulerModalTitle },
          t("soc.signals_overview.triage_mute_title", { defaultValue: "Tắt tiếng tín hiệu" })),
        createElement("p", { className: styles.schedulerModalBody },
          `${muteTarget.symbol || ""}${muteTarget.alert_type ? ` — ${muteTarget.alert_type}` : ""}`),
        createElement("label", { className: styles.schedulerModalField },
          t("soc.signals_overview.triage_mute_minutes", { defaultValue: "Thời hạn (phút)" })),
        createElement("select", {
          className: styles.jobDomainSelect,
          value: muteMinutes,
          onChange: (e: { target: { value: string } }) => setMuteMinutes(e.target.value),
        },
          ...["15", "30", "60", "120", "240", "1440"].map((m) =>
            createElement("option", { key: m, value: m }, m === "1440" ? "24h" : `${m}m`)),
        ),
        createElement("label", { className: styles.schedulerModalField },
          t("soc.signals_overview.triage_mute_reason", { defaultValue: "Lý do" })),
        createElement("textarea", {
          className: styles.schedulerModalTextarea,
          rows: 2,
          placeholder: t("soc.signals_overview.triage_mute_reason_placeholder", { defaultValue: "VD: Nhiễu trong phiên ATC..." }),
          value: muteReason,
          onChange: (e: { target: { value: string } }) => setMuteReason(e.target.value),
        }),
        createElement("div", { className: styles.schedulerModalActions },
          createElement("button", { type: "button", onClick: close, className: styles.schedulerModalCancel },
            t("common.cancel")),
          createElement("button", {
            type: "button",
            disabled: muteSaving,
            onClick: () => { void handleMuteSubmit(); },
            className: styles.schedulerModalProceed,
          }, t("soc.signals_overview.triage_mute_submit", { defaultValue: "Xác nhận tắt tiếng" })),
        ),
      ),
    );
  };


  // ─── Main render ──────────────────────────────────────────────────────
  const showInitialLoading = loading && signals.length === 0 && !feedError && !materialization && !matError;
  return createElement(
    "div",
    { className: styles.glassPanel },
    showInitialLoading
      ? createElement("p", { className: styles.emptyState }, t("soc.pages.status_loading"))
      : createElement("div", null,
            // ── Stats row ─────────────────────────────────────────────────
            createElement("div", { className: styles.metricGrid },
              statCard(t("soc.signals_overview.total_alerts"), stats.total, "#f1f5f9"),
              statCard(t("soc.signals_overview.whale_count"), stats.whaleCount, "var(--accent-cyan, #06b6d4)"),
              statCard(t("soc.signals_overview.dark_pool_count"), stats.darkPoolCount, "#a78bfa"),
              statCard(t("soc.signals_overview.screener_count"), stats.screenerCount, toneColor("warning")),
              statCard(t("soc.signals_overview.detection_rate"), stats.detectionRate != null ? `${stats.detectionRate}%` : "\u2014", toneColor("success")),
              statCard(t("soc.signals_overview.avg_latency"), stats.avgLatency != null ? `${stats.avgLatency}ms` : "\u2014", "var(--accent-cyan, #06b6d4)"),
            ),
            createElement("div", { className: styles.signalsTwoCol },
              // ── Left: Live signal feed ──────────────────────────────────
              createElement("div", { className: styles.feedCard },
                createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" } },
                  createElement("h3", { },
                    t("soc.signals_overview.live_feed"),
                  ),
                  createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
                    unread > 0
                      ? createElement("button", {
                          className: `${styles.filterBtn} ${styles.filterBtnActive}`,
                          onClick: markAllRead,
                        }, `${unread} ${t("soc.signals_overview.new_items_suffix", { defaultValue: "mới" })}`)
                      : null,
                    createElement("button", {
                      className: styles.pageBtn,
                      disabled: exporting,
                      onClick: () => { void handleExportFeed(); },
                    }, t("soc.signals_overview.export_csv", { defaultValue: "Xuất CSV" })),
                  ),
                ),
                exportError ? createElement("div", { className: styles.inlineError }, exportError) : null,
                createElement("div", { className: styles.signalFeedFilterBar },
                  ...filterTypes.map((ft) =>
                    createElement("button", {
                      key: ft,
                      className: `${styles.filterBtn} ${typeFilter === ft ? styles.filterBtnActive : styles.filterBtnInactive}`,
                      onClick: () => { setTypeFilter(ft); setExpandedId(null); setPage(1); setSelectedIds([]); prevUidsRef.current = new Set(signals.map(signalUid)); setNewUids([]); setUnread(0); },
                    }, ft === "all" ? t("soc.signals_overview.filter_all") : signalTypeLabel(ft)),
                  ),
                  createElement("label", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } },
                    t("soc.signals_overview.severity_label", { defaultValue: "Mức độ" }),
                  ),
                  createElement("select", {
                    className: styles.jobDomainSelect,
                    value: severityFilter,
                    "aria-label": t("soc.signals_overview.severity_label", { defaultValue: "Mức độ" }),
                    onChange: (e: { target: { value: string } }) => { setSeverityFilter(e.target.value); setPage(1); },
                  },
                    createElement("option", { value: "all" }, t("soc.signals_overview.severity_all", { defaultValue: "Mọi mức" })),
                    ...["critical", "high", "medium", "low"].map((sev) =>
                      createElement("option", { key: sev, value: sev }, sev.toUpperCase()),
                    ),
                  ),
                  createElement("label", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } },
                    t("soc.signals_overview.direction_label", { defaultValue: "Hướng" }),
                  ),
                  createElement("select", {
                    className: styles.jobDomainSelect,
                    value: directionFilter,
                    "aria-label": t("soc.signals_overview.direction_label", { defaultValue: "Hướng" }),
                    onChange: (e: { target: { value: string } }) => { setDirectionFilter(e.target.value); setPage(1); },
                  },
                    createElement("option", { value: "all" }, t("soc.signals_overview.direction_all", { defaultValue: "Mọi hướng" })),
                    createElement("option", { value: "buy" }, t("soc.signals_overview.direction_buy", { defaultValue: "Mua" })),
                    createElement("option", { value: "sell" }, t("soc.signals_overview.direction_sell", { defaultValue: "Bán" })),
                    createElement("option", { value: "neutral" }, t("soc.signals_overview.direction_neutral", { defaultValue: "Trung lập" })),
                  ),
                  createElement("div", { className: styles.searchWrapper,  },
                    createElement("span", { className: styles.searchIcon },
                      createElement(LucideIcon, { name: "Search", className: "h-3.5 w-3.5" }),
                    ),
                    createElement("input", {
                      className: styles.searchInputWithIcon,
                      type: "text",
                      placeholder: t("soc.signals_overview.search_symbol"),
                      value: symbolFilter,
                      onChange: (e: { target: { value: string } }) => {
                        setSymbolFilter(e.target.value);
                        setExpandedId(null);
                      },
                    }),
                  ),
                  // W2.2: filter "Chưa ack" + bulk Ack đã chọn
                  createElement("button", {
                    className: `${styles.filterBtn} ${unackedOnly ? styles.filterBtnActive : styles.filterBtnInactive}`,
                    "aria-pressed": unackedOnly,
                    onClick: () => { setUnackedOnly((v) => !v); setPage(1); },
                  }, t("soc.signals_overview.triage_unacked_only", { defaultValue: "Chưa ack" })),
                  selectedIds.length > 0
                    ? createElement("button", {
                        className: styles.runBtn,
                        disabled: acking,
                        onClick: () => { void handleAckSelected(); },
                      }, t("soc.signals_overview.triage_ack_selected", { n: selectedIds.length, defaultValue: `Đã nhận (${selectedIds.length})` }))
                    : null,
                ),
                triageError ? createElement("div", { className: styles.inlineError }, triageError) : null,
                triageMsg
                  ? (triageMsg.includes("thất bại") || triageMsg.includes("failed")
                      ? createElement("div", { className: styles.inlineError }, triageMsg)
                      : createElement("div", { className: styles.inlineSuccess }, triageMsg))
                  : null,
                filteredSignals.length === 0 && !feedError
                  ? renderRadarEmptyState()
                  : createElement("div", null,
                      feedError
                        ? createElement("div", { className: styles.inlineError }, `${t("soc.signals_overview.feed_error", { defaultValue: "Không tải được luồng tín hiệu." })} ${feedError}`)
                        : null,
                      filteredSignals.length === 0
                        ? renderRadarEmptyState()
                        : createElement("div", null,
                            createElement("div", { className: styles.signalFeed },
                              ...pagedSignals.map((s, idx) => renderSignalRow(s, (safePage - 1) * pageSize + idx)),
                            ),
                            renderFeedPagination(),
                          ),
                    ),
              ),
              // ── Right: Sub-tabs ────────────────────────────────────────
              createElement("div", { className: styles.controlCard },
                createElement("div", { className: styles.subTabBar, role: "tablist" },
                  ...subTabKeys.map((st) =>
                    createElement("button", {
                      key: st.key,
                      role: "tab",
                      "aria-selected": subTab === st.key,
                      className: `${styles.subTabBtn} ${subTab === st.key ? styles.subTabBtnActive : ""}`,
                      onClick: () => setSubTab(st.key),
                    }, st.label),
                  ),
                ),
                createElement("div", { },
                  subTabContent[subTab](),
                ),
              ),
            ),
          ),
    renderMuteModal(),
  );
}
