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
      <ShellPanel>
        <button type="button" onClick={() => setShowCreate((v) => !v)}>
          {t("tenantKeys.createAction")}
        </button>

        {showCreate && (
          <div>
            <ShellField label={t("tenantKeys.fieldName")} name="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <ShellField label={t("tenantKeys.fieldScopes")} name="scope_codes" value={scopeCodes} onChange={(e) => setScopeCodes(e.target.value)} />
            <ShellField label={t("tenantKeys.fieldExpires")} name="expires_at" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <ShellField label={t("tenantKeys.fieldCidr")} name="cidr" value={cidrBlocks} onChange={(e) => setCidrBlocks(e.target.value)} />
            <button type="button" onClick={doCreate} disabled={createMutation.isPending}>
              {t("tenantKeys.createAction")}
            </button>
          </div>
        )}

        {freshSecret && (
          <div role="alert">
            <p>{t("tenantKeys.secretOnceWarning")}</p>
            <code>{freshSecret}</code>
            <button type="button" onClick={copySecret}>
              {copied ? t("tenantKeys.copiedAction") : t("tenantKeys.copyAction")}
            </button>
          </div>
        )}

        {keys.length === 0 ? (
          <ShellEmptyState description={t("tenantKeys.emptyState")} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("tenantKeys.colName")}</th>
                <th>{t("tenantKeys.colPrefix")}</th>
                <th>{t("tenantKeys.colScopes")}</th>
                <th>{t("tenantKeys.colExpires")}</th>
                <th>{t("tenantKeys.colLastUsed")}</th>
                <th>{t("tenantKeys.colCalls")}</th>
                <th>{t("tenantKeys.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const id = k.pat_id || k.id || "";
                return (
                  <tr key={id}>
                    <td>{k.label}</td>
                    <td>{k.token_prefix}</td>
                    <td>{(k.scope_codes || k.scopes || []).join(", ")}</td>
                    <td>{k.expires_at || "—"}</td>
                    <td>{k.last_used_at || "—"}</td>
                    <td>{callsById[id] ?? "—"}</td>
                    <td>
                      <button type="button" onClick={() => doRotate(id)}>
                        {t("tenantKeys.rotateAction")}
                      </button>
                      <button type="button" onClick={() => doRevoke(id)}>
                        {t("tenantKeys.revokeAction")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ShellPanel>
    </ShellPageChrome>
  );
}
