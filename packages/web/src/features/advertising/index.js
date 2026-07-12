export { default as AdvertisingAdminPage } from "./pages/AdvertisingAdminPage.jsx";
export { default as CampaignTable } from "./components/CampaignTable.jsx";
export { default as CampaignForm } from "./components/CampaignForm.jsx";
export { default as CampaignDetailDrawer } from "./components/CampaignDetailDrawer.jsx";
export { default as CampaignMetricsCard } from "./components/CampaignMetricsCard.jsx";
export { default as TrademarkConfigPanel } from "./components/TrademarkConfigPanel.jsx";

export {
  useCampaigns,
  useCampaign,
  useCampaignAnalytics,
  useTrademarkConfig,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  advertisingKeys,
} from "./api/advertisingClient.js";
