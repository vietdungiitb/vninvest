import { createElement } from "react";
import { EmptyState } from "./EmptyState.js";

/** Error state dùng chung: có reason + CTA thử lại, không hiện dữ liệu giả. */
export function ErrorState({ message, retryLabel, onRetry }: {
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return createElement(EmptyState, {
    title: message ?? "Không thể tải dữ liệu",
    ctaLabel: retryLabel,
    ctaOnClick: onRetry,
  });
}
