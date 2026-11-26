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

```bash
pnpm --filter mobile start          # Expo dev server
pnpm --filter mobile config:check   # expo config --json (no secrets required)
pnpm --filter mobile lint && pnpm --filter mobile typecheck && pnpm --filter mobile test
```

Native Google / Apple Sign-In needs an EAS development build (see `docs/EAS.md`).
