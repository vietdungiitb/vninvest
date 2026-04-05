# VNInvest Mobile App

Sprint 19 mobile foundation using Expo + TypeScript.

Current status:
- Auth flow implemented (login/register/session restore/logout).
- JWT stored with Expo SecureStore.
- Axios interceptor auto-refreshes access token via refresh token.

## Run

1. Install dependencies
2. Start Expo
3. Open Android emulator or iOS simulator

Commands:
- npm start
- npm run android
- npm run ios
- npm run typecheck
- npm run build:android:preview
- npm run build:ios:simulator

## Environment

Copy .env.example to .env and adjust endpoints:
- EXPO_PUBLIC_API_BASE_URL
- EXPO_PUBLIC_WS_BASE_URL
- EXPO_PUBLIC_DEMO_USERNAME (optional)
- EXPO_PUBLIC_DEMO_PASSWORD (optional)

Local backend notes:
- iOS simulator can use `http://127.0.0.1:8000`.
- Android emulator should use `http://10.0.2.2:8000`.

## Internal release

- EAS config is committed in `eas.json` for Sprint 19 internal builds.
- Before first cloud build, replace `expo.extra.eas.projectId` in `app.json` with the real EAS project id.
- Android package id is still `com.anonymous.mobileapp` in the current native project; rename it before public store release.

## Structure

- src/app
- src/screens
- src/components
- src/services
- src/store
- src/hooks
- src/utils
- src/theme

## Auth API endpoints used

- POST /api/auth/token/
- POST /api/auth/token/refresh/
- GET /api/auth/me/
- POST /api/auth/register/
