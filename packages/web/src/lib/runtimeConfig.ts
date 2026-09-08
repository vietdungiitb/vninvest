export function isNewLayoutEnabled(): boolean {
  // P3-3 flag compat: support both old VITE_ENABLE_SAAS_OVERLAP_SIDEBAR and new VITE_LAYOUT_VARIANT
  // Precedence: new flag (VITE_LAYOUT_VARIANT) > old flag, per MEDIUM11
  // Values: "true"/"false" for old, "overlap"/"classic" for new (classic = false)
  try {
    const newVal = localStorage.getItem('VITE_LAYOUT_VARIANT');
    if (newVal === 'overlap') return true;
    if (newVal === 'classic') return false;
    if (newVal === 'true') return true;
    if (newVal === 'false') return false;
    const oldVal = localStorage.getItem('VITE_ENABLE_SAAS_OVERLAP_SIDEBAR');
    if (oldVal === 'true') return true;
    if (oldVal === 'false') return false;
  } catch {}
  return true;
}
