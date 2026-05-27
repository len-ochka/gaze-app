require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

async function sendTelegramMessage(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    return response.ok;
  } catch (err) {
    console.error('Failed to send TG message:', err);
    return false;
  }
}

// --- SMTP FALLBACK CONFIG ---
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
    db.run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
      ['info', 'SMTP Fallback email sent', JSON.stringify({ orderId: orderData.id })]);
  } catch (err) {
    db.run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
      ['error', 'SMTP Fallback failed', JSON.stringify({ error: err.message, orderId: orderData.id })]);
  }
}

// --- UTILS ---
function verifyTelegramWebAppData(initData) {
  if (!initData) return null;
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

// --- MIDDLEWARE ---
const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-tg-init-data'];
  const user = verifyTelegramWebAppData(initData);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.tgUser = user;
  next();
};

const adminMiddleware = (req, res, next) => {
  db.get('SELECT role FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
};

// --- ROUTES ---

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth & User sync
app.post('/api/auth/sync', authMiddleware, (req, res) => {
  const { id, username, first_name, last_name } = req.tgUser;
  const fullName = [first_name, last_name].filter(Boolean).join(' ');
  const isAdminById = ADMIN_IDS.includes(id);

  db.get('SELECT u.*, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count FROM users u WHERE u.tg_id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!user) {
      // Check if this is the first user
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        const isFirst = !err && row.count === 0;
        let role = (isFirst || isAdminById) ? 'admin' : 'user';

        db.run('INSERT INTO users (tg_id, username, full_name, role) VALUES (?, ?, ?, ?)',
          [id, username, fullName, role],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
              res.json(newUser);
            });
          }
        );
      });
    } else {
      if (user.is_blocked) return res.status(403).json({ error: 'User is blocked', reason: user.block_reason });

      // Update role if user is now in ADMIN_IDS but wasn't admin before
      if (isAdminById && user.role !== 'admin') {
          db.run('UPDATE users SET role = "admin" WHERE tg_id = ?', [id]);
          user.role = 'admin';
      }

      res.json(user);
    }
  });
});

// Update profile
app.put('/api/user/profile', authMiddleware, (req, res) => {
  const { full_name, email, phone, address } = req.body;
  db.run('UPDATE users SET full_name = ?, email = ?, phone = ?, address = ? WHERE tg_id = ?',
    [full_name, email, phone, address, req.tgUser.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Get prices
app.get('/api/prices', (req, res) => {
  db.all('SELECT * FROM prices', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const prices = {};
    rows.forEach(r => prices[r.key] = r.value);
    res.json(prices);
  });
});

// Submit order
app.post('/api/orders', authMiddleware, (req, res) => {
  try {
    const { id, area, camera_type, package_id, options, spec, total_price } = req.body;

    if (!id || !total_price) {
        return res.status(400).json({ error: 'Missing order data' });
    }

    db.get('SELECT * FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
      if (err || !user) return res.status(500).json({ error: 'User not found' });

      db.run('INSERT INTO orders (id, user_id, area, camera_type, package_id, options, spec, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, user.id, area, camera_type, package_id, JSON.stringify(options || {}), JSON.stringify(spec || {}), total_price],
        async function(err) {
        if (err) {
          db.run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
            ['error', 'Order submission failed, triggering SMTP fallback', JSON.stringify({ error: err.message, orderId: id })]);

          await sendEmailFallback(req.body, user);
          return res.status(500).json({ error: 'Order failed but fallback email sent' });
        }

        // Notification text
        const text = `🚀 <b>Новая заявка #${id}</b>\n\nКлиент: ${user.full_name}\nОбъект: ${area}м², ${camera_type}\nПакет: ${package_id}\nСумма: ${total_price} ₽`;

        // Notify user via Bot
        const notified = await sendTelegramMessage(user.tg_id, text);

        // Notify admin via Bot (if different from user)
        db.get('SELECT tg_id FROM users WHERE role = "admin" LIMIT 1', async (err, admin) => {
          if (admin && admin.tg_id !== user.tg_id) {
            await sendTelegramMessage(admin.tg_id, `ADMIN NOTIFY: ${text}`);
          }
        });

          res.json({ success: true, orderId: id, notified });
        }
      );
    });
  } catch (globalErr) {
      console.error('Fatal order error:', globalErr);
      res.status(500).json({ error: 'Internal server error during order processing' });
  }
});

// --- ADMIN ROUTES ---

app.get('/api/admin/orders', authMiddleware, adminMiddleware, (req, res) => {
  db.all('SELECT o.*, u.full_name FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/admin/logs', authMiddleware, adminMiddleware, (req, res) => {
  db.all('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/admin/prices', authMiddleware, adminMiddleware, (req, res) => {
  const { key, value } = req.body;
  db.run('INSERT OR REPLACE INTO prices (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, value], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/admin/users/block', authMiddleware, adminMiddleware, (req, res) => {
  const { userId, reason } = req.body;
  db.run('UPDATE users SET is_blocked = 1, block_reason = ? WHERE id = ?', [reason, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- CHAT ROUTES ---

app.get('/api/chat', authMiddleware, (req, res) => {
  db.get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC', [user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });
});

app.post('/api/chat', authMiddleware, (req, res) => {
  const { text } = req.body;
  db.get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    db.run('INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)', [user.id, 'user', text], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // Auto-reply mock
      setTimeout(() => {
        db.run('INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)',
          [user.id, 'admin', 'Спасибо за обращение! Наш специалист ответит вам в ближайшее время.'], () => {});
      }, 1000);

      res.json({ success: true });
    });
  });
});

// --- WEBHOOK FOR /START COMMAND ---
app.post('/api/webhook', async (req, res) => {
  const update = req.body;
  if (update.message && update.message.text === '/start') {
    const chatId = update.message.chat.id;
    const text = `👋 <b>Добро пожаловать в GAZE!</b>\n\nМы поможем вам подобрать и рассчитать профессиональную систему видеонаблюдения за 2 минуты.\n\nНажмите кнопку ниже, чтобы запустить конструктор:`;

    // Attempt to get the URL from env or fallback
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
            inline_keyboard: [[
              { text: '🚀 Запустить GAZE', web_app: { url: appUrl } }
            ]]
          }
        })
      });
    } catch (e) {
      console.error('Webhook error:', e);
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
