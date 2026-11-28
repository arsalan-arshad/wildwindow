# WildWindow mobile (Expo)

Expo Router app for iOS and Android (`studio.arsalandev.wildwindow`). Full EAS / Firebase drop-path: **[`docs/EAS.md`](../../docs/EAS.md)**.

## Firebase native config files (do not commit)

Download from the Firebase console (Project settings → Your apps). Package / bundle ID must be `studio.arsalandev.wildwindow`.

| Platform | Firebase download          | Drop as (gitignored)                   |
| -------- | -------------------------- | -------------------------------------- |
| Android  | `google-services.json`     | `apps/mobile/google-services.json`     |
| iOS      | `GoogleService-Info.plist` | `apps/mobile/GoogleService-Info.plist` |

Copy from the committed examples if you need the shape only:

```bash
cp google-services.json.example google-services.json
cp GoogleService-Info.plist.example GoogleService-Info.plist
# then replace with the real downloads from Firebase
```

`app.config.ts` sets `android.googleServicesFile` / `ios.googleServicesFile` to those paths (or `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` when EAS injects file secrets).

## Public Firebase web config (JS SDK)

Email/password and the Firebase JS client need the **web** app config JSON string in:

```bash
EXPO_PUBLIC_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}'
```

Put it in the repo-root `.env` (gitignored) for local `expo start`, or in EAS env for builds. Not a service-account secret — still never commit a filled `.env`.

## Commands

**Default local path is Expo Go** (no custom `studio.arsalandev.wildwindow` install required):

```bash
pnpm install                        # from repo root after pull
pnpm --filter mobile start          # expo start --go (Expo Go on iOS / Android)
pnpm --filter mobile android        # Expo Go → Android emulator/device
pnpm --filter mobile ios            # Expo Go → iOS simulator/device
pnpm --filter mobile config:check   # expo config --json (no secrets required)
pnpm --filter mobile lint && pnpm --filter mobile typecheck && pnpm --filter mobile test
```

AsyncStorage is pinned to **2.2.0** (Expo Go / SDK 58). Do not upgrade to 3.x — Expo Go’s native module is v2-only and 3.x throws `Native module is null`. Preferences fall back to memory/web storage if native storage is still missing.

`expo-dev-client` stays in `package.json` for optional EAS development builds. Use it only when you already have a development client installed:

```bash
pnpm --filter mobile start:dev-client   # expo start --dev-client
```

| Works in Expo Go                                           | Needs an EAS development / preview build                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Most screens, email Firebase JS auth, area picker web stub | Native Google / Apple Sign-In                                     |
| Brand icons / splash (config)                              | Full `react-native-maps` on device (web uses a stub; see WPO-104) |

See [`docs/EAS.md`](../../docs/EAS.md) for building the optional development client.

EAS linkage (public): `owner: arsalandev`, `slug: wildwindow`, projectId `36e6ca10-4761-4338-b057-bee2208b142b`. Workflows under `.eas/workflows/`.
