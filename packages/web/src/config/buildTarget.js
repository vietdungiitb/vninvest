const BUILD_TARGETS = ["community", "saas", "vip"];

export const DEFAULT_BUILD_TARGET = "saas";

const BUILD_TARGET_SET = new Set(BUILD_TARGETS);

export function normalizeBuildTarget(rawValue) {
  const candidate = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  return BUILD_TARGET_SET.has(candidate) ? candidate : DEFAULT_BUILD_TARGET;
}

export function getBuildTarget(env = {}) {
  return normalizeBuildTarget(env.REACT_APP_BUILD_TARGET);
}

export function isBuildTarget(target, activeTarget) {
  return normalizeBuildTarget(target) === normalizeBuildTarget(activeTarget);
}

export { BUILD_TARGETS };