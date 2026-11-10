# Деловая Мафия — Backend

[English](README.md) | [Русский](README.ru.md)

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
| `MOBILE_SYNC_TOKEN` | Обязательный отдельный токен импорта из Android; без него sync API возвращает 503 |

## Локальный запуск

Требуются Node.js 22+, npm и запущенный PostgreSQL. Создайте локальную базу и
пользователя по [корневой инструкции](../README.ru.md#локальный-запуск).
Выполните из каталога `backend/`:

```bash
cp .env.example .env
# Настройте DATABASE_URL в .env; PORT по умолчанию 3000.
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

Backend: `http://localhost:3000`; Swagger: `http://localhost:3000/api/docs`.
Frontend запускается отдельно на порту `3001`. Справочники ролей и кланов
определены в коде: отдельное заполнение базы для них не требуется.

## Миграции Prisma

Начальная миграция лежит в `prisma/migrations/0_init`. Сохранённые миграции
применяются явно командой `npm run prisma:deploy`. Для существующей БД, созданной без
истории Prisma Migrate, сначала проверьте схему и корректно выполните baseline;
не обходите ошибку миграции через `db push --accept-data-loss`. Вручную:

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
| `PUT /api/sync/games/:clientGameId`               | Идемпотентный импорт офлайн-снимка      |

Мобильный endpoint принимает только более новую `revision`. Повтор уже
принятой ревизии возвращает успешный ответ и не создаёт дубль. Вся замена
нормализованных данных игры выполняется одной транзакцией.

## Игровая логика

Критичный расчёт ночи централизован на бэкенде — см.
[`src/nights/night-resolution.ts`](src/nights/night-resolution.ts) (иммунитет
Красотки, лечение Доктора, Белая метка, выстрел Копа, отложенная смерть
Комиссара от Дона) и
[`src/nights/night-steps.ts`](src/nights/night-steps.ts) (порядок пробуждений).

## TODO (вне MVP)

- **Участковый** — прикрывает Комиссара от проверки Дона.
- **Стажёр** — прикрывает Мафию и Дона от проверки Комиссара.

## Проверки

```bash
npm test
npm run lint
npm run build
```

Конфигурация серверного развёртывания не входит в GitHub-копию.
