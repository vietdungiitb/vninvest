import { createElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';

const e = createElement;

interface PlanDef {
  key: string;
  accent: string;
  features: string[];
}

export default function UpgradePage() {
  const { t } = useI18n();
  const { userPlan } = usePortfolio();

  const PLAN_DEFS: PlanDef[] = [
    {
      key: 'starter',
      accent: 'border-slate-700 bg-slate-900/70',
      features: [
        t('upgrade.featureStarter1', { defaultValue: 'Đến 3 danh mục đầu tư' }),
        t('upgrade.featureStarter2', { defaultValue: 'Dữ liệu thị trường cơ bản' }),
        t('upgrade.featureStarter3', { defaultValue: 'Cảnh báo giá cơ bản' }),
      ],
    },
    {
      key: 'pro',
      accent: 'border-cyan-800/70 bg-cyan-950/20',
      features: [
        t('upgrade.featurePro1', { defaultValue: 'Danh mục không giới hạn' }),
        t('upgrade.featurePro2', { defaultValue: 'Dữ liệu intraday realtime' }),
        t('upgrade.featurePro3', { defaultValue: 'Phân tích kỹ thuật nâng cao' }),
        t('upgrade.featurePro4', { defaultValue: 'Cảnh báo thông minh' }),
      ],
    },
    {
      key: 'enterprise',
      accent: 'border-amber-700/70 bg-amber-950/20',
      features: [
        t('upgrade.featureEnterprise1', { defaultValue: 'Tất cả tính năng Pro' }),
        t('upgrade.featureEnterprise2', { defaultValue: 'Tín hiệu Whale & Dark Flow' }),
        t('upgrade.featureEnterprise3', { defaultValue: 'API truy xuất dữ liệu' }),
        t('upgrade.featureEnterprise4', { defaultValue: 'Hỗ trợ ưu tiên 24/7' }),
        t('upgrade.featureEnterprise5', { defaultValue: 'Phân tích AI chuyên sâu' }),
      ],
    },
  ];

  return e("div", { className: "mx-auto flex min-h-full max-w-6xl flex-col gap-5 p-4 xl:px-5" },
    e("section", { className: "card-section px-5 py-6" },
      e("p", { className: "text-label" }, t("upgrade.sectionLabel", { defaultValue: "Nâng cấp tài khoản" })),
      e("h1", { className: "mt-2 text-3xl font-semibold text-slate-100" }, t("upgrade.title", { defaultValue: "Chọn gói phù hợp với bạn" })),
      e("p", { className: "mt-3 max-w-3xl text-sm leading-7 text-slate-400" },
        userPlan ? `${t("upgrade.currentPlan")} ${userPlan}. ${t("upgrade.upgradeTo")}` : t("upgrade.explorePlans", { defaultValue: "Khám phá các gói dịch vụ của VNInvest." })
      ),
      e("div", { className: "mt-5 flex flex-wrap items-center gap-3" },
        e(Link, { to: "/dashboard", className: "btn-secondary inline-flex items-center justify-center" }, t("upgrade.backDashboard", { defaultValue: "Quay lại Dashboard" })),
        e(Link, { to: "/watchlist", className: "btn-primary inline-flex items-center justify-center" }, t("upgrade.openMarketRadar", { defaultValue: "Mở Market Radar" }))
      )
    ),
    e("div", { className: "grid gap-4 lg:grid-cols-3" },
      PLAN_DEFS.map((plan: PlanDef) =>
        e("section", { key: plan.key, className: `card-section px-5 py-5 ${plan.accent}` },
          e("div", { className: "flex items-center justify-between gap-3" },
            e("h2", { className: "text-lg font-semibold text-slate-100 capitalize" }, plan.key),
            userPlan === plan.key
              ? e("span", { className: "rounded-full border border-emerald-700/70 bg-emerald-950/30 px-2.5 py-1 text-[var(--fs-2xs)] font-semibold text-emerald-300" }, t("upgrade.currentBadge", { defaultValue: "Gói hiện tại" }))
              : null
          ),
          e("div", { className: "mt-4 space-y-2 text-sm text-slate-300" },
            plan.features.map((feature: string) =>
              e("p", { key: feature }, `- ${feature}`)
            )
          )
        )
      )
    )
  );
}
