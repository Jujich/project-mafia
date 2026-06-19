# Деловая Мафия — Frontend

Веб-панель ведущего на Nuxt 3 + NuxtUI. Премиальная тёмная тема клуба
(тёмно-синий фон, золотые акценты), адаптивная вёрстка, mobile-first.

## Стек

- Nuxt 3 + Vue 3 + TypeScript
- NuxtUI (Tailwind)
- Nitro BFF — все запросы клиента идут через `server/api/*` и проксируются на backend

Клиент **не** обращается к backend напрямую — только через Nitro server routes.

## Переменные окружения

См. `.env.example`:

| Переменная             | Описание                                            |
| ---------------------- | --------------------------------------------------- |
| `NUXT_BACKEND_API_URL` | Адрес backend для проксирования (server-only)       |

Локально: `http://localhost:3000`. В Docker: `http://mafia-backend:3000`.

## Локальный запуск

```bash
cp .env.example .env
npm install
NUXT_BACKEND_API_URL=http://localhost:3000 npm run dev   # http://localhost:3000
```

Нужен запущенный backend (см. репозиторий backend).

## Запуск в Docker

```bash
docker network create mafia-net      # общая сеть с backend (один раз)
docker compose up -d --build
```

- Frontend: `http://localhost:3001`

## Страницы

- `/` — главная
- `/games` — история игр
- `/games/new` — мастер создания игры (основное → игроки → роли → назначение → подтверждение)
- `/games/:id` — панель игры (фаза, живые/выбывшие, переход к фазе)
- `/games/:id/night` — пошаговая ночь со stepper и итогами
- `/games/:id/day` — итоги ночи, таймер 3 мин, голосование, вынос
- `/games/:id/finish` — завершение игры и победивший клан

## Nitro BFF

Каждый маршрут в `server/api/*` проксирует запрос на backend через общий
помощник [`server/utils/backend.ts`](server/utils/backend.ts), сохраняя метод,
тело и код ошибки. Базовый URL берётся из `NUXT_BACKEND_API_URL`.

## Деплой (GitLab CI)

`.gitlab-ci.yml` деплоит прямо на раннере: создаёт сеть `mafia-net` и выполняет
`docker compose up -d --build` на ветке по умолчанию. Backend должен быть
развёрнут в той же сети `mafia-net`.
