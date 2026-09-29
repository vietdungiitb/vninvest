# CODE QUALITY CONSTITUTION - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

## 1) Quality intent

Chat luong cua cutover nay duoc dinh nghia boi do on dinh auth flow, khong phai chi boi build pass.

## 2) Coverage targets

| Subsystem | Target |
|---|---:|
| coreApiAdapter auth methods | 95% risk coverage |
| packages/web auth pages | 90% risk coverage |
| route host + redirect logic | 90% risk coverage |
| token refresh lifecycle | 95% risk coverage |

## 3) Coverage theater prevention

1. Khong chap nhan chi test render ma khong assert behavioral auth states.
2. Khong chap nhan chi test happy path login.
3. Khong chap nhan bo qua envelope field_errors mapping.

## 4) Mandatory fitness scenarios

1. Invalid credentials -> UI message dung code + detail.
2. Unverified account -> path resend verification kha dung.
3. Expired/invalid verify token -> page thong bao ro rang.
4. Token expiry giua session -> refresh success va retry request pass.
5. Refresh fail -> logout/redirect logic dung 1 lan, khong loop.
