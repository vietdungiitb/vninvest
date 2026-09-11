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
export { ShellOperationsCenterPage } from "./pages/admin/ShellOperationsCenterPage.tsx";
export { ShellMailConfigPage } from "./pages/admin/ShellMailConfigPage.tsx";
export { ShellAiAdvisoryPage } from "./pages/signals/ShellAiAdvisoryPage.tsx";

export { ShellAiCommandCenterPage } from "./pages/system/ShellAiCommandCenterPage.tsx";
export { AICommandCenterPage } from "./pages/AICommandCenterPage.tsx";
export { ShellDashboardPage } from "./pages/workspace/ShellDashboardPage.tsx";
export { ShellPortfoliosPage } from "./pages/workspace/ShellPortfoliosPage.tsx";
export { ShellTransactionsPage } from "./pages/workspace/ShellTransactionsPage.tsx";
export { ShellWatchlistPage } from "./pages/workspace/ShellWatchlistPage.tsx";
export { ShellSettingsPage } from "./pages/system/ShellSettingsPage.tsx";
export { ShellSupportPage } from "./pages/system/ShellSupportPage.tsx";
export { VipLocalControlPage } from "./pages/vip/VipLocalControlPage.tsx";
// SM-P4 core user-facing pages
export { DashboardPage } from "./pages/DashboardPage.tsx";
export { AlertCenterPage } from "./pages/AlertCenterPage.tsx";
export { StockDetailPage } from "./pages/StockDetailPage.tsx";
export { PortfoliosPage } from "./pages/PortfoliosPage.tsx";
export { TransactionsPage } from "./pages/TransactionsPage.tsx";
export { BillingCenterPage } from "./pages/commercial/BillingCenterPage.tsx";
export { PaymentReturnPage } from "./pages/commercial/PaymentReturnPage.tsx";
export { UserSettingsPage } from "./pages/UserSettingsPage.tsx";
export { AuthLoginPage, AuthRegisterPage, AuthVerifyEmailPage, AuthResetPasswordPage } from "./pages/auth/index.tsx";
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
export { AbilityContext, useAbility, createAbilityFromRules } from "./context/AbilityContext.js";
export { LangProvider, useI18n } from "./context/LangContext.js";
export { PortfolioProvider, usePortfolio } from "./context/PortfolioContext.js";
export { RealtimeProvider, useRealtimeFeedFromManager } from "./context/RealtimeContext.js";
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