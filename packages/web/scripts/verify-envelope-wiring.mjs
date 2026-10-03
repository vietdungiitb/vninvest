/**
 * Kiểm chứng **tích hợp** phần B3: `coreGet`/`corePost` có thực sự mở envelope.
 *
 * Không dùng vitest (chưa cài — `packages/web/node_modules/.bin/` **rỗng**;
 * AGENTS.md cấm tự chạy `npm install`). File này stub `globalThis.fetch` rồi
 * gọi hàm thật qua `createCoreTransport`, nên kiểm **đường đi thật**, không chỉ
 * hàm thuần.
 *
 *     node scripts/verify-envelope-wiring.mjs
 */
import assert from "node:assert/strict";
import { createCoreTransport } from "../src/adapters/core/transport.js";

function stubFetch(payload, { status = 200 } = {}) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: {
      get: (name) =>
        String(name).toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  });
}

const transport = createCoreTransport(
  { VNINVEST_CORE_BASE_URL: "http://test/core/v1" },
  { getToken: () => null, getRefreshToken: () => null, setTokens: () => {}, clearTokens: () => {} },
);

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message.split("\n").slice(0, 6).join(" | ")}`);
  }
}

await check("coreGet mo {data, meta}", async () => {
  stubFetch({ data: { nav: "10" }, meta: { as_of: "2026-09-30" } });
  assert.deepEqual(await transport.coreGet("/probe/x"), { nav: "10" });
});

await check("coreGet giu nguyen payload phang", async () => {
  const flat = { portfolio_id: 7, total_market_value: "0.00", nav: null };
  stubFetch(flat);
  assert.deepEqual(
    await transport.coreGet("/probe/flat"), flat,
    "payload phang bi doi — se pha 386 call site",
  );
});

await check("coreGet giu nguyen F3", async () => {
  const f3 = { status: "success", timestamp: "t", request_id: "r", data: { nav: "10" } };
  stubFetch(f3);
  assert.deepEqual(
    await transport.coreGet("/probe/f3"), f3,
    "F3 bi an — mat data + status + request_id",
  );
});

await check("coreGet giu nguyen F5 (khong mat sibling)", async () => {
  const f5 = { data: { a: 1 }, note: "giu toi" };
  stubFetch(f5);
  assert.deepEqual(
    await transport.coreGet("/probe/f5"), f5,
    "F5 bi an — mat sibling 'note'",
  );
});

await check("coreGet giu nguyen mang tran F1", async () => {
  stubFetch([{ symbol: "VCB", quantity: 100 }]);
  const out = await transport.coreGet("/probe/arr");
  assert.ok(Array.isArray(out), "mang tran bi doi thanh object");
});

await check("corePost cung mo envelope", async () => {
  stubFetch({ data: { ok: 1 }, meta: {} });
  assert.deepEqual(await transport.corePost("/probe/post", { a: 1 }), { ok: 1 });
});

await check("corePut cung mo envelope", async () => {
  stubFetch({ data: { ok: 2 }, meta: {} });
  assert.deepEqual(await transport.corePut("/probe/put", { a: 1 }), { ok: 2 });
});

await check("corePatch cung mo envelope", async () => {
  stubFetch({ data: { ok: 3 }, meta: {} });
  assert.deepEqual(await transport.corePatch("/probe/patch", { a: 1 }), { ok: 3 });
});

await check("coreGet giu null (khong thanh {})", async () => {
  stubFetch(null);
  assert.equal(
    await transport.coreGet("/probe/null"), null,
    "null bi doi thanh {} — se tao '0 gia' o FE",
  );
});

console.log(`verify-envelope-wiring: ${passed} pass, ${failures.length} fail`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
