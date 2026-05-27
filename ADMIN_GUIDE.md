# Gaze Admin Panel Guide

To access the admin panel, you need to verify your Telegram ID and configure the server.

## 1. Finding your Telegram ID
Open [@userinfobot](https://t.me/userinfobot) in Telegram. It will reply with your ID (e.g., `12345678`).

## 2. Configuration
Open the file `server/.env` and add your ID to the `ADMIN_IDS` variable. Multiple IDs should be separated by commas.

```env
ADMIN_IDS=12345678,98765432
```

## 3. Accessing the Panel
1. Restart the server: `node server/index.js`.
2. Open the Mini App.
3. Your role will be automatically updated to `admin`.
4. A button **"Админ"** will appear in the bottom navigation bar.

## Admin Features
- **Price Management**: Real-time updates of equipment and installation costs.
- **Order Monitoring**: View all submitted orders and customer details.
- **User Management**: Block/unblock users with reasons.
- **System Logs**: View error logs and system events.
