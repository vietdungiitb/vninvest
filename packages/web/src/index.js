export { BUILD_TARGETS, DEFAULT_BUILD_TARGET, getBuildTarget, isBuildTarget, normalizeBuildTarget } from "./config/buildTarget.js";
export { routeCatalog, getRouteCatalogIds, getRoutesForBuildTarget } from "./app/routeCatalog.js";
export { navigationCatalog, getNavigationGroupIds, getNavigationForBuildTarget } from "./app/navigationCatalog.js";
export {
	ShellField,
	ShellMetric,
	ShellPageChrome,
	ShellPanel,
	ShellSelectField,
	renderShellField,
	renderShellMetric,
	renderShellPageChrome,
	renderShellPanel,
	renderShellSelectField,
} from "./components/ShellPageTemplate.js";
export { getPageComponent, getPageLoader, getPageRegistryRouteIds, pageRegistry } from "./pages/pageRegistry.js";
export { ShellOperationsCenterPage } from "./pages/admin/ShellOperationsCenterPage.js";
export { ShellMailConfigPage } from "./pages/admin/ShellMailConfigPage.js";
export { ShellAiAdvisoryPage } from "./pages/signals/ShellAiAdvisoryPage.js";
export { ShellWhaleAlertsPage } from "./pages/signals/ShellWhaleAlertsPage.js";
export { ShellStockDetailPage } from "./pages/market/ShellStockDetailPage.js";
export { ShellAiCommandCenterPage } from "./pages/system/ShellAiCommandCenterPage.js";
export { ShellDashboardPage } from "./pages/workspace/ShellDashboardPage.js";
export { ShellPortfoliosPage } from "./pages/workspace/ShellPortfoliosPage.js";
export { ShellTransactionsPage } from "./pages/workspace/ShellTransactionsPage.js";
export { ShellWatchlistPage } from "./pages/workspace/ShellWatchlistPage.js";
export { ShellSettingsPage } from "./pages/system/ShellSettingsPage.js";
export { ShellSupportPage } from "./pages/system/ShellSupportPage.js";
export { VipLocalControlPage } from "./pages/vip/VipLocalControlPage.js";
// SM-P4 core user-facing pages
export { DashboardPage } from "./pages/DashboardPage.js";
export { AlertCenterPage } from "./pages/AlertCenterPage.js";
export { WhaleAlertsPage } from "./pages/WhaleAlertsPage.js";
export { StockDetailPage } from "./pages/StockDetailPage.js";
export { PortfoliosPage } from "./pages/PortfoliosPage.js";
export { TransactionsPage } from "./pages/TransactionsPage.js";
export { UserSettingsPage } from "./pages/UserSettingsPage.js";
export { AuthLoginPage, AuthRegisterPage, AuthVerifyEmailPage, AuthResetPasswordPage } from "./pages/auth/index.js";
export { authTokenStorage, coreApiAdapter, createCoreApiAdapter } from "./adapters/coreApiAdapter.js";
export { coreAdapter, createCoreAdvisorySessionClient, createCoreWhaleAnalyticsSnapshotClient } from "./adapters/core/index.js";
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
export {
	communityFeatureComponents,
	communityFeatureHooks,
	communityFeaturePages,
} from "./features/community/index.js";
export {
	saasFeatureComponents,
	saasFeatureHooks,
	saasFeaturePages,
} from "./features/saas/index.js";
export {
	vipFeatureComponents,
	vipFeatureHooks,
	vipFeaturePages,
} from "./features/vip/index.js";

import { coreAdapter } from "./adapters/core/index.js";
import { vipAppAdapter } from "./adapters/vip-app/index.js";

export const shellAdapters = Object.freeze([coreAdapter, vipAppAdapter]);