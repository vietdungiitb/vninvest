import { useState, useEffect } from "react";
import { useI18n } from "../../../context/LangContext.js";
import { useTrademarkConfig, useUpdateTrademarkConfig } from "../api/advertisingClient.js";

export default function TrademarkConfigPanel() {
  const { t } = useI18n();
  const { data, isLoading, error } = useTrademarkConfig();
  const updateTrademark = useUpdateTrademarkConfig();
  const [enabled, setEnabled] = useState(false);
  const [activationTs, setActivationTs] = useState(null);
  const [version, setVersion] = useState("cfg_v1");

  // Initialize state from server data
  useEffect(() => {
    if (data?.trademark) {
      setEnabled(data.trademark.enabled);
      setActivationTs(data.trademark.activationTs);
      setVersion(data.trademark.version);
    }
  }, [data]);

  // Format activationTs (ms) to datetime-local string (YYYY-MM-DDTHH:MM)
  const formatDateForInput = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  // Parse datetime-local string to ms timestamp
  const parseDateFromInput = (str) => {
    if (!str) return null;
    return new Date(str).getTime();
  };

  const activationDate = activationTs
    ? new Date(activationTs).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const handleSave = async () => {
    try {
      // Generate new version
      const newVersion = `cfg_v${Date.now()}`;
      await updateTrademark.mutateAsync({
        enabled,
        activation_ts: activationTs,
        version: newVersion,
      });
      setVersion(newVersion);
    } catch (err) {
      console.error("Failed to save trademark config:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        {t("advertising.errors.loadFailed")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("advertising.trademark.title")}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("advertising.trademark.description")}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {t("advertising.trademark.enabled")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("advertising.trademark.enabledHelp")}
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              disabled={updateTrademark.isPending}
              className={`flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? "bg-violet-600" : "bg-slate-200 dark:bg-slate-700"
              }`}
              aria-pressed={enabled}
            >
              <span
                className={`h-5 w-5 rounded-full shadow-sm transition-transform ${
                  enabled ? "translate-x-5 bg-white" : "translate-x-0.5 bg-white"
                }`}
              />
            </button>
          </div>

          {/* Activation time picker */}
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="tm-activation-ts" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t("advertising.trademark.activationTime")}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("advertising.trademark.activationTimeHelp")}
                </p>
              </div>
              <input id="tm-activation-ts"
                type="datetime-local"
                value={formatDateForInput(activationTs)}
                onChange={(e) => setActivationTs(parseDateFromInput(e.target.value))}
                disabled={!enabled || updateTrademark.isPending}
                className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            {activationTs && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t("advertising.trademark.currentValue")}: {activationDate}
              </p>
            )}
          </div>

          {/* Version */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t("advertising.trademark.version")}
            </p>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {version}
            </span>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={updateTrademark.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-600"
        >
          {updateTrademark.isPending ? t("common.saving") : t("advertising.trademark.save")}
        </button>
      </div>

      {/* Success message */}
      {updateTrademark.isSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
          {t("advertising.trademark.saveSuccess")}
        </div>
      )}

      {/* Error message */}
      {updateTrademark.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {t("advertising.trademark.saveFailed")}
        </div>
      )}
    </div>
  );
}