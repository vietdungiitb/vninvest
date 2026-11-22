/**
 * Build-time stub for the optional `@vninvestcharts/widget-pro/register` module.
 *
 * D4b (Owner 2026-11-22): widget-pro is deferred — all published versions pin
 * widget@0.4.3 and conflict with the 0.4.7 demo build. The widget's dynamic
 * import is wrapped in `.catch(() => null)`, so a no-op module keeps the bundle
 * resolvable while Pro-only features (Pine/strategy/replay) stay unavailable.
 */
export function registerProExtension() {
  return false;
}

export default null;
