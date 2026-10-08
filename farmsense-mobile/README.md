# FarmSense Mobile

The Android/iOS client for FarmSense, built with Expo Router. It talks to the same `backend/` Express API as `farmsense-frontend/`, plus an on-device offline queue for check-ins, irrigation/fertilizer logs and disease photos taken with no signal in the field.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and point `EXPO_PUBLIC_API_URL` at your backend:

- Simulator/emulator on the same machine as the backend: `http://localhost:5050/api` (Android emulator: `http://10.0.2.2:5050/api`).
- A physical phone: your machine's LAN IP, e.g. `http://192.168.1.50:5050/api`. The phone and the backend must be on the same network.

### Google Maps (Android)

`react-native-maps` needs a Google Maps API key on Android (iOS uses Apple Maps by default, no key needed). In `app.json`, replace:

```
android.config.googleMaps.apiKey: "REPLACE_WITH_GOOGLE_MAPS_ANDROID_API_KEY"
```

with a key from the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis) (enable the "Maps SDK for Android"). Without it, the field map screen renders blank on Android.

## Running

```bash
npx expo start
```

Camera, SQLite and secure-store are native modules, so **Expo Go is not enough** — scan the QR code into a [development build](https://docs.expo.dev/develop/development-builds/introduction/) instead (`npx expo run:android` / `npx expo run:ios` locally, or `eas build --profile development`).

`npx expo start --web` also works, for quickly checking screen layout — it's a dev convenience only, not a shipping target, and skips native-only features (camera, offline outbox, maps).

## Building for testers (EAS)

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure   # links this project to your Expo account, sets the EAS project id
npx eas-cli@latest build --profile preview --platform android   # installable APK
npx eas-cli@latest build --profile preview --platform ios       # ad-hoc IPA (needs registered test devices)
```

The `preview` profile (see `eas.json`) is internal distribution — EAS gives you a link to install directly on a device, no app store review.

## Architecture

- `src/app/` — Expo Router screens. `(auth)` (login/register) and `(app)` (tab shell: dashboard, fields) are gated by `Stack.Protected` on the Zustand auth store; `crops/[cropId]/...` is a separate top-level stack (escapes the tab bar) for crop detail, irrigation/fertilizer logs, disease diagnosis and chat.
- `src/features/*` — one folder per domain (fields, crops, irrigation, fertilizer, checkin, disease, recommendations, region, chat), each with a `.service.ts` (API calls) and `.types.ts`, mirroring `farmsense-frontend/src/features/`.
- `src/lib/api.ts` — axios client with the same single-flight refresh-on-401 interceptor as the web app.
- `src/lib/outbox.ts` (native) / `outbox.web.ts` (web dev-preview) — the offline write queue. Every irrigation/fertilizer entry and disease photo goes through `enqueueOutboxItem`, is stamped with a `client_request_id`, and is flushed on reconnect (`useOutboxFlush`, wired in the root layout). The matching backend endpoints dedupe on that id (see `backend/supabase/migrations/20260922000000_offline_idempotency_keys.sql`), so a retry after a dropped response can't create a duplicate entry.
- `src/store/authStore.ts` — session persisted to `expo-secure-store` (AsyncStorage fallback on web only, since SecureStore has no web implementation).
