import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { coreApiAdapter } from "../../../adapters/coreApiAdapter.js";

const adapter = /** @type {any} */ (coreApiAdapter);

export const advertisingKeys = {
  all: ["advertising"],
  campaigns: () => [...advertisingKeys.all, "campaigns"],
  campaignList: (params) => [...advertisingKeys.campaigns(), params],
  campaignDetail: (id) => [...advertisingKeys.campaigns(), id],
  analytics: (params) => [...advertisingKeys.all, "analytics", params],
  trademark: () => [...advertisingKeys.all, "trademark"],
};

export function useCampaigns(params = {}) {
  return useQuery({
    queryKey: advertisingKeys.campaignList(params),
    queryFn: () => adapter.getAdvertisingCampaigns(params),
    placeholderData: (prev) => prev,
  });
}

export function useCampaign(id) {
  return useQuery({
    queryKey: advertisingKeys.campaignDetail(id),
    queryFn: () => adapter.getAdvertisingCampaign(id),
    enabled: !!id,
  });
}

export function useCampaignAnalytics(params = {}) {
  return useQuery({
    queryKey: advertisingKeys.analytics(params),
    queryFn: () => adapter.getCampaignAnalytics(params),
    placeholderData: (prev) => prev,
  });
}

export function useTrademarkConfig() {
  return useQuery({
    queryKey: advertisingKeys.trademark(),
    queryFn: () => adapter.getTrademarkConfig(),
  });
}

export function useUpdateTrademarkConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => adapter.updateTrademarkConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: advertisingKeys.trademark() });
    },
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => adapter.createAdvertisingCampaign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: advertisingKeys.campaigns() });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => adapter.updateAdvertisingCampaign(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: advertisingKeys.campaigns() });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => adapter.deleteAdvertisingCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: advertisingKeys.campaigns() });
    },
  });
}
