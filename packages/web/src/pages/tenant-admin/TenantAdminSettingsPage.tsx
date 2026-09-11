import ta from "./TenantAdmin.module.css";
import { useEffect, useState } from "react";
import { ShellPageChrome, ShellPanel, ShellField, ShellSelectField } from "../../components/ShellPageTemplate.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useToast } from "../../components/ShellToast.js";
import { useQueryClient } from "@tanstack/react-query";
import { useTenantAdminQuery, invalidateTenantAdminQueries } from "./useTenantAdminQuery.js";

interface Settings {
  logo_url: string | null;
  timezone: string;
  locale: string;
  theme: string;
  custom_domain: string | null;
  created_at?: string;
  updated_at?: string;
}

const TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'UTC',
];

const DEFAULT_SETTINGS: Settings = {
  logo_url: null,
  timezone: 'Asia/Ho_Chi_Minh',
  locale: 'vi',
  theme: 'dark',
  custom_domain: null,
};

export function TenantAdminSettingsPage() {
  const { t } = useI18n();
  const { activeTenantId } = usePortfolio();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading: loading, error } = useTenantAdminQuery<Settings>(
    ["tenant-settings"],
    `/core/v1/partner/settings/`,
    { headers: activeTenantId ? { 'X-Tenant-ID': activeTenantId } : undefined, enabled: !!activeTenantId },
  );

  useEffect(() => {
    if (data) {
      setSettings({
        logo_url: data.logo_url ?? null,
        timezone: data.timezone ?? 'Asia/Ho_Chi_Minh',
        locale: data.locale ?? 'vi',
        theme: data.theme ?? 'dark',
        custom_domain: data.custom_domain ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
      setDirty(false);
    }
  }, [data]);

  const update = (field: keyof Settings, value: string) => {
    setSettings((s) => ({ ...s, [field]: value }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await defaultCoreApiAdapter.corePut(
        `/core/v1/partner/settings/`,
        {
          timezone: settings.timezone,
          locale: settings.locale,
          theme: settings.theme,
          custom_domain: settings.custom_domain || null,
          logo_url: settings.logo_url || null,
        },
        { headers: { 'X-Tenant-ID': activeTenantId } },
      );
      setDirty(false);
      toast.success(t('tenantSettings.saveSuccess') || 'Settings saved');
      invalidateTenantAdminQueries(queryClient);
    } catch {
      toast.error(t('tenantSettings.saveFailed') || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <ShellPageChrome
        eyebrow={t('tenantSettings.eyebrow') || 'Tenant Settings'}
        title={t('tenantSettings.title') || 'Tenant Settings'}
      >
        <ShellSkeleton variant="card" count={6} />
      </ShellPageChrome>
    );
  }

  if (error) {
    return (
      <ShellPageChrome
        eyebrow={t('tenantSettings.eyebrow') || 'Tenant Settings'}
        title={t('tenantSettings.title') || 'Tenant Settings'}
        error={error.message || t('tenantSettings.loadFailed')}
      >
        <div className="panel-error">{error.message || t('tenantSettings.loadFailed')}</div>
      </ShellPageChrome>
    );
  }

  return (
    <ShellPageChrome
      eyebrow={t('tenantSettings.eyebrow') || 'Tenant Settings'}
      title={t('tenantSettings.title') || 'Tenant Settings'}
      description={t('tenantSettings.description') || 'Manage your workspace display and locale preferences.'}
    >
      <ShellPanel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '640px' }}>
          <ShellSelectField
            label={t('tenantSettings.timezoneLabel') || 'Timezone'}
            name="timezone"
            value={settings.timezone}
            onChange={(e: any) => update('timezone', e.target.value)}
            options={TIMEZONES.map((tz) => ({ key: tz, label: tz }))}
          />

          <ShellSelectField
            label={t('tenantSettings.localeLabel') || 'Language'}
            name="locale"
            value={settings.locale}
            onChange={(e: any) => update('locale', e.target.value)}
            options={[
              { key: 'vi', label: t('tenantSettings.localeVi') || 'Tiếng Việt' },
              { key: 'en', label: t('tenantSettings.localeEn') || 'English' },
            ]}
          />

          <ShellSelectField
            label={t('tenantSettings.themeLabel') || 'Theme'}
            name="theme"
            value={settings.theme}
            onChange={(e: any) => update('theme', e.target.value)}
            options={[
              { key: 'dark', label: t('tenantSettings.themeDark') || 'Dark' },
              { key: 'light', label: t('tenantSettings.themeLight') || 'Light' },
            ]}
          />

          <ShellField
            label={t('tenantSettings.customDomainLabel') || 'Custom Domain'}
            name="custom_domain"
            value={settings.custom_domain || ''}
            onChange={(e: any) => update('custom_domain', e.target.value)}
            placeholder="app.example.com"
          />
        </div>

        {settings.updated_at && (
          <p style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {t('tenantSettings.lastUpdated') || 'Last updated'}: {new Date(settings.updated_at).toLocaleString()}
          </p>
        )}

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button
            className={ta.taButton}
            onClick={save}
            disabled={!dirty || saving}
            style={{ opacity: (!dirty || saving) ? 0.5 : 1 }}
          >
            {saving
              ? (t('tenantSettings.saving') || 'Saving...')
              : (t('tenantSettings.save') || 'Save Settings')}
          </button>
          {dirty && (
            <button
              className={ta.taButtonSecondary}
              onClick={() => invalidateTenantAdminQueries(queryClient)}
            >
              {t('tenantSettings.discard') || 'Discard'}
            </button>
          )}
        </div>
      </ShellPanel>
    </ShellPageChrome>
  );
}
