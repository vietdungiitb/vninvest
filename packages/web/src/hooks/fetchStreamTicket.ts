import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

/**
 * C-01: lay ticket SSE/WS single-use 60s (BE: POST /core/v1/auth/ws-ticket/).
 * Tra ticket string, hoac null khi that bai — caller PHẢI fail-closed
 * (không tạo EventSource/WebSocket, không fallback về PAT trong URL).
 */
export async function fetchStreamTicket(): Promise<string | null> {
  try {
    const data = await coreApiAdapter.corePost("/auth/ws-ticket/", {});
    return typeof data?.ticket === "string" && data.ticket ? data.ticket : null;
  } catch {
    return null;
  }
}
