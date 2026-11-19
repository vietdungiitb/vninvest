# W1-chrome test — red

Command: `vitest run src/components/__tests__/uiux-chrome-w1.component.test.ts`

EXIT=1

```

 RUN  v4.1.9 D:/Mujoco Projects/uiux-chrome-w1/packages/web

 ❯ src/components/__tests__/uiux-chrome-w1.component.test.ts (6 tests | 4 failed) 21ms
     × src/pages/AICommandCenterPage.tsx: phải chuyển sang shell 11ms
     × src/pages/DashboardPage.tsx: phải chuyển sang shell 2ms
     × src/pages/portfolio/PortfolioOverviewPage.tsx: phải chuyển sang shell 1ms
     × src/pages/admin/AdminUsersPage.tsx: phải chuyển sang shell 1ms

 Test Files  1 failed (1)
      Tests  4 failed | 2 passed (6)
   Start at  15:48:18
   Duration  4.16s (transform 54ms, setup 0ms, import 85ms, tests 21ms, environment 3.51s)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/__tests__/uiux-chrome-w1.component.test.ts > W1 chrome — 4 route RED + 1 regression GREEN > src/pages/AICommandCenterPage.tsx: phải chuyển sang shell
 FAIL  src/components/__tests__/uiux-chrome-w1.component.test.ts > W1 chrome — 4 route RED + 1 regression GREEN > src/pages/DashboardPage.tsx: phải chuyển sang shell
 FAIL  src/components/__tests__/uiux-chrome-w1.component.test.ts > W1 chrome — 4 route RED + 1 regression GREEN > src/pages/portfolio/PortfolioOverviewPage.tsx: phải chuyển sang shell
 FAIL  src/components/__tests__/uiux-chrome-w1.component.test.ts > W1 chrome — 4 route RED + 1 regression GREEN > src/pages/admin/AdminUsersPage.tsx: phải chuyển sang shell
AssertionError: route chưa dùng chung chrome: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/components/__tests__/uiux-chrome-w1.component.test.ts:34:90
     32|       // Trạng thái đích: MỌI route dùng chrome và không tự render <h1…
     33|       // Baseline: 4 route RED, ShellOperationsCenterPage GREEN (regre…
     34|       expect(ok, t.greenAtBaseline ? "regression hỏng" : "route chưa d…
       |                                                                                          ^
     35|     });
     36|   }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯


```
