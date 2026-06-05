'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { getDb, initDb } = require('./db');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

async function sendTelegramMessage(chatId, text, retries = 2) {
  if (!BOT_TOKEN) { console.warn('[TG] BOT_TOKEN missing'); return false; }
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
      console.error(`[TG] Error (attempt ${i + 1}):`, error);
    } catch (err) {
      console.error(`[TG] Network error (attempt ${i + 1}):`, err.message);
    }
    if (i < retries) await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

async function sendEmailFallback(orderData, user) {
  const db = getDb();
  const mailOptions = {
    from: '"GAZE System" <noreply@gaze.app>',
    to: process.env.ADMIN_EMAIL || 'admin@gaze.app',
    subject: `FALLBACK: New Order #${orderData.id}`,
    text: `New order received.\n\nOrder ID: ${orderData.id}\nUser: ${user.full_name}\nTotal: ${orderData.total_price}`
  };
  try {
    await transporter.sendMail(mailOptions);
    db.run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
      ['info', 'SMTP fallback sent', JSON.stringify({ orderId: orderData.id })]);
  } catch (err) {
    db.run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
      ['error', 'SMTP fallback failed', JSON.stringify({ error: err.message, orderId: orderData.id })]);
  }
}

function verifyTelegramWebAppData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return null;
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
      const userStr = urlParams.get('user');
      if (userStr) return JSON.parse(userStr);
    }
  } catch (e) {
    console.warn('[Auth] verifyTelegramWebAppData error:', e.message);
  }
  return null;
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-tg-init-data'];

  // Guest mode — allow with null tgUser
  if (!initData || initData === 'guest') {
    req.tgUser = null;
    req.isGuest = true;
    return next();
  }

  // Dev bypass when no BOT_TOKEN
  if (!BOT_TOKEN && process.env.NODE_ENV !== 'production') {
    try {
      const urlParams = new URLSearchParams(initData);
      const userStr = urlParams.get('user');
      if (userStr) {
        req.tgUser = JSON.parse(userStr);
        req.isGuest = false;
        return next();
      }
    } catch {}
    req.tgUser = null;
    req.isGuest = true;
    return next();
  }

  const user = verifyTelegramWebAppData(initData);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.tgUser = user;
  req.isGuest = false;
  next();
};

// Middleware that REQUIRES real TG user (not guest)
const requireAuth = (req, res, next) => {
  if (req.isGuest || !req.tgUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const adminMiddleware = (req, res, next) => {
  const db = getDb();
  db.get('SELECT role FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
};

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── AUTH SYNC ────────────────────────────────────────────────────────────────
app.post('/api/auth/sync', authMiddleware, (req, res) => {
  // Guest: return minimal guest object
  if (req.isGuest) {
    return res.json({
      id: null,
      tg_id: null,
      username: 'guest',
      full_name: 'Гость',
      role: 'guest',
      order_count: 0,
      isGuest: true
    });
  }

  const db = getDb();
  const { id, username, first_name, last_name } = req.tgUser;
  const { start_param } = req.body;
  const fullName = [first_name, last_name].filter(Boolean).join(' ');
  const isAdminById = ADMIN_IDS.includes(id);

  db.get(
    'SELECT u.*, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count FROM users u WHERE u.tg_id = ?',
    [id],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!user) {
        db.get('SELECT COUNT(*) as count FROM users', [], (err2, row) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const isFirst = row.count === 0;
          const role = (isFirst || isAdminById) ? 'admin' : 'user';
          const referralCode = 'GZ' + crypto.randomBytes(4).toString('hex').toUpperCase();
          const invitedByCode = (start_param && /^GZ[A-F0-9]{8}$/i.test(start_param)) ? start_param : null;

          db.run(
            `INSERT INTO users (tg_id, username, full_name, role, referral_code, invited_by)
             VALUES (?, ?, ?, ?, ?, (SELECT tg_id FROM users WHERE referral_code = ?))`,
            [id, username || '', fullName, role, referralCode, invitedByCode],
            function (err3) {
              if (err3) return res.status(500).json({ error: err3.message });
              db.get('SELECT u.*, 0 as order_count FROM users u WHERE u.id = ?', [this.lastID], (err4, newUser) => {
                if (err4) return res.status(500).json({ error: err4.message });
                res.json(newUser);
              });
            }
          );
        });
      } else {
        if (user.is_blocked) return res.status(403).json({ error: 'User is blocked', reason: user.block_reason });
        if (isAdminById && user.role !== 'admin') {
          db.run('UPDATE users SET role = "admin" WHERE tg_id = ?', [id]);
          user.role = 'admin';
        }
        res.json(user);
      }
    }
  );
});

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
app.put('/api/user/profile', authMiddleware, requireAuth, (req, res) => {
  const db = getDb();
  const { full_name, email, phone, address } = req.body;
  db.run(
    'UPDATE users SET full_name = ?, email = ?, phone = ?, address = ? WHERE tg_id = ?',
    [full_name || '', email || '', phone || '', address || '', req.tgUser.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ─── PRICES ──────────────────────────────────────────────────────────────────
app.get('/api/prices', authMiddleware, (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM prices', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const prices = {};
    rows.forEach(r => { prices[r.key] = r.value; });
    res.json(prices);
  });
});

// ─── ORDERS ──────────────────────────────────────────────────────────────────
app.post('/api/orders', authMiddleware, requireAuth, (req, res) => {
  const db = getDb();
  const { id, area, camera_type, package_id, options, spec, total_price } = req.body;
  if (!id || !total_price) return res.status(400).json({ error: 'Missing required fields: id, total_price' });

  db.get('SELECT * FROM users WHERE tg_id = ?', [req.tgUser.id], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.run(
      'INSERT INTO orders (id, user_id, area, camera_type, package_id, options, spec, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, user.id, area, camera_type, package_id, JSON.stringify(options || {}), JSON.stringify(spec || {}), total_price],
      async function (insErr) {
        if (insErr) {
          db.run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
            ['error', 'Order save failed', JSON.stringify({ error: insErr.message, orderId: id })]);
          await sendEmailFallback(req.body, user).catch(() => {});
          return res.status(500).json({ error: 'Order failed to save', fallback: 'email' });
        }

        // Update order_count
        db.run('UPDATE users SET order_count = order_count + 1 WHERE id = ?', [user.id]);

        // Referral bonus
        if (user.invited_by) {
          const bonus = Math.floor(total_price * 0.01);
          db.run('UPDATE users SET bonus_balance = bonus_balance + ? WHERE tg_id = ?', [bonus, user.invited_by]);
        }

        const text = `🚀 <b>НОВАЯ ЗАЯВКА #${id}</b>\n\n👤 Клиент: ${user.full_name}\n📞 Тел: <code>${user.phone || 'не указан'}</code>\n📍 Адрес: ${user.address || 'не указан'}\n📐 Площадь: ${area || '—'} м²\n💰 Сумма: <b>${total_price} ₽</b>`;

        await sendTelegramMessage(user.tg_id, `✅ <b>Заявка принята!</b>\n\n${text}`);

        db.all('SELECT tg_id FROM users WHERE role = "admin"', [], async (err2, admins) => {
          if (!err2 && admins) {
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

app.get('/api/orders/history', authMiddleware, requireAuth, (req, res) => {
  const db = getDb();
  db.get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [user.id], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(rows);
    });
  });
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────
app.get('/api/admin/orders', authMiddleware, requireAuth, adminMiddleware, (req, res) => {
  const db = getDb();
  db.all(
    'SELECT o.*, u.full_name, u.phone FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/api/admin/stats', authMiddleware, requireAuth, adminMiddleware, (req, res) => {
  const db = getDb();
  const isMySQL = db.isMySQL;
  const recentDate = isMySQL ? 'DATE_SUB(NOW(), INTERVAL 7 DAY)' : "date('now', '-7 days')";
  const statsQuery = `
    SELECT
      COALESCE((SELECT SUM(total_price) FROM orders WHERE status != 'cancelled'), 0) as total_revenue,
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM orders WHERE created_at > ${recentDate}) as recent_orders
  `;
  const historyQuery = isMySQL
    ? `SELECT DATE(created_at) as date, SUM(total_price) as revenue FROM orders WHERE created_at > DATE_SUB(NOW(), INTERVAL 14 DAY) GROUP BY DATE(created_at) ORDER BY date`
    : `SELECT date(created_at) as date, SUM(total_price) as revenue FROM orders WHERE created_at > date('now', '-14 days') GROUP BY date(created_at) ORDER BY date`;

  db.get(statsQuery, [], (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(historyQuery, [], (err2, history) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ...stats, history });
    });
  });
});

app.post('/api/admin/orders/status', authMiddleware, requireAuth, adminMiddleware, (req, res) => {
  const db = getDb();
  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/admin/logs', authMiddleware, requireAuth, adminMiddleware, (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/admin/prices', authMiddleware, requireAuth, adminMiddleware, (req, res) => {
  const db = getDb();
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'Missing key or value' });
  const sql = db.isMySQL
    ? 'REPLACE INTO prices (`key`, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    : 'INSERT OR REPLACE INTO prices (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)';
  db.run(sql, [key, value], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/admin/users/block', authMiddleware, requireAuth, adminMiddleware, (req, res) => {
  const db = getDb();
  const { userId, reason } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  db.run('UPDATE users SET is_blocked = 1, block_reason = ? WHERE id = ?', [reason || '', userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ─── CHAT ─────────────────────────────────────────────────────────────────────
app.get('/api/chat', authMiddleware, requireAuth, (req, res) => {
  const db = getDb();
  db.get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    db.all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC', [user.id], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(rows);
    });
  });
});

app.post('/api/chat', authMiddleware, requireAuth, (req, res) => {
  const db = getDb();
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message' });
  db.get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    db.run('INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)', [user.id, 'user', text], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      setTimeout(() => {
        db.run('INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)',
          [user.id, 'admin', 'Спасибо за обращение! Наш специалист ответит вам в ближайшее время.'], () => {});
      }, 1000);
      res.json({ success: true });
    });
  });
});

// ─── REFERRALS ────────────────────────────────────────────────────────────────
app.get('/api/user/referrals', authMiddleware, requireAuth, (req, res) => {
  const db = getDb();
  db.get('SELECT referral_code, bonus_balance FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    db.all('SELECT full_name, created_at FROM users WHERE invited_by = ?', [req.tgUser.id], (err2, invites) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ code: user.referral_code, balance: user.bonus_balance, invites });
    });
  });
});

app.post('/api/user/referral/generate', authMiddleware, requireAuth, (req, res) => {
  const db = getDb();
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  db.get('SELECT referral_code FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    if (user.referral_code) return res.json({ code: user.referral_code });

    db.run('UPDATE users SET referral_code = ? WHERE tg_id = ?', [code, req.tgUser.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ code });
    });
  });
});

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200);
  const update = req.body;
  if (!update.message || update.message.text !== '/start') return;
  const chatId = update.message.chat.id;
  const appUrl = process.env.APP_URL || 'https://t.me/your_bot/app';
  const text = `👋 <b>Добро пожаловать в GAZE!</b>\n\nПрофессиональные системы видеонаблюдения под ключ.\n\nНажмите кнопку ниже:`;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🚀 Запустить GAZE', web_app: { url: appUrl } }]] }
      })
    });
  } catch (e) {
    console.error('[Webhook] sendMessage error:', e.message);
  }
});

// ─── ERROR HANDLER ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// ─── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`[GAZE] Server running on port ${PORT}`));
}).catch(err => {
  console.error('[GAZE] DB init failed:', err);
  process.exit(1);
});
