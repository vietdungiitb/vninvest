// Plan Catalog — single source of truth (frontend mirror của commercial/plan_catalog.py).
// Giải quyết audit C2 (taxonomy 3 bộ) và H9 (Stripe/VNPay plan param mismatch).

export type CanonicalPlan = "starter" | "pro" | "enterprise";
export type VipPlan = "VIP_1M" | "VIP_6M" | "VIP_12M";

export const CANONICAL_PLANS: CanonicalPlan[] = ["starter", "pro", "enterprise"];

export const VIP_TO_CANONICAL: Record<VipPlan, CanonicalPlan> = {
  VIP_1M: "starter",
  VIP_6M: "pro",
  VIP_12M: "enterprise",
};

export const CANONICAL_TO_VIP: Record<CanonicalPlan, VipPlan> = {
  starter: "VIP_1M",
  pro: "VIP_6M",
  enterprise: "VIP_12M",
};

export const PLAN_PRICES_VND: Record<CanonicalPlan, number> = {
  starter: 100000,
  pro: 500000,
  enterprise: 900000,
};

export const PLAN_DURATIONS_DAYS: Record<CanonicalPlan, number> = {
  starter: 30,
  pro: 180,
  enterprise: 360,
};

export function normalizePlan(rawPlan: string): CanonicalPlan | "" {
  const value = (rawPlan || "").trim();
  if ((CANONICAL_PLANS as string[]).includes(value)) {
    return value as CanonicalPlan;
  }
  if (value in VIP_TO_CANONICAL) {
    return VIP_TO_CANONICAL[value as VipPlan];
  }
  return "";
}

export interface PlanCatalogOption {
  id: VipPlan;
  canonicalPlan: CanonicalPlan;
  title: string;
  desc: string;
  price: number;
  period: string;
  savings: string | null;
  badge: string | null;
}

// Display strings (title/desc/period/savings/badge) sẽ được i18n ở phase M10.
export const PLAN_OPTIONS: PlanCatalogOption[] = [
  {
    id: "VIP_1M",
    canonicalPlan: "starter",
    title: "VIP 1 Tháng",
    desc: "Trải nghiệm đầy đủ tính năng phân tích cơ bản và dòng tiền cá mập.",
    price: 100000,
    period: "Tháng",
    savings: null,
    badge: null,
  },
  {
    id: "VIP_6M",
    canonicalPlan: "pro",
    title: "VIP 6 Tháng",
    desc: "Giải pháp tối ưu cho nhà giao dịch năng động, tiết kiệm chi phí.",
    price: 500000,
    period: "6 Tháng",
    savings: "Tiết kiệm 100,000 đ",
    badge: "Phổ biến nhất",
  },
  {
    id: "VIP_12M",
    canonicalPlan: "enterprise",
    title: "VIP 12 Tháng",
    desc: "Đặc quyền VIP trọn vẹn, cập nhật tín hiệu sớm nhất và AI Advisor hỗ trợ 24/7.",
    price: 900000,
    period: "Năm",
    savings: "Tiết kiệm 300,000 đ",
    badge: "Giá trị nhất",
  },
];
