# W0 test — red

Command: `node node_modules/vitest/vitest.mjs run src/components/soc/__tests__/token-ssot.component.test.ts` (cwd packages/web)

EXIT=1

```

 RUN  v4.1.9 D:/Mujoco Projects/uiux-ssot-w0/packages/web

 ❯ src/components/soc/__tests__/token-ssot.component.test.ts (5 tests | 3 failed) 20ms
     × soc.tokens.css base block không khai lại 13 tên dùng chung 10ms
     × O-24: --text-on-accent light = #0f172a; --accent-cyan KHÔNG override light 3ms
     × R3: soc.tokens.css light block cũng không còn --accent-cyan/--text-muted 1ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)
   Start at  12:58:38
   Duration  4.76s (transform 73ms, setup 0ms, import 110ms, tests 20ms, environment 4.15s)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/soc/__tests__/token-ssot.component.test.ts > SOC/theme token SSOT (W0) > soc.tokens.css base block không khai lại 13 tên dùng chung
AssertionError: --text-primary phải có 1 owner duy nhất: expected [ '--text-primary:', index: 23, …(2) ] to be null

- Expected:
null

+ Received:
[
  "--text-primary:",
]

 ❯ src/components/soc/__tests__/token-ssot.component.test.ts:44:83
     42|   it("soc.tokens.css base block không khai lại 13 tên dùng chung", () …
     43|     for (const name of BASE_TOKENS) {
     44|       expect(soc.base.match(declareRe(name)), `${name} phải có 1 owner…
       |                                                                                   ^
     45|     }
     46|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/components/soc/__tests__/token-ssot.component.test.ts > SOC/theme token SSOT (W0) > O-24: --text-on-accent light = #0f172a; --accent-cyan KHÔNG override light
AssertionError: expected ':root[data-theme="light"] {\r\n  --te…' to match /--text-on-accent:\s*#0f172a/

- Expected:
/--text-on-accent:\s*#0f172a/

+ Received:
":root[data-theme=\"light\"] {
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --accent-blue: #2563eb;
  --bg-panel: #ffffff;
  --bg-panel-soft: #f8fafc;
  --border-default: #e2e8f0;
  --shadow-panel: var(--shadow-lg, 0 10px 15px rgb(15 23 42 / 0.1));
  --accent-purple: #7e22ce;
  --accent-shell: #0e7490;
  --accent-shell-soft: rgba(0, 144, 196, 0.12);
  --accent-signal-soft: rgba(255, 127, 80, 0.15);
  --border-shell: rgba(15, 23, 42, 0.08);
  --bg-shell-surface: rgba(255, 255, 255, 0.7);
  --shadow-shell: 0 20px 40px rgba(15, 23, 42, 0.12);
  --shadow-card: 0 2px 8px rgba(15, 23, 42, 0.08);
  --shadow-pop: 0 8px 24px rgba(15, 23, 42, 0.12);
}
"

 ❯ src/components/soc/__tests__/token-ssot.component.test.ts:55:25
     53|
     54|   it("O-24: --text-on-accent light = #0f172a; --accent-cyan KHÔNG over…
     55|     expect(theme.light).toMatch(/--text-on-accent:\s*#0f172a/);
       |                         ^
     56|     for (const f of ["--accent-cyan", "--text-muted"]) {
     57|       expect(theme.light, `${f} không được khai ở light block`).not.to…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/components/soc/__tests__/token-ssot.component.test.ts > SOC/theme token SSOT (W0) > R3: soc.tokens.css light block cũng không còn --accent-cyan/--text-muted
AssertionError: --accent-cyan phải đã dời/xoá khỏi SOC light: expected ':root[data-theme="light"] {\r\n  --te…' not to match /(?<![-\w])--accent-cyan\s*:/

- Expected:
/(?<![-\w])--accent-cyan\s*:/

+ Received:
":root[data-theme=\"light\"] {
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-muted: #475569;
  --border-default: rgba(15, 23, 42, 0.12);
  --border-strong: rgba(15, 23, 42, 0.2);
  --bg-panel: #ffffff;
  --bg-panel-solid: #ffffff;
  --bg-panel-soft: #f8fafc;
  --bg-input: #f1f5f9;
  --accent-cyan: #0e7490;
  --accent-purple: #7e22ce;
  --accent-purple-rgb: 126 34 206;
  --shadow-card: 0 2px 8px rgba(15, 23, 42, 0.08);
  --shadow-pop: 0 8px 24px rgba(15, 23, 42, 0.12);

  
  --pf-surface: #ffffff;
  --pf-gain: #047857;
  --pf-loss: #b91c1c;
  --pf-flat: #475569;
  --pf-accent: #0e7490;
  --pf-positive-soft: #d1fae5;
  --pf-negative-soft: #fee2e2;
  --pf-positive-text: #065f46;
  --pf-negative-text: #991b1b;
  --pf-chart-1: #0e7490;
  --pf-chart-2: #047857;
  --pf-chart-3: #b45309;
  --pf-chart-4: #7e22ce;
  --pf-chart-5: #be185d;
  
  --soc-rgb-081734: 248 250 252;
  --soc-rgb-0f172a: 241 245 249;
  --soc-rgb-020b23: 255 255 255;
  --soc-c-0b1528: #f1f5f9;
  
  --soc-c-f1f5f9: #0f172a;
  --soc-c-ffffff: #0f172a;
  --soc-c-cbd5e1: #475569;
  
  --soc-c-22d3ee: #0e7490;
  --soc-rgb-22d3ee: 14 116 144;
  --soc-rgb-00b4d8: 0 144 196;
  --soc-c-00b4d8: #0090c4;
  --soc-c-06b6d4: #0e7490;
  --soc-c-48cae4: #0e7490;
  --soc-c-67e8f9: #0e7490;
  
  --soc-c-94a3b8: #475569;
  --soc-c-6ee7b7: #047857;
  --soc-c-f87171: #b91c1c;
  --soc-c-34d399: #047857;
  --soc-rgb-34d399: 4 120 87;
  --soc-c-10b981: #047857;
  --soc-rgb-10b981: 4 120 87;
  --soc-c-fbbf24: #b45309;
  --soc-rgb-fbbf24: 180 83 9;
  --soc-c-f59e0b: #b45309;
  --soc-rgb-f59e0b: 180 83 9;
  --soc-rgb-d97706: 180 83 9;
  --soc-c-f87171: #dc2626;
  --soc-rgb-ef4444: 220 38 38;
  --soc-c-ef4444: #dc2626;
  --soc-rgb-f97316: 234 88 12;
  --soc-rgb-2dd4bf: 13 148 136;
  --soc-c-5eead4: #0f766e;
  --soc-rgb-ffbf4d: 217 119 6;
  --soc-c-60a5fa: #2563eb;
  --soc-rgb-1e293b: 226 232 240;
}
"

 ❯ src/components/soc/__tests__/token-ssot.component.test.ts:63:68
     61|   it("R3: soc.tokens.css light block cũng không còn --accent-cyan/--te…
     62|     for (const f of FORBIDDEN_LIGHT) {
     63|       expect(soc.light, `${f} phải đã dời/xoá khỏi SOC light`).not.toM…
       |                                                                    ^
     64|     }
     65|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯


```
