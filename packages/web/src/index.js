export { BUILD_TARGETS, DEFAULT_BUILD_TARGET, getBuildTarget, isBuildTarget, normalizeBuildTarget } from "./config/buildTarget.js";
export { routeCatalog, getRouteCatalogIds, getRoutesForBuildTarget } from "./app/routeCatalog.js";
export { navigationCatalog, getNavigationGroupIds, getNavigationForBuildTarget } from "./app/navigationCatalog.js";
export { coreAdapter } from "./adapters/core/index.js";
export { createVipAppControlClient, vipAppAdapter } from "./adapters/vip-app/index.js";
export {
	createBootstrapClient,
	deriveLegacyAuthState,
	loadShellBootstrap,
	resolveShellAdapter,
} from "./context/bootstrapClient.js";
export {
	createEmptyAuthRuntimeState,
	createShellAuthRuntime,
	deriveAuthRuntimeState,
} from "./context/authRuntime.js";
export {
	ShellAuthContext,
	ShellAuthProvider,
	ShellAuthRuntimeContext,
	useShellAuth,
	useShellAuthRuntime,
} from "./context/authReact.js";

import { coreAdapter } from "./adapters/core/index.js";
import { vipAppAdapter } from "./adapters/vip-app/index.js";

export const shellAdapters = Object.freeze([coreAdapter, vipAppAdapter]);