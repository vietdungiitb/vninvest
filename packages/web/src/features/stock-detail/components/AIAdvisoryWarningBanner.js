import { createElement } from "react";
import { useI18n } from "../../../context/LangContext.js";

const e = createElement;

export function AIAdvisoryWarningBanner({
  personalKeyFailed,
  personalKeyError,
  usingSystemFallback,
  fallbackRemaining,
  fallbackQuotaMax,
  fallbackQuotaReset,
  budgetSoftWarning,
  budget,
  onConfigure,
}) {
  const { t, localeTag } = useI18n();

  const showBudgetWarning = Boolean(budgetSoftWarning) && budget && budget.token_budget > 0;

  if (!personalKeyFailed && !usingSystemFallback && !showBudgetWarning) return null;

  const exhausted =
    typeof fallbackRemaining === "number" &&
    typeof fallbackQuotaMax === "number" &&
    fallbackQuotaMax > 0 &&
    fallbackRemaining <= 0;

  const isAmber = exhausted || showBudgetWarning;

  return e("div", {
    className: `rounded-lg border p-3 text-xs ${
      isAmber
        ? "border-rose-700/60 bg-rose-950/30 text-rose-300"
        : "border-amber-700/60 bg-amber-950/30 text-amber-200"
    }`,
    style: { marginBottom: "12px" },
  }, [
    e("div", {
      key: "heading",
      className: "mb-1 flex items-center gap-1.5 font-semibold",
    }, [
      e("span", { key: "icon" }, isAmber ? "🔴" : "🟡"),
      t("aiAdvisoryWarning.heading", { defaultValue: "AI Connection Status" }),
    ]),
    showBudgetWarning
      ? e("p", { key: "bw", className: "mb-1 font-semibold" },
          t("aiAdvisoryWarning.budgetSoftWarning", {
            used: budget.tokens_used,
            max: budget.token_budget,
            pct: budget.pct_used,
            defaultValue: `Token budget ${budget.pct_used}% used (${budget.tokens_used}/${budget.token_budget}). Approaching daily limit.`,
          })
        )
      : null,
    personalKeyFailed
      ? e("p", { key: "pf", className: "mb-1" }, [
          t("aiAdvisoryWarning.personalKeyFailed", { defaultValue: "Personal API Key failed or unavailable." }),
          personalKeyError
            ? " " + t("aiAdvisoryWarning.personalKeyError", { error: personalKeyError, defaultValue: `Error: ${personalKeyError}` })
            : null,
        ])
      : null,
    usingSystemFallback && !exhausted
      ? e("p", { key: "sf", className: "mb-1" },
          t("aiAdvisoryWarning.usingSystemFallback", { defaultValue: "System fallback key is being used to maintain AI Advisory." })
        )
      : null,
    fallbackRemaining != null && fallbackQuotaMax != null && fallbackQuotaMax > 0
      ? e("p", { key: "fr", className: "mb-1" },
          t("aiAdvisoryWarning.fallbackRemaining", {
            remaining: fallbackRemaining,
            max: fallbackQuotaMax,
            defaultValue: `${fallbackRemaining}/${fallbackQuotaMax} fallback attempts remaining today.`,
          })
        )
      : null,
    exhausted
      ? e("p", { key: "fe", className: "mb-1 font-semibold text-rose-300" },
          t("aiAdvisoryWarning.fallbackExhausted", { defaultValue: "Fallback exhausted today. AI Advisory will be unavailable until you reconfigure your personal API Key in AI Command Center." })
        )
      : null,
    fallbackQuotaReset
      ? e("p", { key: "qr", className: "text-[10px] opacity-60" },
          t("aiAdvisoryWarning.fallbackQuotaReset", { date: new Date(fallbackQuotaReset).toLocaleDateString(localeTag), defaultValue: `Resets: ${new Date(fallbackQuotaReset).toLocaleDateString(localeTag)}` })
        )
      : null,
    onConfigure
      ? e("button", {
          key: "cfg",
          type: "button",
          onClick: onConfigure,
          className: "mt-1.5 rounded-md border border-current px-2 py-1 text-[10px] font-semibold hover:opacity-80",
        },
          t("aiAdvisoryWarning.configureNow", { defaultValue: "Configure now" })
        )
      : null,
  ]);
}
