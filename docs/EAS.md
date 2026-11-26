# EAS + Firebase mobile setup (Expo)

WildWindow’s Expo app lives in [`apps/mobile`](../apps/mobile). EAS project id is committed in `app.config.ts` (`extra.eas.projectId`). Agents prepare repo config only. **Do not** run `eas build` / `eas submit` with production credentials, paste Expo tokens into git, or commit real Firebase `google-services.json` / `GoogleService-Info.plist`.

Committed config:

| Path                                                                                              | Role                                                                                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`apps/mobile/app.config.ts`](../apps/mobile/app.config.ts)                                       | Bundle/package ids, `googleServicesFile` paths, `extra.eas.projectId`, EAS Update URL |
| [`apps/mobile/eas.json`](../apps/mobile/eas.json)                                                 | Build profiles `development`, `preview`, `production` + Update channels               |
| [`apps/mobile/google-services.json.example`](../apps/mobile/google-services.json.example)         | Shape-only Android placeholder (not a real project)                                   |
| [`apps/mobile/GoogleService-Info.plist.example`](../apps/mobile/GoogleService-Info.plist.example) | Shape-only iOS placeholder (not a real project)                                       |
| [`apps/mobile/README.md`](../apps/mobile/README.md)                                               | Short drop-path + env reminder                                                        |

Icons / splash placeholders already live under `apps/mobile/assets/images/` (T9.6).

---

## Exact paths for Firebase downloads

Register **Android** and **iOS** apps in Firebase with:

| Field           | Value                          |
| --------------- | ------------------------------ |
| Android package | `studio.arsalandev.wildwindow` |
| iOS bundle ID   | `studio.arsalandev.wildwindow` |

Then download and place (filenames matter; both are **gitignored**):

| Platform | Console download             | Local path (repo)                          |
| -------- | ---------------------------- | ------------------------------------------ |
| Android  | **google-services.json**     | **`apps/mobile/google-services.json`**     |
| iOS      | **GoogleService-Info.plist** | **`apps/mobile/GoogleService-Info.plist`** |

`app.config.ts` wires:

```ts
android.googleServicesFile → process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'
ios.googleServicesFile     → process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist'
```

Paths are relative to `apps/mobile/` (the Expo project root).

### Local / `eas build --local`

1. Drop the two real files at the paths above (or `cp *.example` then overwrite with console downloads).
2. From `apps/mobile`: `npx expo config --json` should still succeed; native prebuild/EAS build needs the real files present.

### EAS cloud builds (recommended for CI)

Do **not** commit the real files. In [expo.dev](https://expo.dev) → project **wildwindow** → Environment variables, upload **file** secrets:

| EAS env var             | File                           |
| ----------------------- | ------------------------------ |
| `GOOGLE_SERVICES_JSON`  | Android `google-services.json` |
| `GOOGLE_SERVICES_PLIST` | iOS `GoogleService-Info.plist` |

Attach them to the build environments that need native Google / Firebase (development, preview, production). EAS injects a filesystem path into those env vars; `app.config.ts` reads them preferentially.

Also add repository secret **`EXPO_TOKEN`** for [`.github/workflows/eas-build.yml`](../.github/workflows/eas-build.yml) (Actions → EAS Build, or `v*` tags).

---

## `EXPO_PUBLIC_FIREBASE_CONFIG` (JS SDK / email sign-in)

The mobile app uses the **Firebase JS SDK** for email/password (T6.7). That needs the **web** app’s public config JSON string (not the native JSON/plist, not a service account):

```bash
# repo-root .env (gitignored) or EAS string env for the mobile project
EXPO_PUBLIC_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}
```

| Key                             | Kind            | Where                                   |
| ------------------------------- | --------------- | --------------------------------------- |
| `EXPO_PUBLIC_FIREBASE_CONFIG`   | Public (client) | Local `.env`, EAS env for mobile builds |
| `EXPO_PUBLIC_API_URL`           | Public          | API origin the app calls                |
| `EXPO_PUBLIC_SITE_URL`          | Public          | Web origin for share-card OG images     |
| `FIREBASE_PROJECT_ID`           | Server          | API only (Railway) — T5.8               |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Secret**      | API only — never on mobile / EAS client |

Keys match [`.env.example`](../.env.example). Restrict the web API key in the Firebase console; still never commit filled env files.

---

## What Arsalan must do (click-path)

1. **Firebase console** → create/finish project → enable **Email/Password** (and later Google / Apple providers).
2. Add **Web**, **Android**, and **iOS** apps. Android package + iOS bundle = `studio.arsalandev.wildwindow`.
3. Download **google-services.json** → save as `apps/mobile/google-services.json` (local only).
4. Download **GoogleService-Info.plist** → save as `apps/mobile/GoogleService-Info.plist` (local only).
5. Copy the **web** app config object into `EXPO_PUBLIC_FIREBASE_CONFIG` (local `.env` and/or EAS).
6. Set API `FIREBASE_PROJECT_ID` + `FIREBASE_SERVICE_ACCOUNT_JSON` on Railway (T5.8) — not in the mobile app.
7. Google Cloud OAuth clients for iOS/Android; Apple Developer + Sign in with Apple capability.
8. Upload the two native files as EAS file env vars (`GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICES_PLIST`) if using cloud builds.
9. From `apps/mobile` (Expo account logged in):

   ```bash
   eas build --profile development --platform all   # or preview
   ```

10. Install the development build, then wire/enable `@react-native-google-signin/google-signin` + `expo-apple-authentication` (still blocked on device credentials — T6.7).

**Acceptance (T9.6):** `eas build --profile preview` succeeds for iOS and Android once credentials and the google-services files (local or EAS secrets) are in place.

---

## Profiles and channels

| Profile (`eas.json`) | Distribution | Update channel | Notes                                                   |
| -------------------- | ------------ | -------------- | ------------------------------------------------------- |
| `development`        | internal     | `development`  | `developmentClient: true` — Google/Apple native sign-in |
| `preview`            | internal     | `preview`      | Internal TestFlight / Play testing                      |
| `production`         | store        | `production`   | `autoIncrement`; submit profile ready                   |

EAS Update URL in `app.config.ts`: `https://u.expo.dev/8fe1fd78-40cf-4c40-8922-a5f9084fe7d0` with `runtimeVersion.policy: 'appVersion'`.
