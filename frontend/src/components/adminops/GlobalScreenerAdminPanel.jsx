import React, { useCallback, useEffect, useState } from 'react';
import {
  createAdminGlobalScreenerRule,
  deleteAdminGlobalScreenerRule,
  getAdminGlobalScreenerRules,
  getAdminScreenerConfig,
  runAdminGlobalScreenerManual,
  updateAdminGlobalScreenerRule,
  updateAdminScreenerConfig,
} from '../../api/client';
import { useI18n } from '../../context/LangContext';

const DEFAULT_RULE_JSON = `[
  {
    "field": "whale_intensity",
    "op": "gte",
    "value": 80
  }
]`;

function fmtDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString('vi-VN');
}

function createEmptyRuleForm() {
  return {
    name: '',
    is_active: true,
    rules_json_text: DEFAULT_RULE_JSON,
  };
}

function extractApiMessage(error, fallbackMessage) {
  const data = error?.response?.data;
  if (!data) {
    return error?.message || fallbackMessage;
  }
  if (typeof data === 'string') {
    return data;
  }
  if (typeof data.detail === 'string') {
    return data.detail;
  }
  if (typeof data.message === 'string') {
    return data.message;
  }

  const fieldErrors = Object.entries(data).flatMap(([field, value]) => {
    if (field === 'non_field_errors') {
      return Array.isArray(value) ? value : [String(value)];
    }
    if (Array.isArray(value)) {
      return value.map((item) => `${field}: ${item}`);
    }
    if (typeof value === 'string') {
      return [`${field}: ${value}`];
    }
    return [];
  });

  if (fieldErrors.length > 0) {
    return fieldErrors.join(' · ');
  }

  return fallbackMessage;
}

function parseRuleJson(rawText) {
  const normalized = String(rawText || '').trim();
  if (!normalized) {
    throw new Error('Luật JSON không được để trống.');
  }

  const parsed = JSON.parse(normalized);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Luật JSON phải là một mảng điều kiện không rỗng.');
  }

  return parsed;
}

function RuleToggleBadge({ value, t }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${value ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
    >
      {value ? t('adminOps.globalScreenerEnabled', { defaultValue: 'Bật' }) : t('adminOps.globalScreenerDisabled', { defaultValue: 'Tắt' })}
    </span>
  );
}

export default function GlobalScreenerAdminPanel() {
  const { t } = useI18n();
  const [configLoading, setConfigLoading] = useState(true);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [manualRunning, setManualRunning] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const [rulesMessage, setRulesMessage] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  const [config, setConfig] = useState(null);
  const [configForm, setConfigForm] = useState({
    cron_expression: '*/5 * * * *',
    is_user_custom_screener_enabled: true,
  });
  const [rules, setRules] = useState([]);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleForm, setRuleForm] = useState(createEmptyRuleForm());
  const [ruleFormError, setRuleFormError] = useState('');

  const loadConfig = useCallback(async ({ preserveMessage = false } = {}) => {
    setConfigLoading(true);
    if (!preserveMessage) {
      setConfigMessage('');
    }
    try {
      const response = await getAdminScreenerConfig();
      const nextConfig = response?.data || {};
      setConfig(nextConfig);
      setConfigForm({
        cron_expression: String(nextConfig.cron_expression || '*/5 * * * *'),
        is_user_custom_screener_enabled: nextConfig.is_user_custom_screener_enabled !== false,
      });
    } catch (error) {
      setConfigMessage(extractApiMessage(error, t('adminOps.globalScreenerConfigLoadFailed', { defaultValue: 'Không tải được cấu hình Global Screener.' })));
    } finally {
      setConfigLoading(false);
    }
  }, [t]);

  const loadRules = useCallback(async ({ preserveMessage = false } = {}) => {
    setRulesLoading(true);
    if (!preserveMessage) {
      setRulesMessage('');
    }
    try {
      const response = await getAdminGlobalScreenerRules();
      setRules(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      setRulesMessage(extractApiMessage(error, t('adminOps.globalScreenerRulesLoadFailed', { defaultValue: 'Không tải được danh sách luật Global Screener.' })));
    } finally {
      setRulesLoading(false);
    }
  }, [t]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadConfig(), loadRules()]);
  }, [loadConfig, loadRules]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleSaveConfig = useCallback(async (event) => {
    event.preventDefault();
    setConfigSaving(true);
    setConfigMessage('');
    try {
      const payload = {
        cron_expression: String(configForm.cron_expression || '').trim(),
        is_user_custom_screener_enabled: Boolean(configForm.is_user_custom_screener_enabled),
      };
      const response = await updateAdminScreenerConfig(payload);
      const nextConfig = response?.data || payload;
      setConfig(nextConfig);
      setConfigForm({
        cron_expression: String(nextConfig.cron_expression || payload.cron_expression),
        is_user_custom_screener_enabled: nextConfig.is_user_custom_screener_enabled !== false,
      });
      setConfigMessage(t('adminOps.globalScreenerConfigSaved', { defaultValue: 'Đã lưu cấu hình Global Screener.' }));
      await loadConfig({ preserveMessage: true });
    } catch (error) {
      setConfigMessage(extractApiMessage(error, t('adminOps.globalScreenerConfigSaveFailed', { defaultValue: 'Không lưu được cấu hình Global Screener.' })));
    } finally {
      setConfigSaving(false);
    }
  }, [configForm, loadConfig, t]);

  const handleRunManual = useCallback(async () => {
    setManualRunning(true);
    setManualMessage('');
    try {
      const response = await runAdminGlobalScreenerManual();
      setManualMessage(response?.data?.message || t('adminOps.globalScreenerManualQueued', { defaultValue: 'Đã gửi lệnh quét nền thành công.' }));
    } catch (error) {
      setManualMessage(extractApiMessage(error, t('adminOps.globalScreenerManualFailed', { defaultValue: 'Không gửi được lệnh quét nền.' })));
    } finally {
      setManualRunning(false);
    }
  }, [t]);

  const handleResetRuleForm = useCallback(({ preserveMessage = false } = {}) => {
    setEditingRuleId(null);
    setRuleForm(createEmptyRuleForm());
    setRuleFormError('');
    if (!preserveMessage) {
      setRulesMessage('');
    }
  }, []);

  const handleEditRule = useCallback((rule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      name: String(rule.name || ''),
      is_active: Boolean(rule.is_active),
      rules_json_text: JSON.stringify(rule.rules_json ?? [], null, 2),
    });
    setRuleFormError('');
    setRulesMessage('');
  }, []);

  const handleDeleteRule = useCallback(async (ruleId) => {
    const confirmMessage = t('adminOps.globalScreenerDeleteConfirm', { defaultValue: 'Xóa luật này?' });
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setRulesMessage('');
    try {
      await deleteAdminGlobalScreenerRule(ruleId);
      setRulesMessage(t('adminOps.globalScreenerRuleDeleted', { defaultValue: 'Đã xóa luật Global Screener.' }));
      await loadRules({ preserveMessage: true });
      if (editingRuleId === ruleId) {
        handleResetRuleForm({ preserveMessage: true });
      }
    } catch (error) {
      setRulesMessage(extractApiMessage(error, t('adminOps.globalScreenerRuleDeleteFailed', { defaultValue: 'Không xóa được luật Global Screener.' })));
    }
  }, [editingRuleId, handleResetRuleForm, loadRules, t]);

  const handleSubmitRule = useCallback(async (event) => {
    event.preventDefault();
    setRuleSaving(true);
    setRuleFormError('');
    setRulesMessage('');

    try {
      const payload = {
        name: String(ruleForm.name || '').trim(),
        is_active: Boolean(ruleForm.is_active),
        rules_json: parseRuleJson(ruleForm.rules_json_text),
      };

      if (!payload.name) {
        throw new Error('Tên luật không được để trống.');
      }

      if (editingRuleId) {
        await updateAdminGlobalScreenerRule(editingRuleId, payload);
        setRulesMessage(t('adminOps.globalScreenerRuleUpdated', { defaultValue: 'Đã cập nhật luật Global Screener.' }));
      } else {
        await createAdminGlobalScreenerRule(payload);
        setRulesMessage(t('adminOps.globalScreenerRuleCreated', { defaultValue: 'Đã tạo luật Global Screener.' }));
      }

      await loadRules({ preserveMessage: true });
      handleResetRuleForm({ preserveMessage: true });
    } catch (error) {
      setRuleFormError(extractApiMessage(error, t('adminOps.globalScreenerRuleSaveFailed', { defaultValue: 'Không lưu được luật Global Screener.' })));
    } finally {
      setRuleSaving(false);
    }
  }, [editingRuleId, handleResetRuleForm, loadRules, ruleForm, t]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-white shadow-sm dark:border-slate-700">
        <h2 className="text-base font-semibold tracking-wide text-cyan-300">
          {t('adminOps.globalScreenerTitle', { defaultValue: 'Quản trị Global Screener' })}
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {t('adminOps.globalScreenerDesc', { defaultValue: 'Cấu hình lịch quét, bật/tắt screener người dùng và quản lý luật toàn cục từ một bảng điều khiển duy nhất.' })}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('adminOps.globalScreenerConfigTitle', { defaultValue: 'Cấu hình hệ thống' })}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('adminOps.globalScreenerConfigHint', { defaultValue: 'Lưu cấu hình lịch chạy cho global screener và bật/tắt luồng screener người dùng.' })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">
                  {t('adminOps.globalScreenerCurrentCron', { defaultValue: 'Cron hiện tại' })}: {config?.cron_expression || configForm.cron_expression}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">
                  {t('adminOps.globalScreenerUpdatedAt', { defaultValue: 'Cập nhật' })}: {fmtDateTime(config?.updated_at)}
                </span>
              </div>
            </div>

            <form className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end" onSubmit={handleSaveConfig}>
              <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <span>{t('adminOps.globalScreenerCronLabel', { defaultValue: 'Biểu thức cron' })}</span>
                <input
                  type="text"
                  value={configForm.cron_expression}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, cron_expression: event.target.value }))}
                  placeholder="*/5 * * * *"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>

              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={configForm.is_user_custom_screener_enabled}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, is_user_custom_screener_enabled: event.target.checked }))}
                  className="h-4 w-4"
                />
                <span>{t('adminOps.globalScreenerUserEnabledLabel', { defaultValue: 'Bật screener người dùng' })}</span>
              </label>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {configSaving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : null}
                  {configSaving
                    ? t('adminOps.globalScreenerConfigSaving', { defaultValue: 'Đang lưu cấu hình...' })
                    : t('adminOps.globalScreenerConfigSave', { defaultValue: 'Lưu cấu hình' })}
                </button>
                {configMessage ? (
                  <span className={`text-sm ${configMessage.includes('không') || configMessage.includes('Không') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {configMessage}
                  </span>
                ) : null}
              </div>
            </form>

            {configLoading ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {t('adminOps.loading', { defaultValue: 'Đang tải...' })}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('adminOps.globalScreenerManualTitle', { defaultValue: 'Quét thủ công' })}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('adminOps.globalScreenerManualHint', { defaultValue: 'Nút này sẽ gửi lệnh quét nền, phù hợp khi cần chạy lại snapshot ngoài lịch định kỳ.' })}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRunManual}
                disabled={manualRunning}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {manualRunning ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : null}
                {t('adminOps.globalScreenerManualButton', { defaultValue: 'Gửi lệnh quét nền' })}
              </button>
              {manualMessage ? (
                <span className={`text-sm ${manualMessage.includes('không') || manualMessage.includes('Không') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {manualMessage}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('adminOps.globalScreenerRulesTitle', { defaultValue: 'Quản lý luật' })}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('adminOps.globalScreenerRulesHint', { defaultValue: 'Tạo, sửa và xóa các luật screener toàn cục được dùng cho snapshot hệ thống.' })}
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetRuleForm}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t('adminOps.globalScreenerRuleNew', { defaultValue: 'Tạo luật mới' })}
            </button>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmitRule}>
            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.globalScreenerRuleName', { defaultValue: 'Tên luật' })}</span>
              <input
                type="text"
                value={ruleForm.name}
                onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('adminOps.globalScreenerRuleNamePlaceholder', { defaultValue: 'Ví dụ: Luật whale intensity' })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </label>

            <label className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <span>{t('adminOps.globalScreenerRuleJson', { defaultValue: 'Luật JSON' })}</span>
              <textarea
                rows={10}
                value={ruleForm.rules_json_text}
                onChange={(event) => setRuleForm((prev) => ({ ...prev, rules_json_text: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                placeholder={DEFAULT_RULE_JSON}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('adminOps.globalScreenerRuleJsonHint', { defaultValue: 'Dùng mảng điều kiện giống screener người dùng. Ví dụ: [{"field":"whale_intensity","op":"gte","value":80}]' })}
              </p>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={ruleForm.is_active}
                onChange={(event) => setRuleForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                className="h-4 w-4"
              />
              <span>{t('adminOps.globalScreenerRuleActive', { defaultValue: 'Kích hoạt' })}</span>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={ruleSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ruleSaving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : null}
                {editingRuleId
                  ? t('adminOps.globalScreenerRuleUpdate', { defaultValue: 'Cập nhật luật' })
                  : t('adminOps.globalScreenerRuleSave', { defaultValue: 'Lưu luật' })}
              </button>
              {editingRuleId ? (
                <button
                  type="button"
                  onClick={handleResetRuleForm}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {t('adminOps.globalScreenerRuleCancelEdit', { defaultValue: 'Hủy sửa' })}
                </button>
              ) : null}
            </div>

            {ruleFormError ? (
              <p className="text-sm text-red-500">{ruleFormError}</p>
            ) : null}
            {rulesMessage ? (
              <p className={`text-sm ${rulesMessage.includes('không') || rulesMessage.includes('Không') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {rulesMessage}
              </p>
            ) : null}
          </form>

          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/60">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">{t('adminOps.globalScreenerRuleTableName', { defaultValue: 'Tên luật' })}</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">{t('adminOps.globalScreenerRuleTableStatus', { defaultValue: 'Trạng thái' })}</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">{t('adminOps.globalScreenerRuleTableUpdated', { defaultValue: 'Cập nhật' })}</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">{t('adminOps.globalScreenerRuleTableActions', { defaultValue: 'Thao tác' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {rulesLoading ? (
                  <tr>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={4}>
                      {t('adminOps.loading', { defaultValue: 'Đang tải...' })}
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={4}>
                      {t('adminOps.globalScreenerRulesEmpty', { defaultValue: 'Chưa có luật Global Screener nào.' })}
                    </td>
                  </tr>
                ) : rules.map((rule) => (
                  <tr key={rule.id} className={editingRuleId === rule.id ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{rule.name}</div>
                      <div className="mt-1 max-w-[280px] truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                        {JSON.stringify(rule.rules_json ?? [])}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <RuleToggleBadge value={rule.is_active} t={t} />
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{fmtDateTime(rule.updated_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditRule(rule)}
                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-950/30"
                        >
                          {t('adminOps.globalScreenerRuleEdit', { defaultValue: 'Sửa' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                        >
                          {t('adminOps.globalScreenerRuleDelete', { defaultValue: 'Xóa' })}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}