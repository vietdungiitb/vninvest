/**
 * Kiểm chứng `envelope.js` bằng Node trần — **không** dùng vitest.
 *
 * Vì sao cần file này: `packages/web/node_modules/.bin/` **rỗng** ⇒ `vitest`
 * chưa được cài (`npm install` chưa chạy). AGENTS.md cấm tự chạy
 * `npm install`. Nên `envelope.test.js` **đã commit nhưng CHƯA CHẠY**.
 *
 * File này cho cùng một bộ khẳng định, chạy được ngay bằng `node`:
 *     node scripts/verify-envelope.mjs
 *
 * Khi `npm install` đã chạy, ưu tiên `npx vitest run src/adapters/core/envelope.test.js`
 * và xoá file này.
 */
import assert from "node:assert/strict";
import { isEnvelope, unwrapEnvelope } from "../src/adapters/core/envelope.js";

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

// --- isEnvelope -------------------------------------------------------------
check("nhan dien {data, meta}", () => {
  assert.equal(isEnvelope({ data: { a: 1 }, meta: {} }), true);
});
check("F3 {status, request_id, data} => false", () => {
  assert.equal(isEnvelope({ status: "success", timestamp: "t", request_id: "r", data: { a: 1 } }), false);
});
check("F5 {data, +siblings} => false", () => {
  assert.equal(isEnvelope({ data: { a: 1 }, note: "x" }), false);
});
check("payload phang => false", () => {
  assert.equal(isEnvelope({ total_market_value: "0.00" }), false);
});
check("null/mang/so/chuoi => false", () => {
  assert.equal(isEnvelope(null), false);
  assert.equal(isEnvelope(undefined), false);
  assert.equal(isEnvelope([1, 2]), false);
  assert.equal(isEnvelope(0), false);
  assert.equal(isEnvelope(""), false);
});

// --- unwrapEnvelope ---------------------------------------------------------
check("mo {data, meta}", () => {
  assert.deepEqual(unwrapEnvelope({ data: { nav: "10" }, meta: { as_of: "x" } }), { nav: "10" });
});
check("GIU NGUYEN F3", () => {
  const f3 = { status: "success", timestamp: "t", request_id: "r", data: { nav: "10" } };
  assert.equal(unwrapEnvelope(f3), f3, "F3 bi an — se nuot data cua 12 call site");
});
check("GIU NGUYEN F5 (khong lam roi sibling)", () => {
  const f5 = { data: { a: 1 }, note: "giu toi" };
  assert.equal(unwrapEnvelope(f5), f5, "F5 bi an — sibling bi mat");
});
check("GIU NGUYEN payload phang", () => {
  const flat = { portfolio_id: 1, total_market_value: "0.00", nav: null };
  assert.equal(unwrapEnvelope(flat), flat);
});
check("GIU NGUYEN mang tran F1", () => {
  const arr = [{ symbol: "VCB", quantity: 100 }];
  assert.equal(unwrapEnvelope(arr), arr);
});
check("GIU NGUYEN null (khong thanh {} hay [])", () => {
  assert.equal(unwrapEnvelope(null), null, "null -> 0 la '0 gia'");
});
check("envelope data=null van phai mo", () => {
  assert.equal(unwrapEnvelope({ data: null, meta: {} }), null);
});
check("envelope data=[] tra mang rong", () => {
  assert.deepEqual(unwrapEnvelope({ data: [], meta: {} }), []);
});
check("meta rong van la envelope", () => {
  assert.deepEqual(unwrapEnvelope({ data: { a: 1 }, meta: {} }), { a: 1 });
});

console.log(`verify-envelope: ${passed} pass, ${failures.length} fail`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
