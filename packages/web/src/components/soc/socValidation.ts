export function validateDateRange(
  dateFrom: string,
  dateTo: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return t("soc.dataops.error_date_range", { defaultValue: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc" });
  }
  if (dateFrom && dateTo) {
    const diffDays = Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 365) {
      return t("soc.dnse.error_max_range", { defaultValue: "Khoảng ngày không được vượt quá 365 ngày" });
    }
  }
  return null;
}
