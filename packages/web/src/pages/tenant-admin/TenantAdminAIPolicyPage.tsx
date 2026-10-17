import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, ShellField } from "../../components/ShellPageTemplate.js";
import { useI18n } from "../../context/LangContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useTenantAdminQuery, useTenantAdminMutation } from "./useTenantAdminQuery.js";

/**
 * R4.1 — trang Tenant Admin đặt policy AI cho tenant của mình (AC1).
 *
 * Trang này **ghi quyền**, không ghi hạn mức tiêu thụ: `max_tokens_per_day` ở đây là
 * trần cho *cấu hình của user*, còn hạn mức tiêu thụ trong ngày nằm ở `AIBudget`
 * (R2.8) và được chặn ở backend. Nếu sau này thêm ô "ngân sách/ngày" vào đây thì sẽ
 * thành hai nơi đặt một con số — đúng cái lỗi mà R4.1 đã tránh ở tầng BE.
 *
 * Ba chi tiết lệch với plan, ghi lại để người sau không "sửa về đúng plan":
 * - Plan ghi file ở `pages/admin/TenantAdminAIPolicyPage.tsx`; thật là các trang
 *   tenant-admin nằm ở `pages/tenant-admin/`.
 * - `system_policy.managed_by_platform` **không** phải cờ "bị cấp BYOK" — nó thuộc
 *   R0.9 và nghĩa là "template hệ thống do nền tảng quản lý". Cờ BYOK là
 *   `system_policy.byok_forced` (BE trả kèm).
 */
interface PolicyPayload {
  allow_byok: boolean;
  allowed_providers: string[];
  allowed_models: string[];
  max_tokens_per_day: number;
  max_cost_per_day: string | null;
  version: number;
  is_default: boolean;
  tenant_code: string;
  read_only?: boolean;
}

const POLICY_URL = "/core/v1/workspace/ai-command-center/tenant-policy/";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function joinList(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

export function TenantAdminAIPolicyPage() {
  const { t } = useI18n();
  const toast = useToast();

  const policyQuery = useTenantAdminQuery<PolicyPayload>(["ai-policy"], POLICY_URL);
  const policy = policyQuery.data;

  const [allowByok, setAllowByok] = useState(true);
  const [maxTokens, setMaxTokens] = useState("0");
  const [maxCost, setMaxCost] = useState("");
  const [providers, setProviders] = useState("");
  const [models, setModels] = useState("");

  // Nạp giá trị server vào form **một lần khi có data**, không phải mỗi render:
  // `useEffect` không phụ thuộc `policy` sẽ khoá form ở giá trị đầu tiên (null).
  useEffect(() => {
    if (!policy) return;
    setAllowByok(Boolean(policy.allow_byok));
    setMaxTokens(String(policy.max_tokens_per_day ?? 0));
    setMaxCost(policy.max_cost_per_day ?? "");
    setProviders(joinList(policy.allowed_providers));
    setModels(joinList(policy.allowed_models));
  }, [policy]);

  const saveMutation = useTenantAdminMutation<PolicyPayload>(
    "put",
    POLICY_URL,
    [["ai-policy"]],
    {
      onSuccess: () => toast.success(t("tenantAIPolicy.saved")),
      onError: (err) => toast.error(err?.message || t("tenantAIPolicy.saveError")),
    },
  );

  const readOnly = Boolean(policy?.read_only);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const tokens = Number(maxTokens);
    saveMutation.mutate({
      allow_byok: allowByok,
      max_tokens_per_day: Number.isFinite(tokens) && tokens >= 0 ? Math.trunc(tokens) : 0,
      max_cost_per_day: maxCost.trim() === "" ? null : maxCost.trim(),
      allowed_providers: parseList(providers),
      allowed_models: parseList(models),
    });
  };

  if (policyQuery.isLoading) {
    return <ShellPageChrome title={t("tenantAIPolicy.title")}><ShellPanel><p>{t("common.loading")}</p></ShellPanel></ShellPageChrome>;
  }

  return (
    <ShellPageChrome title={t("tenantAIPolicy.title")}>
      <ShellPanel>
        <form onSubmit={handleSubmit}>
          <p>{t("tenantAIPolicy.intro")}</p>

          {policy?.is_default ? (
            <p data-testid="tenant-ai-policy-default">{t("tenantAIPolicy.defaultNotice")}</p>
          ) : null}

          <label className="taToggle">
            <input
              type="checkbox"
              checked={allowByok}
              disabled={readOnly}
              onChange={(e) => setAllowByok(e.target.checked)}
            />
            <span>{t("tenantAIPolicy.allowByok")}</span>
          </label>

          <ShellField
            label={t("tenantAIPolicy.maxTokensPerDay")}
            name="maxTokensPerDay"
            value={maxTokens}
            disabled={readOnly}
            onChange={(e) => setMaxTokens(e.target.value)}
          />
          <ShellField
            label={t("tenantAIPolicy.maxCostPerDay")}
            name="maxCostPerDay"
            value={maxCost}
            disabled={readOnly}
            onChange={(e) => setMaxCost(e.target.value)}
          />
          <ShellField
            label={t("tenantAIPolicy.allowedProviders")}
            name="allowedProviders"
            value={providers}
            disabled={readOnly}
            onChange={(e) => setProviders(e.target.value)}
          />
          <ShellField
            label={t("tenantAIPolicy.allowedModels")}
            name="allowedModels"
            value={models}
            disabled={readOnly}
            onChange={(e) => setModels(e.target.value)}
          />

          <button type="submit" disabled={readOnly || saveMutation.isPending}>
            {t("common.save")}
          </button>
          {policy ? (
            <span data-testid="tenant-ai-policy-version">
              {t("tenantAIPolicy.version", { version: policy.version })}
            </span>
          ) : null}
        </form>
      </ShellPanel>
    </ShellPageChrome>
  );
}