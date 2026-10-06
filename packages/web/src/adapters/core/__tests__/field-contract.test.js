/**
 * Every field a page sends must exist as a writable field on the backend
 * serializer that receives it.
 *
 * Why this test exists
 * -------------------
 * `route-contract.test.js` only compares PATHS. Two of the three contract bugs
 * this repository carries were correct paths with wrong field names:
 *
 *   - `TransactionsPage.tsx` sent `side` / `trade_date`; the backend serializer
 *     (`TransactionSerializer.Meta.fields`) reads `transaction_type` / `date`.
 *     The POST therefore answered 400 on every attempt, and no gate noticed,
 *     because the route existed.
 *   - `PortfoliosPage.tsx` sent `currency`; `PortfolioSerializer.Meta.fields`
 *     does not declare it, so DRF dropped it silently and the form did nothing.
 *
 * The backend field list is parsed from `serializers.py` at run time rather than
 * hardcoded here: a hand-kept copy is a second source of truth that drifts, and a
 * drifted copy makes this test agree with a broken backend (the same failure
 * mode `route-contract.test.js` documents for the path manifest).
 *
 * Regenerating is therefore unnecessary — this test follows the source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// __tests__ -> core -> adapters -> src -> web -> packages -> repo root
const REPO = path.resolve(HERE, "..", "..", "..", "..", "..", "..");
const SERIALIZERS_PY = path.join(
  REPO,
  "packages",
  "core",
  "backend",
  "src",
  "user_workspace",
  "serializers.py",
);
const WEB_SRC = path.join(REPO, "packages", "web", "src");

/**
 * `fields = [...]` and `read_only_fields = [...]` per serializer class.
 *
 * Parsed textually on purpose: this suite is plain Node and must not need a
 * Python/Django runtime. The grammar it accepts is narrow and fails loudly on
 * anything unexpected rather than returning an empty set, which is the failure
 * mode that would make the assertions below vacuous.
 */
function parseSerializerFields(source) {
  const result = {};
  const classRe = /^class\s+(\w+Serializer)\s*\(/gm;
  const names = [];
  let match;
  while ((match = classRe.exec(source)) !== null) names.push(match[1]);

  for (const name of names) {
    const start = source.search(new RegExp(`^class\\s+${name}\\s*\\(`, "m"));
    if (start < 0) continue;
    const rest = source.slice(start + 1);
    const nextClass = rest.search(/^class\s+\w+Serializer\s*\(/m);
    const body = nextClass < 0 ? rest : rest.slice(0, nextClass);

    const fieldsAt = /fields\s*=\s*\[([^\]]*)\]/.exec(body);
    const readOnlyAt = /read_only_fields\s*=\s*\[([^\]]*)\]/.exec(body);
    if (!fieldsAt) continue;

    const all = [...fieldsAt[1].matchAll(/['"]([\w.]+)['"]/g)].map((m) => m[1]);
    const readOnly = readOnlyAt
      ? [...readOnlyAt[1].matchAll(/['"]([\w.]+)['"]/g)].map((m) => m[1])
      : [];
    result[name] = { writable: all.filter((f) => !readOnly.includes(f)), all };
  }
  return result;
}

/**
 * `createTransaction(` / `updatePortfolio(` call sites and the object literal
 * keys passed as the final argument.
 *
 * A spread (`...form`) cannot be resolved statically, so those call sites are
 * skipped rather than guessed at — `TransactionsPage` is written to send an
 * explicit literal precisely so this check can see every field it sends.
 */
function collectPageWriteCalls() {
  const targets = {
    createTransaction: "TransactionSerializer",
    updateTransaction: "TransactionSerializer",
    createPortfolio: "PortfolioSerializer",
    updatePortfolio: "PortfolioSerializer",
  };

  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "__tests__") continue;
        walk(full);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const [fn, serializer] of Object.entries(targets)) {
        const re = new RegExp(`${fn}\\s*\\(([\\s\\S]{0,600}?)\\)\\s*;`, "g");
        let m;
        while ((m = re.exec(text)) !== null) {
          const args = m[1];
          const line = text.slice(0, m.index).split("\n").length;
          const hasSpread = /\.\.\./.test(args);
          const keys = [
            ...new Set(
              [...args.matchAll(/[{,]\s*([A-Za-z_]\w*)\s*[:,}]/g)].map((k) => k[1]),
            ),
          ].filter((k) => k !== "return");
          hits.push({
            file: path.relative(REPO, full).replace(/\\/g, "/"),
            line,
            fn,
            serializer,
            keys,
            hasSpread,
          });
        }
      }
    }
  };
  walk(WEB_SRC);
  return hits;
}

describe("core adapter field contract", () => {
  const source = fs.readFileSync(SERIALIZERS_PY, "utf8");
  const serializers = parseSerializerFields(source);
  const calls = collectPageWriteCalls();

  it("parsed the backend serializers (guards a vacuous pass)", () => {
    expect(Object.keys(serializers).length).toBeGreaterThanOrEqual(5);
    expect(serializers.TransactionSerializer.writable).toContain("transaction_type");
    expect(serializers.TransactionSerializer.writable).toContain("date");
    expect(serializers.TransactionSerializer.writable).not.toContain("side");
    expect(serializers.PortfolioSerializer.writable).not.toContain("currency");
  });

  it("scanned page write calls (guards a silently empty scan)", () => {
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls.filter((c) => c.fn === "createTransaction").length).toBeGreaterThanOrEqual(1);
    expect(calls.some((c) => c.fn === "createTransaction" && c.keys.length > 0)).toBe(true);
  });

  it("every field a page sends is writable on the backend serializer", () => {
    const offenders = [];
    for (const call of calls) {
      const allowed = serializers[call.serializer]?.writable ?? [];
      for (const key of call.keys) {
        if (!allowed.includes(key)) {
          offenders.push(
            `${call.file}:${call.line} ${call.fn} -> ${call.serializer} field "${key}" ` +
              `khong ton tai. Cho phep: ${allowed.join(", ")}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("portfolio write pages send explicit literals, not a spread", () => {
    // A `...form` spread is exactly what let `side`/`trade_date` hide from
    // review. Portfolio writes must be literal so the check above can see them.
    const spreads = calls
      .filter((c) => (c.fn === "createPortfolio" || c.fn === "createTransaction") && c.hasSpread)
      .map((c) => `${c.file}:${c.line} ${c.fn}`);
    expect(spreads).toEqual([]);
  });
});