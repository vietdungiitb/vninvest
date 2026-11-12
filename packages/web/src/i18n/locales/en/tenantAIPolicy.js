export const tenantAIPolicy = {
    title: 'AI policy',
    intro: 'AI limits that apply to every member of this tenant. Members can only configure within these caps; daily consumption budgets are managed separately by the platform.',
    defaultNotice: 'This tenant has no policy yet. Defaults apply: own keys (BYOK) allowed, no caps.',
    allowByok: 'Allow members to store their own API key (BYOK)',
    maxTokensPerDay: 'Member config token ceiling per day (0 = unlimited)',
    maxCostPerDay: 'Member config cost ceiling per day (blank = unlimited)',
    allowedProviders: 'Allowed providers (comma separated, blank = all)',
    allowedModels: 'Allowed models (comma separated, blank = all)',
    version: 'Version: v{version}',
    saved: 'Tenant AI policy saved.',
    saveError: 'Could not save the AI policy.',
  };
