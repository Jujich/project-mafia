# Delovaya Mafia — Game Host Dashboard

[English](README.md) | [Русский](README.ru.md)

A web and Android tool for hosting in-person Mafia games with custom club rules. It guides the host through setup, role assignment, night actions, discussion, voting and game completion. The Android app keeps games on the device and can run without an internet connection.

## What it does

- A five-step game setup flow with role assignment and validation.
- Guided night and day phases, including interactions between special roles, healing and immunity.
- A discussion timer that recovers after the app returns from the background.
- Local Android game storage and a retry queue for synchronization.
- Revision-based, transactional import of game snapshots into PostgreSQL.
- A web login for the host and a REST API documented with Swagger.

This is a host's tool for an in-person game. Synchronization sends Android games to the server; it does not merge concurrent edits or restore server history onto a new device. The shared mobile token is an access barrier, not per-user authentication.

## Architecture

| Directory | Responsibility | Stack |
| --- | --- | --- |
| [`frontend/`](frontend) | Web dashboard, Nitro API proxy and offline Android client | Nuxt 3, Vue 3, TypeScript, NuxtUI, Capacitor 8 |
| [`backend/`](backend) | Game rules, REST API, snapshot validation and persistence | NestJS, Prisma, PostgreSQL |

Browser requests pass through the authenticated Nitro proxy. The Android build runs a local game engine and sends snapshots through a separate token-protected Nitro endpoint. The backend accepts newer revisions in a single transaction; repeated submissions do not duplicate a game.

Implementation entry points:

- [Night resolution](backend/src/nights/night-resolution.ts) and [night action order](backend/src/nights/night-steps.ts).
- [Offline game engine](frontend/utils/offline-game-engine.ts) and [synchronization queue](frontend/utils/offline-sync-runner.ts).
- [Snapshot validation](backend/src/sync/sync-snapshot.ts) and [transactional import](backend/src/sync/sync.service.ts).

## Run locally

Requirements: Node.js 22 or newer, npm and a running local PostgreSQL instance (PostgreSQL 16 was used for the project). The two components have separate dependencies.

### 1. Prepare PostgreSQL and environment files

Using a PostgreSQL administrator account, create a local role and database:

```sh
createuser --pwprompt mafia
createdb --owner=mafia mafia
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `backend/.env` → `DATABASE_URL` to match that database and password, with `PORT=3000`. Set `frontend/.env` → `ADMIN_LOGIN` and `ADMIN_PASSWORD` to your local login credentials, and keep `NUXT_BACKEND_API_URL=http://localhost:3000`. Replace the example values before use. The `.env` files are ignored by Git.

For mobile synchronization, use the same separate random value for backend `MOBILE_SYNC_TOKEN`, frontend `NUXT_MOBILE_SYNC_TOKEN` and the Android build's `NUXT_PUBLIC_MOBILE_SYNC_TOKEN`. A web-only local setup does not require an Android build.

### 2. Start the backend

In one terminal, from the repository root:

```sh
cd backend
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

`prisma:deploy` applies the checked-in database migrations; it does not publish the application. The API listens on port `3000`, with Swagger at `http://localhost:3000/api/docs`.

### 3. Start the frontend

In another terminal, from the repository root:

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 3001
```

Open `http://localhost:3001` and sign in with the credentials from `frontend/.env`. The explicit frontend port avoids a conflict with the backend. The web login is enforced by Nitro, so keep direct backend access within your development environment.

## Android

The native build uses Node.js 22+, JDK 21 and Android SDK 36; the app targets Android 7.0 and newer. After installing frontend dependencies, `npm run android:apk` builds a debug APK from `frontend/`. Offline play is local; synchronization requires your own reachable HTTPS Nuxt endpoint and matching mobile tokens.

See the [frontend guide](frontend/README.md) for Android build and signing commands, local storage and synchronization behavior. The [backend guide](backend/README.md) documents the API and migrations. Compiled APKs and signing keys are not included in this repository.

## Development checks

From `frontend/`: `npm test`, `npm run typecheck`, `npm run build`.

From `backend/`: `npm test`, `npm run lint`, `npm run build`.

## Repository scope

This portfolio repository combines the frontend and backend with their source history. Server deployment configuration is maintained separately and is excluded from this GitHub copy. Application source, database migrations and Android build files are included.
