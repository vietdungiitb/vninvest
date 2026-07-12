import { z } from "zod";

export const CampaignTypeEnum = z.enum(["internal_promo", "partner_ad"]);
export const CampaignStatusEnum = z.enum(["draft", "active", "paused", "completed"]);

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(120),
  campaign_type: CampaignTypeEnum,
  status: CampaignStatusEnum,
  banner_url: z.string().url(),
  banner_url_retina: z.string().url().nullable().optional(),
  banner_url_svg: z.string().url().nullable().optional(),
  banner_width: z.number().int().positive(),
  banner_height: z.number().int().positive(),
  destination_url: z.string().url(),
  weight: z.number().int().min(1).max(1000),
  start_date: z.string(),
  end_date: z.string(),
  tenant: z.string().nullable().optional(),
  targeting_rules: z.record(z.unknown()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CampaignFormSchema = z.object({
  name: z.string().min(1, "Tên chiến dịch là bắt buộc").max(120),
  campaign_type: CampaignTypeEnum,
  status: CampaignStatusEnum,
  banner_url: z.string().url("URL banner không hợp lệ"),
  banner_url_retina: z.string().url().optional().or(z.literal("")),
  banner_url_svg: z.string().url().optional().or(z.literal("")),
  banner_width: z.number().int().positive().default(300),
  banner_height: z.number().int().positive().default(50),
  destination_url: z.string().url("URL đích không hợp lệ"),
  weight: z.number().int().min(1).max(1000).default(100),
  start_date: z.string().min(1, "Ngày bắt đầu là bắt buộc"),
  end_date: z.string().min(1, "Ngày kết thúc là bắt buộc"),
  tenant: z.string().optional().nullable(),
  targeting_rules: z.string().optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.end_date) > new Date(data.start_date);
    }
    return true;
  },
  {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["end_date"],
  }
);

export const TrademarkConfigSchema = z.object({
  trademark: z.object({
    enabled: z.boolean(),
    activationTs: z.number().nullable().optional(),
    version: z.string(),
  }),
});
