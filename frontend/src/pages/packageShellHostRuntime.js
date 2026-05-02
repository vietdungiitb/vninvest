import { loadShellBootstrap } from '@vninvest/web';

export const packageShellHostEnv = {
  VNINVEST_API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '/api',
  VNINVEST_CORE_BASE_URL: process.env.REACT_APP_PACKAGE_SHELL_CORE_BASE_URL || '/core/v1',
};

function normalizePackageShellIdentity(userIdentity = {}) {
  return {
    user_id: userIdentity.id ?? userIdentity.user_id ?? null,
    username: userIdentity.username || '',
    email: userIdentity.email || '',
    is_staff: Boolean(userIdentity.is_staff ?? userIdentity.isStaff),
    is_superuser: Boolean(userIdentity.is_superuser ?? userIdentity.isSuperuser),
  };
}

function cloneAbilityRules(ability) {
  if (!Array.isArray(ability?.rules)) {
    return [];
  }

  return ability.rules.map((rule) => ({ ...rule }));
}

function isAdminShellIdentity(identity) {
  return Boolean(identity?.is_staff || identity?.is_superuser);
}

function normalizePackageShellNavigation(navigation = {}, isAdminIdentity = false) {
  const visibleGroups = Array.isArray(navigation.visible_groups) ? [...navigation.visible_groups] : [];
  const visibleRoutes = Array.isArray(navigation.visible_routes) ? [...navigation.visible_routes] : [];

  if (isAdminIdentity) {
    return {
      visible_groups: visibleGroups,
      visible_routes: visibleRoutes,
    };
  }

  return {
    visible_groups: visibleGroups.filter((groupId) => groupId !== 'admin'),
    visible_routes: visibleRoutes.filter((routeId) => routeId !== 'admin-ops'),
  };
}

function normalizePackageShellSurfaces(surfaces = {}, isAdminIdentity = false) {
  if (isAdminIdentity) {
    return { ...surfaces };
  }

  return {
    ...surfaces,
    show_admin_ops: false,
  };
}

function buildFrontendSessionId(identity) {
  const sessionSubject = identity?.username || identity?.user_id || 'guest';
  return `frontend-auth:${sessionSubject}`;
}

export function createPackageShellBootstrapLoader({ userIdentity, userPlan, ability }) {
  const normalizedIdentity = normalizePackageShellIdentity(userIdentity);
  const abilityRules = cloneAbilityRules(ability);
  const isAdminIdentity = isAdminShellIdentity(normalizedIdentity);
  const hasFrontendIdentity = Boolean(
    normalizedIdentity.user_id !== null
    || normalizedIdentity.username
    || normalizedIdentity.email,
  );

  return async function packageShellBootstrapLoader(options = {}) {
    const bootstrapPayload = await loadShellBootstrap(options);

    if (!hasFrontendIdentity && !userPlan && abilityRules.length === 0) {
      return bootstrapPayload;
    }

    const capabilities = bootstrapPayload?.capabilities || {};
    const session = bootstrapPayload?.session || {};
    const navigation = normalizePackageShellNavigation(capabilities.navigation, isAdminIdentity);
    const surfaces = normalizePackageShellSurfaces(capabilities.surfaces, isAdminIdentity);

    return {
      ...bootstrapPayload,
      capabilities: {
        ...capabilities,
        principal: {
          ...capabilities.principal,
          identity: hasFrontendIdentity
            ? normalizedIdentity
            : (capabilities.principal?.identity || {}),
        },
        build: {
          ...capabilities.build,
          plan: userPlan || capabilities.build?.plan || 'free',
        },
        abilities: abilityRules,
        navigation,
        surfaces,
      },
      session: {
        ...session,
        session_id: hasFrontendIdentity
          ? buildFrontendSessionId(normalizedIdentity)
          : (session.session_id || buildFrontendSessionId(normalizedIdentity)),
        principal: {
          ...session.principal,
          user_id: hasFrontendIdentity
            ? normalizedIdentity.user_id
            : (session.principal?.user_id ?? null),
          username: hasFrontendIdentity
            ? (normalizedIdentity.username || session.principal?.username || '')
            : (session.principal?.username || ''),
        },
      },
    };
  };
}

function shouldAttachApiToken(requestUrl) {
  if (!requestUrl) {
    return false;
  }

  if (requestUrl.startsWith('/api/')) {
    return true;
  }

  try {
    const resolvedUrl = new URL(requestUrl, globalThis.location?.origin || 'http://127.0.0.1');
    return resolvedUrl.origin === globalThis.location?.origin && resolvedUrl.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export async function packageShellHostFetch(input, init = {}) {
  const requestUrl = typeof input === 'string' ? input : input?.url || '';
  const headers = new Headers(init.headers || {});

  if (shouldAttachApiToken(requestUrl)) {
    const accessToken = globalThis.localStorage?.getItem('access_token');
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}