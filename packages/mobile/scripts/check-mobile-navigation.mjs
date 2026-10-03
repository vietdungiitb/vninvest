import assert from 'node:assert/strict';
import {
  DEFAULT_ACTIVE_TAB,
  MOBILE_TAB_DEFS,
  MOBILE_TAB_KEYS,
  findMobileTabDefinition,
  isMobileTabKey,
} from '../src/index.js';

assert.equal(DEFAULT_ACTIVE_TAB, 'dashboard');
assert.deepEqual(MOBILE_TAB_KEYS, ['dashboard', 'transactions', 'watchlist', 'whale', 'profile']);
assert.ok(isMobileTabKey('dashboard'));
assert.ok(isMobileTabKey('profile'));
assert.ok(!isMobileTabKey('settings'));
assert.equal(findMobileTabDefinition('transactions')?.icon, '⇄');
assert.equal(MOBILE_TAB_DEFS[0].labelKey, 'tabs.dashboard');

console.log('mobile navigation smoke passed.');