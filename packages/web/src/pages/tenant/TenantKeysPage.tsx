import { useState } from "react";
import {
  ShellPageChrome, ShellPanel, ShellField,
} from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useConfirm } from "../../components/ConfirmModal.js";
import { useTenantSelfQuery, useTenantSelfMutation } from "./useTenantSelfQuery.js";

interface PersonalKey {
  id?: string;
  pat_id?: string;
  label?: string;
  token_prefix?: string;
  status?: string;
  scope_codes?: string[];
  scopes?: string[];
  expires_at?: string | null;
  last_used_at?: string | null;
  created_at?: string;
}

interface KeysResponse {
  results?: PersonalKey[];
}

interface UsageSummary {
  total_keys?: number;
  total_calls_30d?: number;
  keys?: Array<{ pat_id?: string; label?: string; calls_30d?: number; last_used_at?: string | null }>;
}

export function TenantKeysPage() {
  const { t } = useI18n();
  const { ability } = usePortfolio() as { ability?: { can?: (a: string, s: string) => boolean } };
  const toast = useToast();
  const confirm = useConfirm();

  const canRead = ability?.can?.("read", "TenantPATAdmin") ?? false;

  const [showCreate, setShowCreate] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [scopeCodes, setScopeCodes] = useState("market:read,signals:read");
  const [expiresAt, setExpiresAt] = useState("");
  const [cidrBlocks, setCidrBlocks] = useState("");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const keysQuery = useTenantSelfQuery<KeysResponse>(
    ["tenant-self", "keys"], "/partner/me/keys/", { enabled: canRead },
  );
  const usageQuery = useTenantSelfQuery<UsageSummary>(
    ["tenant-self", "keys-usage"], "/partner/me/keys/usage-summary/?days=30",
    { enabled: canRead },
  );

  const createMutation = useTenantSelfMutation<{ secret?: string }>(
    "post", "/partner/me/keys/",
    [["tenant-self", "keys"], ["tenant-self", "keys-usage"]],
    {
      onSuccess: (data) => {
        setFreshSecret(data.secret || null);
        setDisplayName("");
        toast.success(t("tenantKeys.createAction"));
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const adapter = defaultCoreApiAdapter as unknown as {
    corePost: (u: string, b?: unknown) => Promise<{ new_token?: { secret?: string } }>;
  };

  if (!canRead) {
    return (
      <ShellPageChrome eyebrow={t("tenantKeys.eyebrow")} title={t("tenantKeys.title")} notice={t("common.noPermission")}>
        <ShellEmptyState description={t("common.noPermission")} />
      </ShellPageChrome>
    );
  }

  if (keysQuery.isLoading) {
    return (
      <ShellPageChrome eyebrow={t("tenantKeys.eyebrow")} title={t("tenantKeys.title")}>
        <ShellSkeleton variant="card" count={3} />
      </ShellPageChrome>
    );
  }

  const keys = keysQuery.data?.results || [];
  const callsById: Record<string, number> = {};
  for (const u of usageQuery.data?.keys || []) {
    if (u.pat_id) callsById[u.pat_id] = u.calls_30d || 0;
  }

  const doCreate = () => {
    setFreshSecret(null);
    setCopied(false);
    createMutation.mutate({
      display_name: displayName.trim() || undefined,
      scope_codes: scopeCodes.split(",").map((s) => s.trim()).filter(Boolean),
      expires_at: expiresAt || undefined,
      allowed_cidr_blocks: cidrBlocks.split("\n").map((s) => s.trim()).filter(Boolean),
    });
  };

  const doRotate = async (id: string) => {
    const ok = await confirm({ title: t("tenantKeys.rotateAction"), message: t("tenantKeys.rotateConfirm") });
    if (!ok) return;
    try {
      const res = await adapter.corePost(`/partner/me/keys/${encodeURIComponent(id)}/rotate/`, {});
      setFreshSecret(res?.new_token?.secret || null);
      setCopied(false);
      keysQuery.refetch();
      usageQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const doRevoke = async (id: string) => {
    const ok = await confirm({
      title: t("tenantKeys.revokeAction"), message: t("tenantKeys.revokeConfirm"), variant: "destructive",
    });
    if (!ok) return;
    try {
      await adapter.corePost(`/partner/me/keys/${encodeURIComponent(id)}/revoke/`, { reason: "revoked from /tenant/keys" });
      keysQuery.refetch();
      usageQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const copySecret = async () => {
    if (!freshSecret) return;
    try {
      await navigator.clipboard.writeText(freshSecret);
      setCopied(true);
    } catch {
      toast.error("copy failed");
    }
  };

  return (
    <ShellPageChrome
      eyebrow={t("tenantKeys.eyebrow")}
      title={t("tenantKeys.title")}
      description={t("tenantKeys.description")}
    >
      <ShellPanel
        title={t("tenantKeys.createAction")}
        subtitle="Scopes mặc định market:read,signals:read — có thể thu hẹp khi tạo."
        actions={
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            {showCreate ? t("common.cancel") : t("tenantKeys.createAction")}
          </button>
        }
      >
        {showCreate && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <ShellField label={t("tenantKeys.fieldName")} name="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="my-service" />
            <ShellField label={t("tenantKeys.fieldScopes")} name="scope_codes" value={scopeCodes} onChange={(e) => setScopeCodes(e.target.value)} />
            <ShellField label={t("tenantKeys.fieldExpires")} name="expires_at" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <ShellField label={t("tenantKeys.fieldCidr")} name="cidr" value={cidrBlocks} onChange={(e) => setCidrBlocks(e.target.value)} />
            <button
              type="button"
              onClick={doCreate}
              disabled={createMutation.isPending}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {t("tenantKeys.createAction")}
            </button>
          </div>
        )}

        {freshSecret && (
          <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t("tenantKeys.secretOnceWarning")}</p>
            <code className="mt-2 block break-all rounded-lg bg-slate-900 p-3 font-mono text-xs text-emerald-300">{freshSecret}</code>
            <button
              type="button"
              onClick={copySecret}
              className="mt-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {copied ? t("tenantKeys.copiedAction") : t("tenantKeys.copyAction")}
            </button>
          </div>
        )}

        {keys.length === 0 ? (
          <ShellEmptyState
            description={t("tenantKeys.emptyState")}
            ctaLabel={t("tenantKeys.createAction")}
            ctaOnClick={() => setShowCreate(true)}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2">{t("tenantKeys.colName")}</th>
                  <th className="px-4 py-2">{t("tenantKeys.colPrefix")}</th>
                  <th className="px-4 py-2">{t("tenantKeys.colScopes")}</th>
                  <th className="px-4 py-2">{t("tenantKeys.colExpires")}</th>
                  <th className="px-4 py-2">{t("tenantKeys.colLastUsed")}</th>
                  <th className="px-4 py-2 text-right">{t("tenantKeys.colCalls")}</th>
                  <th className="px-4 py-2 text-right">{t("tenantKeys.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {keys.map((k) => {
                  const id = k.pat_id || k.id || "";
                  const scopes = (k.scope_codes || k.scopes || []);
                  return (
                    <tr key={id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2 font-medium">{k.label}</td>
                      <td className="px-4 py-2 font-mono text-xs">{k.token_prefix}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex flex-wrap gap-1">
                          {scopes.map((s) => (
                            <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{s}</span>
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">{k.expires_at || "—"}</td>
                      <td className="px-4 py-2 text-xs">{k.last_used_at || "—"}</td>
                      <td className="px-4 py-2 text-right font-semibold">{callsById[id] ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => doRotate(id)} className="mr-2 text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400">
                          {t("tenantKeys.rotateAction")}
                        </button>
                        <button type="button" onClick={() => doRevoke(id)} className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400">
                          {t("tenantKeys.revokeAction")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ShellPanel>
    </ShellPageChrome>
  );
}
