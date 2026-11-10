# Delovaya Mafia — Frontend

[English](README.md) | [Русский](README.ru.md)

The host dashboard uses Nuxt 3, Vue 3, TypeScript and NuxtUI. Nitro provides an authenticated API proxy for the web version. Capacitor 8 packages a separate offline-first Android build with Preferences storage and network-aware synchronization.

## Local development

Use Node.js 22+ and npm. Start the [backend](../backend/README.md) first, then run these commands from `frontend/`:

```sh
cp .env.example .env
# Set ADMIN_LOGIN and ADMIN_PASSWORD in .env before starting.
npm ci
npm run dev -- --host 127.0.0.1 --port 3001
```

Open `http://localhost:3001`. Keep `NUXT_BACKEND_API_URL=http://localhost:3000`; the frontend and backend must use different ports. The full PostgreSQL setup is in the [root guide](../README.md#run-locally).

## Environment

Copy [`.env.example`](.env.example) to a local, ignored `.env` file and replace its example values.

| Variable | Purpose |
| --- | --- |
| `NUXT_BACKEND_API_URL` | Server-only backend URL used by Nitro; locally `http://localhost:3000` |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | Host credentials for the web login |
| `SESSION_PASSWORD` | Optional session sealing key, at least 32 characters; otherwise derived from the admin credentials |
| `NUXT_MOBILE_SYNC_TOKEN` | Server-only sync token; must match backend `MOBILE_SYNC_TOKEN` |
| `NUXT_PUBLIC_SYNC_API_URL` | Your reachable HTTPS Nuxt origin for Android synchronization, without `/api` |
| `NUXT_PUBLIC_MOBILE_SYNC_TOKEN` | Android build token; must match the Nitro and backend sync tokens |

The mobile token is embedded in the APK and can be extracted. It is only an endpoint access barrier; it must be separate from admin credentials and infrastructure tokens.

## Android build

Use Node.js 22+, JDK 21 and Android SDK 36, with Android Studio or the Android command-line tools configured. The app supports Android 7.0 and newer. If JDK 21 and the command-line tools were installed with Homebrew on macOS, configure their locations before running the CLI:

```sh
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="$(brew --prefix)/share/android-commandlinetools"
```

For synchronization, set `NUXT_PUBLIC_SYNC_API_URL` to your own HTTPS Nuxt origin and configure matching mobile tokens before building. The APK contains static Nuxt files and no Nitro server. Local play remains available offline.

From `frontend/` after `npm ci`:

```sh
npm run android:assets   # generate Android icons and splash screens
npm run android:sync     # generate the Nuxt SPA and sync native assets
npm run android:open     # sync and open Android Studio
npm run android:run      # sync and run on a connected device or emulator
npm run android:apk      # build a debug APK
npm run android:release  # build a signed release APK
```

The debug output is `android/app/build/outputs/apk/debug/app-debug.apk`. Release output is `android/app/build/outputs/apk/release/app-release.apk`. Compiled APKs and private signing material are not included in Git.

### Release signing

`npm run android:release` requires all four environment variables:

| Variable | Purpose |
| --- | --- |
| `ANDROID_KEYSTORE_PATH` | Absolute path to an existing release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Signing key alias |
| `ANDROID_KEY_PASSWORD` | Key password |

Provide credentials through a secure environment, not tracked files or command arguments. The release build fails if these variables are missing. Keep a protected backup of the signing key: future updates need the same key and a higher `versionCode` in `android/app/build.gradle`.

A release build signed with a different key cannot replace a debug build with the same package ID. Uninstalling the app deletes its local games. Synchronization sends game data to the server but does not restore that history onto a new installation; preserve any unsynchronized data before changing installations. Android synchronization requires HTTPS.

## Offline behavior

- Capacitor builds run as a static SPA with a local game engine.
- Games, phase actions and results are stored in Capacitor Preferences. Android cloud backup is disabled.
- Every local change increments a revision; pending snapshots are retried on startup, resume and network recovery.
- Temporary failures retry with delays from 2 to 60 seconds while the app is open. Permanent HTTP errors wait for a manual retry.
- Changes made during an upload stay queued for a subsequent upload.
- Backend import is transactional and idempotent for an already accepted revision.
- The discussion timer stores an absolute deadline and recovers after backgrounding or restart.

The app deliberately allows the first game to start offline without a network login. Synchronization is one-way and does not support concurrent editing across devices.

## Web routes and API proxy

The UI includes game history, a five-step setup wizard, game overview, guided night actions, day discussion and voting, and game completion screens under `/games`.

The [backend proxy](server/utils/backend.ts) forwards web API requests with their method, body and error status. Data routes require a web session, except for the exact `PUT /api/sync/games/:clientGameId` route, which requires `X-Mobile-Sync-Token`. The [sync proxy](server/api/sync/games/[clientGameId].put.ts) validates the mobile token and forwards the snapshot to NestJS with a 40-second timeout.

Sync preflight accepts only Capacitor origins `https://localhost` and `http://localhost`, the `PUT` method, and the `Content-Type` / `X-Mobile-Sync-Token` headers without cookies. The [Russian guide](README.ru.md) provides a more detailed route list and protocol notes.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Server deployment configuration is maintained outside this GitHub portfolio copy.
