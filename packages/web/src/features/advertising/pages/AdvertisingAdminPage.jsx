import { useState, useCallback } from "react";
import { useI18n } from "../../../context/LangContext.js";
import Can from "../../../components/shared/Can.jsx";
import {
  useCampaigns,
  useCampaignAnalytics,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
} from "../api/advertisingClient.js";
import CampaignTable from "../components/CampaignTable.jsx";
import CampaignForm from "../components/CampaignForm.jsx";
import CampaignDetailDrawer from "../components/CampaignDetailDrawer.jsx";
import CampaignMetricsCard from "../components/CampaignMetricsCard.jsx";
import TrademarkConfigPanel from "../components/TrademarkConfigPanel.jsx";

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function AdvertisingAdminPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("overview");
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [viewingCampaign, setViewingCampaign] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: campaignsData, isLoading: loadingCampaigns } = useCampaigns();
  const { data: analyticsData } = useCampaignAnalytics();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();

  const campaigns = Array.isArray(campaignsData) ? campaignsData : campaignsData?.results || [];

  const handleCreate = useCallback(() => {
    setEditingCampaign(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((campaign) => {
    setEditingCampaign(campaign);
    setShowForm(true);
    setViewingCampaign(null);
  }, []);

  const handleDelete = useCallback((campaign) => {
    setDeleteConfirm(campaign);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await deleteCampaign.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch {
      // error handled by mutation
    }
  }, [deleteConfirm, deleteCampaign]);

  const handleFormSubmit = useCallback(
    async (data) => {
      try {
        if (editingCampaign) {
          await updateCampaign.mutateAsync(data);
        } else {
          await createCampaign.mutateAsync(data);
        }
        setShowForm(false);
        setEditingCampaign(null);
      } catch {
        // error handled by mutation
      }
    },
    [editingCampaign, createCampaign, updateCampaign]
  );

  const tabs = [
    { id: "overview", label: t("advertising.tabs.overview") },
    { id: "campaigns", label: t("advertising.tabs.campaigns") },
    { id: "settings", label: t("advertising.tabs.settings") },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t("advertising.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("advertising.description")}
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:bg-violet-500 dark:hover:bg-violet-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("advertising.campaign.create")}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <CampaignMetricsCard summary={analyticsData} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-medium text-slate-900 dark:text-slate-100">
              {t("advertising.campaign.title")}
            </h3>
            <CampaignTable
              campaigns={campaigns.slice(0, 5)}
              loading={loadingCampaigns}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}

      {activeTab === "campaigns" && (
        <CampaignTable
          campaigns={campaigns}
          loading={loadingCampaigns}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {activeTab === "settings" && (
        <Can I="update" a="TrademarkConfig">
          <TrademarkConfigPanel />
        </Can>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative mx-4 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingCampaign ? t("advertising.campaign.edit") : t("advertising.campaign.create")}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <CampaignForm
              campaign={editingCampaign}
              onSubmit={handleFormSubmit}
              onCancel={() => setShowForm(false)}
              loading={createCampaign.isPending || updateCampaign.isPending}
            />
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {viewingCampaign && (
        <CampaignDetailDrawer
          campaign={viewingCampaign}
          onClose={() => setViewingCampaign(null)}
          onEdit={handleEdit}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("advertising.campaign.delete")}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t("advertising.campaign.deleteConfirm", { name: deleteConfirm.name })}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteCampaign.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteCampaign.isPending ? t("common.saving") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
