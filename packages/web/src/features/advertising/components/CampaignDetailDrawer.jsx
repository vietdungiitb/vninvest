import { useI18n } from "../../../context/LangContext.js";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPE_COLORS,
} from "../constants/advertising.js";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CampaignDetailDrawer({ campaign, onClose, onEdit }) {
  const { t } = useI18n();

  if (!campaign) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {campaign.name}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  CAMPAIGN_STATUS_COLORS[campaign.status] || ""
                }`}
              >
                {t(CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status)}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  CAMPAIGN_TYPE_COLORS[campaign.campaign_type] || ""
                }`}
              >
                {t(CAMPAIGN_TYPE_LABELS[campaign.campaign_type] || campaign.campaign_type)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 px-6 py-4">
          {/* Banner preview */}
          {campaign.banner_url && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <img
                src={campaign.banner_url}
                alt={campaign.name}
                className="max-h-20 rounded border border-slate-200 dark:border-slate-700"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
          )}

          {/* Details grid */}
          <div className="space-y-3">
            <DetailRow label={t("advertising.campaign.weight")} value={campaign.weight} />
            <DetailRow label={t("advertising.campaign.startDate")} value={formatDate(campaign.start_date)} />
            <DetailRow label={t("advertising.campaign.endDate")} value={formatDate(campaign.end_date)} />
            <DetailRow label={t("advertising.campaign.bannerWidth")} value={`${campaign.banner_width}px`} />
            <DetailRow label={t("advertising.campaign.bannerHeight")} value={`${campaign.banner_height}px`} />
            <DetailRow label={t("advertising.campaign.tenant")} value={campaign.tenant || "—"} />
          </div>

          {/* URLs */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              URLs
            </h4>
            <UrlRow label="Banner" url={campaign.banner_url} />
            <UrlRow label="Destination" url={campaign.destination_url} />
            {campaign.banner_url_retina && <UrlRow label="Retina" url={campaign.banner_url_retina} />}
            {campaign.banner_url_svg && <UrlRow label="SVG" url={campaign.banner_url_svg} />}
          </div>

          {/* Targeting rules */}
          {campaign.targeting_rules && Object.keys(campaign.targeting_rules).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("advertising.campaign.targetingRules")}
              </h4>
              <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {JSON.stringify(campaign.targeting_rules, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onEdit?.(campaign)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
          >
            {t("common.edit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function UrlRow({ label, url }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate text-xs text-violet-600 hover:underline dark:text-violet-400"
      >
        {url}
      </a>
    </div>
  );
}
