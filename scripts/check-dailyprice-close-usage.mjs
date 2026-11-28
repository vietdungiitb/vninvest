#!/usr/bin/env node
/**
 * Mechanical gate: prevent runtime consumers from directly reading `DailyPrice.close`
 * (Phase 2 `retire-close-consumers`, Owner directive 2026-11-28).
 *
 * Background:
 *   `DailyPrice.close` stays in the DB until Phase 3 (`adj_close` backfill) and
 *   Phase 4 (`raw_close` + DROP `close`). Any non-test, non-migration backend
 *   module outside the explicit Phase-2-3 allowlist must read prices through
 *   `effective_close` / `effective_ohlc` (`market_data.pricing`), never directly
 *   from `DailyPrice.close` or `.values(... 'close' ...)`.
 *
 * Usage:
 *   node scripts/check-dailyprice-close-usage.mjs
 *   node scripts/check-dailyprice-close-usage.mjs --self-test
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SRC_ROOT = join(REPO, "packages", "core", "backend", "src");

/**
 * Group B allowlist: files explicitly permitted to reference `DailyPrice.close`
 * until Phase 4 (`raw_close` migration & DROP `close`).
 */
const FULL_FILE_ALLOWLIST = new Set([
  "market_data/models.py",
  "market_data/admin.py",
  "market_data/serializers.py",
  "market_data/pricing.py",
  "market_data/cafef/integrity.py",
  "market_data/cafef/diff.py",
  "market_data/cafef/fallback.py",
  "market_data/cafef/persist.py",
  "market_data/cafef/rebase.py",
  "market_data/corporate_actions/adjustment.py",
  "market_data/management/commands/anchor_a_relabel.py",
  "market_data/management/commands/price_migration_diff.py",
  "market_data/management/commands/price_migration_persist.py",
  "data_ingest/tasks.py",
]);

/**
 * Partial per-function allowlist for large view files: ONLY the named functions
 * (which emit the legacy JSON `close` payload key or the pinned R3 NAV branch)
 * are allowed to touch `DailyPrice.close`; every other function in those files
 * is scanned strictly.
 */
const FUNCTION_ALLOWLIST = new Map([
  [
    "market_data/stock_mgmt_native_views.py",
    new Set([
      "_aggregate_daily_rows",
      "_ohlcv_bar_from_daily",
    ]),
  ],
  [
    "user_workspace/portfolio_analytics_views.py",
    new Set([
      "_nav_series",
    ]),
  ],
]);

function walkPyFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "tests" || entry.name === "migrations" || entry.name === "__pycache__") {
        continue;
      }
      walkPyFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".py") && !entry.name.startsWith("test_")) {
      out.push(full);
    }
  }
  return out;
}

function stripCommentsAndTrackFunctions(source) {
  const lines = source.split(/\r?\n/);
  const result = [];
  let currentFn = null;
  let inDocstring = null;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const fnMatch = raw.match(/^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
    if (fnMatch) {
      currentFn = fnMatch[1];
    } else if (/^(?:class\s+|@|[A-Za-z_]\w*\s*=)/.test(raw)) {
      currentFn = null;
    }
    const trimmed = raw.trim();
    if (inDocstring) {
      if (trimmed.includes(inDocstring)) {
        inDocstring = null;
      }
      result.push({ lineNo: i + 1, code: "", fn: currentFn });
      continue;
    }
    for (const q of ['"""', "'''"]) {
      if (trimmed.startsWith(q)) {
        const rest = trimmed.slice(3);
        if (!rest.includes(q)) {
          inDocstring = q;
        }
        result.push({ lineNo: i + 1, code: "", fn: currentFn });
        inDocstring = inDocstring;
        break;
      }
    }
    if (result.length === i + 1) continue;
    if (trimmed.startsWith("#")) {
      result.push({ lineNo: i + 1, code: "", fn: currentFn });
      continue;
    }
    const hashIdx = raw.indexOf(" #");
    const code = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
    result.push({ lineNo: i + 1, code, fn: currentFn });
  }
  return result;
}

const DP_VAR_NAMES =
  "(?:DailyPrice|dp|p|row|prev|previous_daily|current_daily|latest_daily|latest_row|previous_row|today_db_price|yesterday_price|prev_daily)";

const ATTR_CLOSE_RE = new RegExp(`\\b${DP_VAR_NAMES}\\s*\\.close\\b(?!\\s*\\()`);
const GETATTR_CLOSE_RE = new RegExp(
  `\\bgetattr\\(\\s*${DP_VAR_NAMES}\\s*,\\s*['"]close['"]`,
);
const F_CLOSE_RE = /\bF\(\s*['"]close['"]\s*\)/;
const QUERY_CALL_RE = /\.(?:values|values_list|only)\(\s*([\s\S]*?)\)/g;
const QUOTED_CLOSE_RE = /['"]close['"]/;

export function scanPythonSource(relPosixPath, source) {
  if (FULL_FILE_ALLOWLIST.has(relPosixPath)) {
    return [];
  }
  const allowedFns = FUNCTION_ALLOWLIST.get(relPosixPath);
  const violations = [];
  const lineEntries = stripCommentsAndTrackFunctions(source);

  // 1. Line-level attribute / getattr / F('close') checks
  for (const { lineNo, code, fn } of lineEntries) {
    if (!code) continue;
    if (allowedFns && fn && allowedFns.has(fn)) continue;
    if (ATTR_CLOSE_RE.test(code) || GETATTR_CLOSE_RE.test(code) || F_CLOSE_RE.test(code)) {
      violations.push({
        file: relPosixPath,
        line: lineNo,
        fn: fn || "<module>",
        text: code.trim().slice(0, 120),
      });
    }
  }

  // 2. Multi-line .values(...) / .values_list(...) / .only(...) checks
  // Reconstruct code without comments so line numbers map cleanly.
  const strippedLines = lineEntries.map((e) => e.code);
  const joined = strippedLines.join("\n");
  for (const match of joined.matchAll(QUERY_CALL_RE)) {
    const argsText = match[1];
    if (!QUOTED_CLOSE_RE.test(argsText)) continue;
    const prefix = joined.slice(0, match.index);
    const startLine = prefix.split("\n").length;
    const entry = lineEntries[startLine - 1];
    const fn = entry ? entry.fn : null;
    if (allowedFns && fn && allowedFns.has(fn)) continue;
    // Skip obvious IntradayBar / non-DailyPrice queries if query target explicitly names IntradayBar
    const contextBefore = joined.slice(Math.max(0, match.index - 220), match.index);
    if (/\bIntradayBar\.objects\b/.test(contextBefore) && !/\bDailyPrice\.objects\b/.test(contextBefore)) {
      continue;
    }
    violations.push({
      file: relPosixPath,
      line: startLine,
      fn: fn || "<module>",
      text: match[0].replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }

  return violations;
}

function runGate() {
  if (!existsSync(SRC_ROOT)) {
    console.error(`check-dailyprice-close-usage: CHUA CHAY — khong tim thay ${SRC_ROOT}`);
    process.exit(2);
  }
  const files = walkPyFiles(SRC_ROOT);
  const allViolations = [];
  for (const fullPath of files) {
    const relPosix = relative(SRC_ROOT, fullPath).replace(/\\/g, "/");
    const src = readFileSync(fullPath, "utf8");
    allViolations.push(...scanPythonSource(relPosix, src));
  }
  if (allViolations.length > 0) {
    console.error(
      `check-dailyprice-close-usage: FAIL — phat hien ${allViolations.length} vi pham doc DailyPrice.close ngoai allowlist:`,
    );
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line} (${v.fn}) — ${v.text}`);
    }
    process.exit(1);
  }
  console.log(
    `check-dailyprice-close-usage: PASS — ${files.length} file backend da quet, 0 vi pham ngoai allowlist (${FULL_FILE_ALLOWLIST.size} full + ${FUNCTION_ALLOWLIST.size} partial allowlist)`,
  );
  process.exit(0);
}

function runSelfTest() {
  const cases = [
    {
      name: "catches direct dp.close in non-allowlisted consumer",
      file: "market_serving/native_views.py",
      src: "def build():\n    return float(dp.close)\n",
      expectViolation: true,
    },
    {
      name: "catches multiline .values('symbol', 'close')",
      file: "advisory/views.py",
      src: "def get():\n    return DailyPrice.objects.filter(symbol='TPB').values(\n        'date',\n        'close',\n    )\n",
      expectViolation: true,
    },
    {
      name: "catches unallowlisted function inside partial-allowlisted file",
      file: "market_data/stock_mgmt_native_views.py",
      src: "def _build_price_change_map():\n    return DailyPrice.objects.values('symbol', 'close')\n",
      expectViolation: true,
    },
    {
      name: "allows pinned payload function inside partial-allowlisted file",
      file: "market_data/stock_mgmt_native_views.py",
      src: "def _ohlcv_bar_from_daily(row):\n    return {'close': _to_float(row.close)}\n",
      expectViolation: false,
    },
    {
      name: "allows IntradayBar .values('close') and bar.close",
      file: "market_data/stock_mgmt_native_views.py",
      src: "def _other():\n    rows = IntradayBar.objects.filter(symbol='TPB').values('close')\n    return float(bar.close)\n",
      expectViolation: false,
    },
    {
      name: "catches F('close') expression",
      file: "user_workspace/screener_helpers.py",
      src: "def calc():\n    return DailyPrice.objects.annotate(c=F('close'))\n",
      expectViolation: true,
    },
  ];

  let failures = 0;
  for (const tc of cases) {
    const hits = scanPythonSource(tc.file, tc.src);
    const gotViolation = hits.length > 0;
    if (gotViolation !== tc.expectViolation) {
      failures += 1;
      console.error(`  FAIL  ${tc.name} (expected ${tc.expectViolation}, got ${gotViolation})`);
    } else {
      console.log(`  PASS  ${tc.name}`);
    }
  }
  if (failures > 0) {
    console.error(`check-dailyprice-close-usage --self-test: ${failures} FAIL`);
    process.exit(1);
  }
  console.log(`check-dailyprice-close-usage --self-test: PASS (${cases.length}/${cases.length} case)`);
  process.exit(0);
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  runGate();
}
