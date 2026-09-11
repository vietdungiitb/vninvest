export const CAMPAIGN_TYPE_LABELS = {
  internal_promo: "advertising.campaign.typeInternal",
  partner_ad: "advertising.campaign.typePartner",
};

export const CAMPAIGN_STATUS_LABELS = {
  draft: "advertising.campaign.statusDraft",
  active: "advertising.campaign.statusActive",
  paused: "advertising.campaign.statusPaused",
  completed: "advertising.campaign.statusCompleted",
};

export const CAMPAIGN_STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

export const CAMPAIGN_TYPE_COLORS = {
  internal_promo: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  partner_ad: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export const CAMPAIGN_TABLE_COLUMNS = [
  { accessorKey: "name", header: "advertising.campaign.name" },
  { accessorKey: "campaign_type", header: "advertising.campaign.type" },
  { accessorKey: "status", header: "advertising.campaign.status" },
  { accessorKey: "weight", header: "advertising.campaign.weight" },
  { accessorKey: "start_date", header: "advertising.campaign.startDate" },
  { accessorKey: "end_date", header: "advertising.campaign.endDate" },
  { id: "actions", header: "", enableSorting: false },
];
