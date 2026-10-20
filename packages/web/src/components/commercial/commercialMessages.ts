import { useCallback } from "react";
import { useI18n } from "../../context/LangContext.js";

export interface CommercialMessages {
  retry: string;
  retryHint: string;
  loading: string;
  emptyValue: string;
  emptyReason: string;
}

const VI_MESSAGES: CommercialMessages = {
  retry: "Thử lại",
  retryHint: "Nếu lỗi vẫn tiếp diễn, hãy tải lại trang hoặc liên hệ quản trị viên.",
  loading: "Đang tải dữ liệu...",
  emptyValue: "—",
  emptyReason: "Chưa có dữ liệu để hiển thị.",
};

const EN_MESSAGES: CommercialMessages = {
  retry: "Try again",
  retryHint: "If the problem persists, reload the page or contact your administrator.",
  loading: "Loading data...",
  emptyValue: "—",
  emptyReason: "No data to display yet.",
};

export interface CommercialTranslator {
  t: (key: string, defaultValue: string) => string;
  messages: CommercialMessages;
}

export function useCommercialTranslator(): CommercialTranslator {
  const { t, locale } = useI18n();
  const messages = locale === "en" ? EN_MESSAGES : VI_MESSAGES;
  const translate = useCallback(
    (key: string, defaultValue: string) => t(key, { defaultValue }),
    [t],
  );
  return { t: translate, messages };
}
