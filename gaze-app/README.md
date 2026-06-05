# GAZE — Telegram Web App

## Структура
```
gaze-app/
├── server/
│   ├── app.js      # Express сервер + API
│   └── db.js       # SQLite / MySQL (auto-detect)
├── public/
│   ├── index.html
│   ├── app.js      # Клиентский код
│   ├── storage.js  # API клиент
│   ├── telegram.js # Telegram TWA сервис
│   └── *.css
├── package.json
├── railway.json
└── .env.example
```

## Деплой на Railway

1. Загрузите проект на GitHub
2. Создайте новый проект на railway.app → Deploy from GitHub
3. В переменных окружения укажите:
   - `BOT_TOKEN` — токен вашего Telegram бота
   - `ADMIN_IDS` — ваш Telegram ID (узнать: @userinfobot)
   - `APP_URL` — URL вашего Web App в Telegram
4. Railway автоматически создаст SQLite. Для MySQL добавьте плагин MySQL в Railway и переменная `DATABASE_URL` заполнится автоматически.

## Локальный запуск
```bash
cp .env.example .env
# Заполните .env
npm install
npm run dev
```
