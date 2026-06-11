# GAZE — Система видеонаблюдения v2.1

Telegram Web App для расчёта и оформления заказа на монтаж систем видеонаблюдения.

## Стек

- **Backend:** Node.js 18+ / Express
- **БД:** PostgreSQL (Railway) / SQLite (локально)
- **Frontend:** Vanilla JS, CSS custom props, Telegram WebApp SDK
- **Deploy:** Railway.app

---

## Быстрый старт (локально)

```bash
git clone https://github.com/your-org/gaze-app
cd gaze-app
npm install
cp .env.example .env
# Отредактируйте .env (BOT_TOKEN и т.д.)
npm run dev
```

Откройте `http://localhost:3000` в браузере.

---

## Deploy на Railway

### 1. Создать проект

```bash
railway login
railway init
railway add --database postgresql
```

### 2. Переменные окружения

В Railway Dashboard → Settings → Variables добавьте:

| Переменная | Описание |
|---|---|
| `BOT_TOKEN` | Токен Telegram бота (BotFather) |
| `ADMIN_IDS` | Telegram ID администраторов (через запятую) |
| `APP_URL` | URL вашего Railway деплоя |
| `DATABASE_URL` | Автоматически добавляется Railway PostgreSQL |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Для email-уведомлений (опционально) |

### 3. Deploy

```bash
railway up
```

---

## Настройка Telegram бота

### Создать бота

1. Напишите [@BotFather](https://t.me/BotFather)
2. `/newbot` → задайте имя и username
3. Скопируйте токен в `BOT_TOKEN`

### Подключить Web App

```
/newapp → выберите бота → укажите URL вашего Railway деплоя
```

Или через команду:
```
/setmenubutton → выберите бота → Web App → URL
```

### Установить webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app.railway.app/api/webhook"
```

---

## Структура проекта

```
gaze-app/
├── server/
│   ├── app.js              # Express API + маршруты
│   ├── db.js               # PostgreSQL / SQLite / MySQL слой
│   ├── pricing_engine.js   # Алгоритм расчёта (-7% от рынка СНГ)
│   └── profanity.js        # Фильтр нецензурной лексики (RU+EN)
├── public/
│   ├── index.html          # SPA оболочка
│   ├── app.js              # Клиентская логика
│   ├── storage.js          # API-клиент
│   ├── telegram.js         # Telegram WebApp SDK обёртка
│   ├── main.css            # Основные стили
│   ├── extra.css           # Дополнительные компоненты
│   └── ...                 # Остальные CSS модули
├── .env.example            # Шаблон переменных окружения
├── railway.json            # Конфигурация Railway
└── package.json
```

---

## API эндпоинты

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/health` | Статус сервера |
| `POST` | `/api/auth/sync` | Авторизация / регистрация |
| `GET` | `/api/prices` | Список цен |
| `POST` | `/api/promo/validate` | Проверка промокода |
| `POST` | `/api/orders` | Создать заказ |
| `GET` | `/api/orders/history` | История заказов |
| `POST` | `/api/reviews` | Оставить отзыв |
| `GET` | `/api/reviews` | Публичные отзывы |
| `GET` | `/api/chat` | Сообщения поддержки |
| `POST` | `/api/chat` | Отправить сообщение |
| `GET` | `/api/user/referrals` | Реферальные данные |
| `GET` | `/api/admin/stats` | Статистика (admin) |
| `GET` | `/api/admin/orders` | Заказы (admin) |
| `POST` | `/api/admin/orders/status` | Изменить статус (admin) |
| `GET` | `/api/admin/users` | Пользователи (admin) |
| `POST` | `/api/admin/broadcast` | Рассылка в Telegram (admin) |
| `GET` | `/api/admin/reviews` | Отзывы на модерации (admin) |
| `PUT` | `/api/admin/reviews/:id` | Одобрить/отклонить отзыв |
| `POST` | `/api/admin/promo` | Создать промокод (admin) |

---

## Модерация отзывов

Отзывы проходят через встроенный фильтр (`server/profanity.js`):

- `pending` → ожидает одобрения
- `approved` → опубликован на главной
- `flagged` → содержит ненормативную лексику, требует ручной проверки
- `rejected` → отклонён

Администратор одобряет через вкладку **⭐ Отзывы** в Admin Panel.

---

## Pricing Engine

Файл `server/pricing_engine.js` реализует конкурентный алгоритм:

```
Финальная_цена = Средняя_цена_СНГ_2026 × 0.93
```

**Источники цен (май 2026):** Яндекс.Маркет, DNS, OZON — Hikvision, HiWatch, Dahua, WD Purple, APC/Powercom.

Поддерживаемые опции расчёта:
- `wireless` — Wi-Fi/беспроводное подключение (TP-Link / Ubiquiti)
- `solar` — автономное питание (солнечная панель + АКБ 100Ач)
- `ups` — ИБП 12V DC специализированный для CCTV
- `soundRecord` — микрофоны с шумоподавлением
- `hasInternet` — 4G-роутер
- `maintenance` — ежемесячное ТО

---

## Важные замечания

> ⚠️ Никогда не коммитьте файл `.env`. Он добавлен в `.gitignore`.

> ℹ️ Для получения Telegram-уведомлений пользователь должен нажать `/start` в боте (ограничение Telegram API).

> 🔋 ИБП используются специализированные **12V DC** для питания камер, а не бытовые 220V — это важно для корректной работы при отключении питания.
