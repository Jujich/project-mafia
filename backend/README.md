# Delovaya Mafia — Backend

[English](README.md) | [Русский](README.ru.md)

A NestJS and TypeScript REST API for the Mafia host dashboard. It stores games, players, roles, nights, days and results in PostgreSQL through Prisma. Validation uses `class-validator` / `class-transformer`; Swagger documents the API at `/api/docs`.

## Local development

Use Node.js 22+, npm and a running PostgreSQL instance. Create the local role and database using the [root setup guide](../README.md#run-locally), then run these commands from `backend/`:

```sh
cp .env.example .env
# Set DATABASE_URL in .env to match your local database and password.
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

The API listens on port `3000` by default; Swagger is at `http://localhost:3000/api/docs`. Start the frontend separately on port `3001`. Role and clan dictionaries are defined in application code and need no database seed step.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL used by Prisma |
| `PORT` | API port, default `3000` |
| `MOBILE_SYNC_TOKEN` | Token for Android snapshot import; the sync endpoint returns 503 when it is absent |

For mobile synchronization, use the same separate token in frontend `NUXT_MOBILE_SYNC_TOKEN` and the Android build's `NUXT_PUBLIC_MOBILE_SYNC_TOKEN`. Web authentication is enforced by the Nitro frontend; direct backend access should remain within your development environment.

## Database migrations

Checked-in migrations start with [`prisma/migrations/0_init`](prisma/migrations/0_init). Apply them explicitly:

```sh
npm run prisma:deploy
```

This script runs `prisma migrate deploy` to apply database migrations; it does not publish an application. To create a migration after changing the schema, use:

```sh
npm run prisma:migrate -- --name describe_change
```

An existing database created without Prisma migration history needs a reviewed baseline. Do not replace that process with `db push --accept-data-loss`.

## API overview

All endpoints use the `/api` prefix.

| Method and path | Purpose |
| --- | --- |
| `POST /api/games` | Create a game with players and roles |
| `GET /api/games`, `GET /api/games/:id` | List games or read a complete game |
| `PATCH /api/games/:id/start` | Start a game |
| `PATCH /api/games/:id/finish` | Complete a game with the winning clan |
| `POST /api/games/:id/nights/start` | Begin the next night |
| `GET /api/games/:id/nights/current` | Read the current night and role steps |
| `POST /api/games/:id/nights/:nightId/actions` | Save a role action |
| `POST /api/games/:id/nights/:nightId/complete` | Resolve and complete the night |
| `POST /api/games/:id/days/start` | Begin the day |
| `GET /api/games/:id/days/current` | Read day results and nominees |
| `POST /api/games/:id/days/:dayId/nominations` | Save voting nominees |
| `POST /api/games/:id/days/:dayId/eliminate` | Record the voting result |
| `POST /api/games/:id/days/:dayId/complete` | Complete the day |
| `GET /api/roles`, `GET /api/clans` | Read game dictionaries |
| `PUT /api/sync/games/:clientGameId` | Import an offline game snapshot |

Snapshot import validates the request and applies a newer revision in one transaction. Repeating an already accepted or older revision does not create another game.

## Game rules

[Night resolution](src/nights/night-resolution.ts) handles healing, immunity, role-specific kills and delayed effects. [Night steps](src/nights/night-steps.ts) defines the order in which roles act. The [Russian guide](README.ru.md) describes the club's role names and the two roles outside the current MVP.

## Checks

```sh
npm test
npm run lint
npm run build
```

Server deployment configuration is maintained outside this GitHub portfolio copy. Application code and database migrations are included.
