# Phase 1.1 — setup commands and verification list

Run everything from the repo root (the folder `create-expo-app` made). Assumes Expo SDK 57 (see STATE.md). Commands work in bash (Git Bash, macOS, Linux) and PowerShell unless marked.

## 1. Remove the template's sample code

Keep `assets/`, `package.json`, `.gitignore` and your `.git` folder. Before deleting, open the old `app.json` and note the `icon`, `adaptiveIcon` and splash-screen lines: copy them into the new `app.json`.

bash:
```
rm -rf app app-example components constants hooks scripts src
```
PowerShell:
```
Remove-Item -Recurse -Force app, app-example, components, constants, hooks, scripts, src -ErrorAction SilentlyContinue
```
(The new template may put its app in `src/`. Delete it, or Expo Router may pick `src/app` over the root `app/`.)

## 2. Install runtime dependencies (not dev)

```
npx expo install expo-router expo-linking expo-constants expo-status-bar expo-splash-screen react-native-safe-area-context react-native-screens expo-dev-client expo-sqlite expo-camera expo-image-manipulator expo-speech expo-notifications expo-font @expo-google-fonts/inter @expo-google-fonts/noto-sans-devanagari @expo/vector-icons
npm install zustand
```

## 3. Optional: install now so you build the native app only once (needs your approval)

These are needed by later prompts. Native modules added later force a new development build.

```
npx expo install expo-crypto expo-haptics expo-network expo-audio expo-file-system @react-native-async-storage/async-storage react-native-url-polyfill
npm install @supabase/supabase-js
```

Not installed here on purpose: `@react-native-ml-kit/text-recognition` (Prompt 7.2 checks compatibility first).

## 4. Install dev dependencies

```
npx expo install typescript @types/react jest-expo jest @types/jest -- --save-dev
npm install --save-dev prettier eslint eslint-config-expo
```

## 5. Copy in the Phase 1.1 files, then merge package.json scripts

Replace your `scripts` section in `package.json` with this, and set `"main": "expo-router/entry"`. Delete any `"jest"` key the template added (Jest is configured in `jest.config.js`).

```json
"scripts": {
  "start": "expo start --dev-client",
  "android": "expo run:android",
  "test": "jest",
  "typecheck": "tsc --noEmit",
  "lint": "expo lint",
  "doctor": "npx expo-doctor",
  "check-secrets": "bash tools/check-secrets.sh"
}
```

On Windows, `check-secrets` needs `bash` on your PATH (Git Bash provides it).

## 6. Acceptance checks

```
npx expo-doctor
npm run typecheck
npm test
npm run lint
adb devices
npx expo run:android
```

`expo-doctor` must report no issues; typecheck and tests must pass; the build must install on your phone and show "Dawai Saathi / Skeleton is running."

## Things I must verify against the docs for my SDK

I am not certain every item below exists in SDK 57.x exactly as written. Check each on docs.expo.dev for your version.

1. **expo-sqlite config plugin options** `enableFTS` and `useSQLCipher` (names and defaults).
2. **expo-camera config plugin options** `cameraPermission` and `recordAudioAndroid`, and whether the plugin adds the microphone permission by default.
3. **expo-notifications config plugin**: that it works with no options, and whether it adds `POST_NOTIFICATIONS` itself.
4. **expo-font config plugin**: that it accepts being listed with no options.
5. **`android.blockedPermissions` and `android.permissions`** keys in `app.json`. RECORD_AUDIO is blocked now; remove that line in Prompt 8.2 (voice questions).
6. **`newArchEnabled`**: I left it out; confirm the new architecture is on by default in SDK 57 and the key is not required.
7. **`experiments.typedRoutes`** still the right key for Expo Router in SDK 57.
8. **The template's folder layout** (root `app/` vs `src/app`), and what Expo Router does if both exist.
9. **ESLint**: that `eslint-config-expo/flat` and `defineConfig` from `eslint/config` are valid for your ESLint version, and that the `@typescript-eslint/no-explicit-any` rule name is registered by that config. I delivered `eslint.config.js` instead of `.eslintrc` because the flat format is what current Expo docs use.
10. **`npx expo install <pkg> -- --save-dev`** passes the flag through to npm.
11. **Metro**: that adding `db` to `assetExts` is all `expo-sqlite` needs to bundle a database asset (Prompt 1.2 uses `require()` on it).
12. **`process.env` typing** compiles under `tsc` (it may need `@types/node`), and that `EXPO_PUBLIC_` values are inlined only for literal names such as `process.env.EXPO_PUBLIC_SUPABASE_URL` (which `env.ts` uses).
13. **jest-expo preset** and the Jest version it expects; whether `moduleNameMapper` is still needed for `@/`.
14. **`expo-doctor` warnings** about the ignored `android/` folder or `app.json` fields once you prebuild.
15. **`react-native-screens` and `react-native-safe-area-context`** peer versions for your Expo Router version.
16. **expo-dev-client**: that it needs no config plugin entry for a development build.
17. **Your real SDK version**: the pack expects `expo` 57.0.17 or later. Record it in STATE.md.
