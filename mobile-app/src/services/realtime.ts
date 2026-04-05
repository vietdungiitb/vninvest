import { WS_BASE_URL } from './config';

const normalizeWsBase = (base: string): string => {
  const trimmed = base.trim().replace(/\/$/, '');
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }
  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}`;
  }
  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}`;
  }
  return `ws://${trimmed}`;
};

export const buildRealtimeWebSocketUrl = (accessToken: string): string => {
  const wsBase = normalizeWsBase(WS_BASE_URL);
  return `${wsBase}/ws/realtime/?token=${encodeURIComponent(accessToken)}`;
};