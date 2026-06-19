# Деловая Мафия — Backend

REST API панели ведущего клубной Мафии. Хранит игры, игроков, роли, ночи, дни
и итоги — структуру данных, на которой позже можно строить статистику.

## Стек

- NestJS + TypeScript
- Prisma ORM + PostgreSQL
- class-validator / class-transformer
- Swagger (OpenAPI) — `/api/docs`

Все эндпоинты под префиксом `/api`.

## Переменные окружения

См. `.env.example`:

| Переменная     | Описание                                  |
| -------------- | ----------------------------------------- |
| `DATABASE_URL` | Строка подключения PostgreSQL для Prisma  |
| `PORT`         | Порт HTTP-сервера (по умолчанию `3000`)   |

## Локальный запуск

```bash
cp .env.example .env          # при необходимости поправьте DATABASE_URL
npm install
npx prisma generate
npx prisma migrate deploy     # применить миграции (или `migrate dev` в разработке)
npm run start:dev             # http://localhost:3000, Swagger: /api/docs
```

Нужен запущенный PostgreSQL. Быстрый вариант для разработки:

```bash
docker run -d --name mafia-pg -e POSTGRES_USER=mafia -e POSTGRES_PASSWORD=mafia \
  -e POSTGRES_DB=mafia -p 5432:5432 postgres:16-alpine
```

## Запуск в Docker

`docker-compose.yml` поднимает PostgreSQL и backend. Контейнер сам применяет
схему при старте (`prisma migrate deploy`, с откатом на `prisma db push`).

```bash
docker network create mafia-net      # общая сеть с frontend (один раз)
docker compose up -d --build
```

- Backend: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`

## Миграции Prisma

Начальная миграция лежит в `prisma/migrations/0_init`. В проде применяется
автоматически энтрипоинтом контейнера. Вручную:

```bash
npx prisma migrate deploy     # применить существующие миграции
npx prisma migrate dev -n ... # создать новую миграцию при изменении схемы
```

## Краткий обзор API

| Метод/Путь                                        | Назначение                              |
| ------------------------------------------------- | --------------------------------------- |
| `POST /api/games`                                 | Создать игру (игроки + роли)            |
| `GET /api/games`                                  | Список игр                              |
| `GET /api/games/:id`                              | Детали игры (игроки, ночи, дни)         |
| `PATCH /api/games/:id/start`                      | Начать игру                             |
| `PATCH /api/games/:id/finish`                     | Завершить игру (победивший клан)        |
| `POST /api/games/:id/nights/start`                | Начать следующую ночь                   |
| `GET /api/games/:id/nights/current`               | Текущая ночь и шаги ролей               |
| `POST /api/games/:id/nights/:nightId/actions`     | Сохранить действие роли                 |
| `POST /api/games/:id/nights/:nightId/complete`    | Завершить ночь и рассчитать итоги       |
| `POST /api/games/:id/days/start`                  | Начать день                             |
| `GET /api/games/:id/days/current`                 | Текущий день (итоги ночи, кандидаты)    |
| `POST /api/games/:id/days/:dayId/nominations`     | Сохранить кандидатов                    |
| `POST /api/games/:id/days/:dayId/eliminate`       | Сохранить результат голосования         |
| `POST /api/games/:id/days/:dayId/complete`        | Завершить день                          |
| `GET /api/roles`, `GET /api/clans`                | Справочники                             |

## Игровая логика

Критичный расчёт ночи централизован на бэкенде — см.
[`src/nights/night-resolution.ts`](src/nights/night-resolution.ts) (иммунитет
Красотки, лечение Доктора, Белая метка, выстрел Копа, отложенная смерть
Комиссара от Дона) и
[`src/nights/night-steps.ts`](src/nights/night-steps.ts) (порядок пробуждений).

## Деплой (GitLab CI)

`.gitlab-ci.yml` деплоит прямо на раннере (shell/docker executor на хосте
деплоя): создаёт сеть `mafia-net` и выполняет `docker compose up -d --build`
на ветке по умолчанию.

## TODO (вне MVP)

- **Участковый** — прикрывает Комиссара от проверки Дона.
- **Стажёр** — прикрывает Мафию и Дона от проверки Комиссара.
