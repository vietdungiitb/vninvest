import assert from 'node:assert/strict';
import {
  API_BASE_URL,
  API_PREFIX,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  WS_BASE_URL,
  createMobileRuntimeConfig,
  normalizeBaseUrl,
} from '../src/index.js';

assert.equal(normalizeBaseUrl('https://api.example.com/', 'fallback'), 'https://api.example.com');
assert.equal(normalizeBaseUrl('   ', 'fallback'), 'fallback');

const defaultConfig = createMobileRuntimeConfig({});
assert.equal(defaultConfig.API_BASE_URL, 'http://127.0.0.1:8000');
assert.equal(defaultConfig.API_PREFIX, 'http://127.0.0.1:8000/api');
assert.equal(defaultConfig.WS_BASE_URL, 'ws://127.0.0.1:8000');
assert.equal(defaultConfig.DEMO_USERNAME, '');
assert.equal(defaultConfig.DEMO_PASSWORD, '');

const envConfig = createMobileRuntimeConfig({
  EXPO_PUBLIC_API_BASE_URL: 'https://api.vninvest.local/',
  EXPO_PUBLIC_WS_BASE_URL: 'wss://ws.vninvest.local/',
  EXPO_PUBLIC_DEMO_USERNAME: '  demo-user  ',
  EXPO_PUBLIC_DEMO_PASSWORD: '  demo-pass  ',
});

assert.equal(envConfig.API_BASE_URL, 'https://api.vninvest.local');
assert.equal(envConfig.API_PREFIX, 'https://api.vninvest.local/api');
assert.equal(envConfig.WS_BASE_URL, 'wss://ws.vninvest.local');
assert.equal(envConfig.DEMO_USERNAME, 'demo-user');
assert.equal(envConfig.DEMO_PASSWORD, 'demo-pass');

assert.equal(API_BASE_URL, defaultConfig.API_BASE_URL);
assert.equal(API_PREFIX, defaultConfig.API_PREFIX);
assert.equal(WS_BASE_URL, defaultConfig.WS_BASE_URL);
assert.equal(DEMO_USERNAME, defaultConfig.DEMO_USERNAME);
assert.equal(DEMO_PASSWORD, defaultConfig.DEMO_PASSWORD);

console.log('mobile package config smoke passed.');