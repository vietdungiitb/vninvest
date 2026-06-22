export function isNewLayoutEnabled(): boolean {
  try {
    const val = localStorage.getItem('VITE_ENABLE_SAAS_OVERLAP_SIDEBAR');
    if (val === 'true') return true;
    if (val === 'false') return false;
  } catch {}
  return true;
}
