import { createElement } from "react";
import { EmptyState } from "./EmptyState.js";
import { useI18n } from "../../context/LangContext.js";

/** Error state dùng chung: có reason + CTA thử lại, không hiện dữ liệu giả. */
export function ErrorState({ message, retryLabel, onRetry }: {
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return createElement(EmptyState, {
    title: message ?? t("common.loadFailed", { defaultValue: "Không thể tải dữ liệu" }),
    ctaLabel: retryLabel,
    ctaOnClick: onRetry,
  });
}
