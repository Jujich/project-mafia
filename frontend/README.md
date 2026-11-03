# Деловая Мафия — Frontend

Веб-панель ведущего на Nuxt 3 + NuxtUI. Премиальная тёмная тема клуба
(тёмно-синий фон, золотые акценты), адаптивная вёрстка, mobile-first.

## Стек

- Nuxt 3 + Vue 3 + TypeScript
- NuxtUI (Tailwind)
- Nitro BFF для веб-версии
- Capacitor 8 + Android для автономной мобильной версии
- Capacitor Preferences + Network для локальных игр и синхронизации

Веб-клиент **не** обращается к backend напрямую — только через Nitro server
routes. В Android нет Node/Nitro: игровой процесс выполняется локально, а
снимки игр отправляются по HTTPS через защищённый sync endpoint публичного
Nuxt-сервера. Nitro проверяет отдельный мобильный токен и передаёт снимок
NestJS по внутренней Docker-сети; остальные API остаются под веб-авторизацией.

## Переменные окружения

См. `.env.example`:

| Переменная             | Описание                                            |
| ---------------------- | --------------------------------------------------- |
| `NUXT_BACKEND_API_URL` | Адрес backend для проксирования (server-only)       |
| `NUXT_MOBILE_SYNC_TOKEN` | Закрытый токен Nitro sync proxy; в Docker берётся из `MOBILE_SYNC_TOKEN` |
| `NUXT_PUBLIC_SYNC_API_URL` | Публичный HTTPS origin Nuxt для Android, без `/api` |
| `NUXT_PUBLIC_MOBILE_SYNC_TOKEN` | Мобильный токен APK, совпадающий с `NUXT_MOBILE_SYNC_TOKEN` и backend `MOBILE_SYNC_TOKEN` |

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

## Android (Capacitor)

Требования для нативной сборки: Node.js 22, Android Studio с Android SDK 36 и
JDK 21. Один раз скопируйте `.env.example` в `.env` и задайте публичный HTTPS
адрес публичного Nuxt-сервера:

Если JDK и Android command-line tools установлены через Homebrew на macOS,
перед CLI-сборкой задайте пути:

```bash
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="$(brew --prefix)/share/android-commandlinetools"
```

```bash
NUXT_PUBLIC_SYNC_API_URL=https://mafia.jujichservices.ru
NUXT_PUBLIC_MOBILE_SYNC_TOKEN=тот-же-токен-что-на-backend
```

Основные команды:

```bash
npm install
npm run android:assets   # иконки/splash из assets/logo.svg
npm run android:sync     # Nuxt SPA → .output/public → Android assets
npm run android:open     # открыть проект в Android Studio
npm run android:run      # собрать и запустить на устройстве/эмуляторе
npm run android:apk      # debug APK через Gradle
npm run android:release  # подписанный release APK (нужны переменные подписи ниже)
```

Debug APK появляется в
`android/app/build/outputs/apk/debug/app-debug.apk`. Для публикации нужен
отдельный release keystore и подписанный AAB/APK.

### Подписанный APK для заказчика

Сборка `npm run android:release` читает подпись только из переменных окружения:

| Переменная | Назначение |
| --- | --- |
| `ANDROID_KEYSTORE_PATH` | Абсолютный путь к существующему release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Пароль хранилища |
| `ANDROID_KEY_ALIAS` | Alias ключа приложения |
| `ANDROID_KEY_PASSWORD` | Пароль ключа |

Передайте пароли через менеджер секретов или защищённые CI-переменные, а не
через аргументы команды, историю терминала или отслеживаемые файлы. Затем
в окружении с заданными четырьмя переменными выполните:

```bash
npm run android:release
```

Результат: `android/app/build/outputs/apk/release/app-release.apk`. Без всех
четырёх переменных release-сборка завершится ошибкой, а не выдаст неподписанный
APK. Debug-команда `android:apk` не требует этих переменных.

Keystore и пароли нельзя коммитить или отправлять вместе с APK. Сохраните их
защищённую резервную копию: все последующие обновления должны использовать тот
же ключ и увеличенный `versionCode` в `android/app/build.gradle`.

**Переход с предыдущего debug APK:** новый release APK подписан другим ключом
и не установится поверх debug-версии с тем же package ID. Удаление старой
версии сотрёт все локальные игры. Если в ней есть нужные данные, сначала
установите обновление с прежней debug-подписью и настроенным сервером и
дождитесь синхронизации; только после этого можно удалять debug-версию.
Синхронизация сохраняет статистику на сервере, но не переносит локальную
историю в новую установку. Обычные обновления release → release с тем же
ключом устанавливаются поверх и сохраняют данные.

Публичный Nuxt endpoint должен работать по HTTPS. Android 9+ по умолчанию блокирует
cleartext HTTP; ослаблять это ограничение в релизной сборке не следует.

## Как работает офлайн-режим

- Capacitor-сборка — статическая SPA (`ssr: false`); server routes в APK не
  используются.
- Создание игры, все шаги ночи, приватные проверки, расчёт смертей, день,
  голосование и завершение выполняются локальным игровым движком.
- Каждая игра хранится отдельной записью в нативном Preferences-хранилище.
  Android backup отключён, чтобы роли и приватные проверки не уходили в
  облачную копию устройства.
- После каждой локальной команды повышается монотонная `revision`. Игра сразу
  остаётся доступной UI, независимо от состояния сети.
- На старте, при возврате приложения на экран и при появлении сети отправляются
  все неподтверждённые снимки. Временные ошибки повторяются с задержкой от 2 до
  60 секунд, только пока приложение открыто и есть сеть. Изменения, сделанные
  во время отправки, уходят следующим проходом. Ошибка не удаляет локальные
  данные; повтор можно запустить нажатием на индикатор в шапке. Постоянные
  HTTP-ошибки (например, 401 или 400) не запускают бесконечный автоматический повтор.
- Backend принимает снимок одной транзакцией. Повтор той же или старой ревизии
  безопасен и не создаёт дубль статистики.
- Таймер обсуждения использует абсолютный deadline и восстанавливается после
  background/restart приложения.

Мобильная версия намеренно не требует сетевого логина для проведения игры:
она должна запускаться впервые и в авиарежиме. Веб-авторизация остаётся без
изменений. Мобильный токен защищает только endpoint синхронизации и не
является полноценной пользовательской аутентификацией, поскольку значение
можно извлечь из APK.

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

Исключение из веб-сессии — только точный маршрут
`PUT /api/sync/games/:clientGameId`. Он требует заголовок
`X-Mobile-Sync-Token`, проверяемый по закрытому `NUXT_MOBILE_SYNC_TOKEN`.
Если токен не настроен, доступ закрыт. Разрешён также `OPTIONS` для CORS
preflight: только origins `https://localhost` и `http://localhost`, метод PUT
и заголовки `Content-Type`, `X-Mobile-Sync-Token`, без cookies. Другие методы
этого маршрута запрещены, другие data API по-прежнему требуют веб-сессию.
Прокси передаёт в NestJS только тело, точный путь и проверенный мобильный токен;
таймаут — 40 секунд, автоматического повтора на уровне прокси нет.

В APK нужен только отдельный мобильный токен. GitLab PAT, admin-пароли,
токены инфраструктуры и ключи подписи в APK не помещаются. Общий мобильный
токен можно извлечь из APK, поэтому он не заменяет полноценную авторизацию
пользователей. Не публикуйте остальные NestJS API в обход Nitro-авторизации.

## Деплой (GitLab CI)

`.gitlab-ci.yml` деплоит прямо на раннере: создаёт сеть `mafia-net` и выполняет
`docker compose up -d --build` на ветке по умолчанию. Backend должен быть
развёрнут в той же сети `mafia-net`.

В обоих GitLab-проектах задайте защищённую masked-переменную
`MOBILE_SYNC_TOKEN` с одинаковым отдельным случайным значением. Frontend Compose
передаёт её Nitro как `NUXT_MOBILE_SYNC_TOKEN`, backend — как `MOBILE_SYNC_TOKEN`.
Тот же мобильный токен задаётся как `NUXT_PUBLIC_MOBILE_SYNC_TOKEN` только при
сборке APK. Внешний nginx должен пропускать PUT/OPTIONS к Nuxt и поддерживать
размер тела снимка (рекомендуемый лимит — 2 MB).
