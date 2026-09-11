import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CampaignFormSchema } from "../types/advertising.js";
import { useI18n } from "../../../context/LangContext.js";

function FieldLabel({ children, required }) {
  return (
    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

function FieldError({ error }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-red-500">{error.message}</p>;
}

export default function CampaignForm({ campaign, onSubmit, onCancel, loading }) {
  const { t } = useI18n();
  const isEditing = !!campaign?.id;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CampaignFormSchema),
    defaultValues: {
      name: "",
      campaign_type: "internal_promo",
      status: "draft",
      banner_url: "",
      banner_url_retina: "",
      banner_url_svg: "",
      banner_width: 300,
      banner_height: 50,
      destination_url: "",
      weight: 100,
      start_date: "",
      end_date: "",
      tenant: "",
      targeting_rules: "",
    },
  });

  useEffect(() => {
    if (campaign) {
      reset({
        name: campaign.name || "",
        campaign_type: campaign.campaign_type || "internal_promo",
        status: campaign.status || "draft",
        banner_url: campaign.banner_url || "",
        banner_url_retina: campaign.banner_url_retina || "",
        banner_url_svg: campaign.banner_url_svg || "",
        banner_width: campaign.banner_width || 300,
        banner_height: campaign.banner_height || 50,
        destination_url: campaign.destination_url || "",
        weight: campaign.weight || 100,
        start_date: campaign.start_date ? campaign.start_date.slice(0, 16) : "",
        end_date: campaign.end_date ? campaign.end_date.slice(0, 16) : "",
        tenant: campaign.tenant || "",
        targeting_rules: campaign.targeting_rules
          ? JSON.stringify(campaign.targeting_rules, null, 2)
          : "",
      });
    }
  }, [campaign, reset]);

  const bannerUrl = watch("banner_url");

  const handleFormSubmit = (data) => {
    const payload = {
      ...data,
      banner_url_retina: data.banner_url_retina || null,
      banner_url_svg: data.banner_url_svg || null,
      tenant: data.tenant || null,
      targeting_rules: data.targeting_rules ? JSON.parse(data.targeting_rules) : {},
      start_date: new Date(data.start_date).toISOString(),
      end_date: new Date(data.end_date).toISOString(),
    };
    if (isEditing) {
      payload.id = campaign.id;
    }
    onSubmit?.(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Name */}
      <div>
        <FieldLabel required>{t("advertising.campaign.name")}</FieldLabel>
        <input
          {...register("name")}
          placeholder={t("advertising.campaign.namePlaceholder")}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <FieldError error={errors.name} />
      </div>

      {/* Type + Status row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel required>{t("advertising.campaign.type")}</FieldLabel>
          <select
            {...register("campaign_type")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="internal_promo">{t("advertising.campaign.typeInternal")}</option>
            <option value="partner_ad">{t("advertising.campaign.typePartner")}</option>
          </select>
          <FieldError error={errors.campaign_type} />
        </div>
        <div>
          <FieldLabel required>{t("advertising.campaign.status")}</FieldLabel>
          <select
            {...register("status")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="draft">{t("advertising.campaign.statusDraft")}</option>
            <option value="active">{t("advertising.campaign.statusActive")}</option>
            <option value="paused">{t("advertising.campaign.statusPaused")}</option>
            <option value="completed">{t("advertising.campaign.statusCompleted")}</option>
          </select>
          <FieldError error={errors.status} />
        </div>
      </div>

      {/* Banner URLs */}
      <div>
        <FieldLabel required>{t("advertising.campaign.bannerUrl")}</FieldLabel>
        <input
          {...register("banner_url")}
          type="url"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <FieldError error={errors.banner_url} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>{t("advertising.campaign.bannerUrlRetina")}</FieldLabel>
          <input
            {...register("banner_url_retina")}
            type="url"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <FieldLabel>{t("advertising.campaign.bannerUrlSvg")}</FieldLabel>
          <input
            {...register("banner_url_svg")}
            type="url"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Banner preview */}
      {bannerUrl && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {t("advertising.campaign.bannerPreview")}
          </p>
          <img
            src={bannerUrl}
            alt="Banner preview"
            className="max-h-16 rounded border border-slate-200 dark:border-slate-700"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      )}

      {/* Dimensions */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <FieldLabel required>{t("advertising.campaign.bannerWidth")}</FieldLabel>
          <input
            {...register("banner_width", { valueAsNumber: true })}
            type="number"
            min="1"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <FieldError error={errors.banner_width} />
        </div>
        <div>
          <FieldLabel required>{t("advertising.campaign.bannerHeight")}</FieldLabel>
          <input
            {...register("banner_height", { valueAsNumber: true })}
            type="number"
            min="1"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <FieldError error={errors.banner_height} />
        </div>
        <div>
          <FieldLabel required>{t("advertising.campaign.weight")}</FieldLabel>
          <input
            {...register("weight", { valueAsNumber: true })}
            type="number"
            min="1"
            max="1000"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <FieldError error={errors.weight} />
        </div>
      </div>

      {/* Destination URL */}
      <div>
        <FieldLabel required>{t("advertising.campaign.destinationUrl")}</FieldLabel>
        <input
          {...register("destination_url")}
          type="url"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <FieldError error={errors.destination_url} />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel required>{t("advertising.campaign.startDate")}</FieldLabel>
          <input
            {...register("start_date")}
            type="datetime-local"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <FieldError error={errors.start_date} />
        </div>
        <div>
          <FieldLabel required>{t("advertising.campaign.endDate")}</FieldLabel>
          <input
            {...register("end_date")}
            type="datetime-local"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <FieldError error={errors.end_date} />
        </div>
      </div>

      {/* Targeting Rules */}
      <div>
        <FieldLabel>{t("advertising.campaign.targetingRules")}</FieldLabel>
        <textarea
          {...register("targeting_rules")}
          rows={3}
          placeholder={t("advertising.campaign.targetingRulesPlaceholder")}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <FieldError error={errors.targeting_rules} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={isSubmitting || loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-600"
        >
          {isSubmitting || loading ? t("common.saving") : t("advertising.campaign.save")}
        </button>
      </div>
    </form>
  );
}
