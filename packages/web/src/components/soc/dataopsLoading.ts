/**
 * DataOps skeleton chỉ được phép hiện LẦN ĐẦU (khi chưa có inventory).
 *
 * DataOpsContext.refreshAll() chạy mỗi 15s và bật `loading.inventory/runs`
 * trước mỗi fetch. Nếu component dùng trực tiếp cờ đó để render skeleton,
 * số liệu sẽ bị thay bằng khối rỗng rồi hiện lại sau mỗi poll — gây flash.
 */
export function shouldShowDataOpsSkeleton(
  inventory: unknown,
  loading: Record<string, boolean> | undefined,
): boolean {
  if (inventory) return false;
  return Boolean(loading?.inventory || loading?.runs);
}
