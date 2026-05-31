require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { getDb, initDb } = require('./db');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Инициализация БД перед запуском сервера
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

/**
 * Отправляет сообщение в Telegram с поддержкой ретраев для критических уведомлений.
 */
async function sendTelegramMessage(chatId, text, retries = 2) {
  if (!BOT_TOKEN) {
    console.warn('[TG] BOT_TOKEN missing');
    return false;
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      });
      if (response.ok) return true;

      const error = await response.json();
      console.error(`[TG] Telegram API Error (Attempt ${i+1}):`, error);
    } catch (err) {
      console.error(`[TG] Network error (Attempt ${i+1}):`, err.message);
    }
    if (i < retries) await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'mock@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

async function sendEmailFallback(orderData, user) {
  const mailOptions = {
    from: '"GAZE System" <noreply@gaze.app>',
    to: 'admin@gaze.app',
    subject: `FALLBACK: New Order #${orderData.id}`,
    text: `New order received via fallback mechanism.\n\nOrder ID: ${orderData.id}\nUser: ${user.full_name}\nTotal: ${orderData.total_price}`
  };

  try {
    await transporter.sendMail(mailOptions);
    getDb().run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
      ['info', 'SMTP Fallback email sent', JSON.stringify({ orderId: orderData.id })]);
  } catch (err) {
    getDb().run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
      ['error', 'SMTP Fallback failed', JSON.stringify({ error: err.message, orderId: orderData.id })]);
  }
}

function verifyTelegramWebAppData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  if (!BOT_TOKEN || !initData) return null;
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  urlParams.sort();

  let dataCheckString = '';
  for (const [key, value] of urlParams.entries()) {
    dataCheckString += `${key}=${value}\n`;
  }
  dataCheckString = dataCheckString.slice(0, -1);

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hmac === hash) {
    const user = JSON.parse(urlParams.get('user'));
    return user;
  }
  return null;
}

const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-tg-init-data'];
  const user = verifyTelegramWebAppData(initData);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.tgUser = user;
  next();
};

const adminMiddleware = (req, res, next) => {
  getDb().get('SELECT role FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
};

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/sync', authMiddleware, (req, res) => {
  const { id, username, first_name, last_name } = req.tgUser;
  const { start_param } = req.body;
  const fullName = [first_name, last_name].filter(Boolean).join(' ');
  const isAdminById = ADMIN_IDS.includes(id);

  getDb().get('SELECT u.*, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count FROM users u WHERE u.tg_id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!user) {
      getDb().get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
        const isFirst = !err && row.count === 0;
        let role = (isFirst || isAdminById) ? 'admin' : 'user';
        const referralCode = crypto.randomBytes(4).toString('hex');

        let invitedBy = null;
        if (start_param && /^[a-f0-9]{8}$/.test(start_param)) invitedBy = start_param;

        getDb().run('INSERT INTO users (tg_id, username, full_name, role, referral_code, invited_by) VALUES (?, ?, ?, ?, ?, (SELECT tg_id FROM users WHERE referral_code = ?))',
          [id, username, fullName, role, referralCode, invitedBy],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            getDb().get('SELECT u.*, 0 as order_count FROM users u WHERE u.id = ?', [this.lastID], (err, newUser) => {
              res.json(newUser);
            });
          }
        );
      });
    } else {
      if (user.is_blocked) return res.status(403).json({ error: 'User is blocked', reason: user.block_reason });
      if (isAdminById && user.role !== 'admin') {
          getDb().run('UPDATE users SET role = "admin" WHERE tg_id = ?', [id]);
          user.role = 'admin';
      }
      res.json(user);
    }
  });
});

app.put('/api/user/profile', authMiddleware, (req, res) => {
  const { full_name, email, phone, address } = req.body;
  getDb().run('UPDATE users SET full_name = ?, email = ?, phone = ?, address = ? WHERE tg_id = ?',
    [full_name, email, phone, address, req.tgUser.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.get('/api/prices', (req, res) => {
  getDb().all('SELECT * FROM prices', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const prices = {};
    rows.forEach(r => prices[r.key] = r.value);
    res.json(prices);
  });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { id, area, camera_type, package_id, options, spec, total_price } = req.body;
  if (!id || !total_price) return res.status(400).json({ error: 'Missing order data' });

  getDb().get('SELECT * FROM users WHERE tg_id = ?', [req.tgUser.id], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error fetching user' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    getDb().run('INSERT INTO orders (id, user_id, area, camera_type, package_id, options, spec, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, user.id, area, camera_type, package_id, JSON.stringify(options || {}), JSON.stringify(spec || {}), total_price],
      async function(insErr) {
        if (insErr) {
          getDb().run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
            ['error', 'Order submission failed', JSON.stringify({ error: insErr.message, orderId: id })]);
          try {
            await sendEmailFallback(req.body, user);
            return res.status(500).json({ error: 'Order failed to save but email fallback triggered' });
          } catch (smtpErr) {
            return res.status(500).json({ error: 'Fatal error: order failed and email fallback failed' });
          }
        }

        const text = `🚀 <b>НОВАЯ ЗАЯВКА #${id}</b>\n\n👤 Клиент: ${user.full_name}\n📞 Тел: <code>${user.phone || 'не указан'}</code>\n📍 Адрес: ${user.address || 'не указан'}\n📐 Площадь: ${area} м²\n💰 Сумма: <b>${total_price} ₽</b>`;

        if (user.invited_by) {
          const bonus = Math.floor(total_price * 0.01);
          getDb().run('UPDATE users SET bonus_balance = bonus_balance + ? WHERE tg_id = ?', [bonus, user.invited_by]);
        }

        // Подтверждение пользователю
        await sendTelegramMessage(user.tg_id, text);

        // Уведомление админов
        getDb().all('SELECT tg_id FROM users WHERE role = "admin"', [], async (err, admins) => {
          if (!err && admins) {
            for (const a of admins) {
              if (a.tg_id !== user.tg_id) {
                await sendTelegramMessage(a.tg_id, `🔔 <b>ADMIN ALERT</b>\n${text}`);
              }
            }
          }
        });

        res.json({ success: true, orderId: id });
      }
    );
  });
});

app.get('/api/admin/orders', authMiddleware, adminMiddleware, (req, res) => {
  getDb().all('SELECT o.*, u.full_name, u.phone FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const recentDate = getDb().isMySQL ? 'DATE_SUB(NOW(), INTERVAL 7 DAY)' : "date('now', '-7 days')";

  const statsQuery = `
    SELECT
      COALESCE((SELECT SUM(total_price) FROM orders WHERE status != 'cancelled'), 0) as total_revenue,
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM orders WHERE created_at > ${recentDate}) as recent_orders
  `;

  // История для графиков
  const historyQuery = getDb().isMySQL
    ? `SELECT DATE(created_at) as date, SUM(total_price) as revenue FROM orders WHERE created_at > DATE_SUB(NOW(), INTERVAL 14 DAY) GROUP BY DATE(created_at) ORDER BY date`
    : `SELECT date(created_at) as date, SUM(total_price) as revenue FROM orders WHERE created_at > date('now', '-14 days') GROUP BY date(created_at) ORDER BY date`;

  getDb().get(statsQuery, [], (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });

    getDb().all(historyQuery, [], (err, history) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...stats, history });
    });
  });
});

app.get('/api/orders/history', authMiddleware, (req, res) => {
  getDb().get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    getDb().all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });
});

app.post('/api/admin/orders/status', authMiddleware, adminMiddleware, (req, res) => {
  const { orderId, status } = req.body;
  getDb().run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/admin/logs', authMiddleware, adminMiddleware, (req, res) => {
  getDb().all('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/admin/prices', authMiddleware, adminMiddleware, (req, res) => {
  const { key, value } = req.body;
  const sql = getDb().isMySQL
    ? 'REPLACE INTO prices (`key`, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    : 'INSERT OR REPLACE INTO prices (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)';

  getDb().run(sql, [key, value], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/admin/users/block', authMiddleware, adminMiddleware, (req, res) => {
  const { userId, reason } = req.body;
  getDb().run('UPDATE users SET is_blocked = 1, block_reason = ? WHERE id = ?', [reason, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/chat', authMiddleware, (req, res) => {
  getDb().get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    getDb().all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC', [user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });
});

app.get('/api/user/referrals', authMiddleware, (req, res) => {
  getDb().get('SELECT referral_code, bonus_balance FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    getDb().all('SELECT full_name, created_at FROM users WHERE invited_by = ?', [req.tgUser.id], (err, invites) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ code: user.referral_code, balance: user.bonus_balance, invites });
    });
  });
});

app.post('/api/chat', authMiddleware, (req, res) => {
  const { text } = req.body;
  getDb().get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    getDb().run('INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)', [user.id, 'user', text], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      setTimeout(() => {
        getDb().run('INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)',
          [user.id, 'admin', 'Спасибо за обращение! Наш специалист ответит вам в ближайшее время.'], () => {});
      }, 1000);
      res.json({ success: true });
    });
  });
});

app.post('/api/webhook', async (req, res) => {
  const update = req.body;
  if (update.message && update.message.text === '/start') {
    const chatId = update.message.chat.id;
    const text = `👋 <b>Добро пожаловать в GAZE!</b>\n\nМы поможем вам подобрать и рассчитать профессиональную систему видеонаблюдения за 2 минуты.\n\nНажмите кнопку ниже, чтобы запустить конструктор:`;
    const appUrl = process.env.APP_URL || 'https://t.me/your_bot_username/app';

    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🚀 Запустить GAZE', web_app: { url: appUrl } }]]
          }
        })
      });
    } catch (e) {
      console.error('Webhook error:', e);
    }
  }
  res.sendStatus(200);
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

const PORT = process.env.PORT || 3000;

// Гарантированная инициализация перед прослушиванием порта
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: База данных не инициализирована!', err);
  process.exit(1);
});
