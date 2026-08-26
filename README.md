# Айтилаб

CRM для сервиса по ремонту и обслуживанию оргтехники и гаджетов.

## Технологии

- React, TypeScript, Vite и Material UI;
- Redux Toolkit и RTK Query;
- Node.js, TypeScript и Express;
- PostgreSQL;
- npm workspaces;
- Docker Compose.

## Структура

```text
apps/
  api/          Express API
  web/          React-приложение
packages/
  contracts/    Общие схемы и типы API
```

## Локальный запуск

На компьютере нужны только Git и Docker Desktop. Node.js и npm локально устанавливать не требуется.

1. Создайте локальный файл окружения:

   ```powershell
   Copy-Item .env.example .env
   ```

   Для Bash:

   ```bash
   cp .env.example .env
   ```

   Затем откройте `.env` и установите локальные значения:

   ```env
   ADMIN_PASSWORD=установите_согласованный_пароль
   SESSION_SECRET=замените-на-случайную-строку-длиной-не-менее-32-символов
   ```

2. Запустите приложение:

   ```bash
   docker compose up --build
   ```

3. Откройте:

   - frontend: <http://localhost:5173>;
   - API health check: <http://localhost:3000/api/health>.

Для первого входа используйте логин `BOSS` и пароль из `ADMIN_PASSWORD`.

## Авторизация

- ADMIN задаётся конфигурацией и не хранится в базе данных;
- MANAGER и TECHNICIAN будут создаваться позже через интерфейс ADMIN;
- серверная сессия хранится в PostgreSQL и действует 8 часов;
- cookie имеет флаги `httpOnly` и `sameSite=lax`;
- все страницы, кроме `/login`, требуют действующую сессию.

Применить сохранённые миграции вручную:

```bash
docker compose exec api npm run db:deploy
```

Создать новую миграцию во время разработки:

```bash
docker compose exec api npm run db:migrate -- --name migration_name
```

Остановка приложения:

```bash
docker compose down
```

Удаление локальной базы вместе с Docker volume:

```bash
docker compose down --volumes
```

## Этапы разработки

1. Учётные записи и роли: `ADMIN`, `MANAGER`, `TECHNICIAN`.
2. Склад и запчасти.
3. Заявки на ремонт.
