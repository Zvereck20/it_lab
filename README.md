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

2. Запустите приложение:

   ```bash
   docker compose up --build
   ```

3. Откройте:

   - frontend: <http://localhost:5173>;
   - API health check: <http://localhost:3000/api/health>.

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
