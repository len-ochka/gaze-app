require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const { getDb, initDb } = require('./db');

/**
 * Gaze Backend v2.0
 * Secure, scalable, and optimized for Telegram Mini Apps.
 */

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const db = getDb();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN) return console.warn('[TG] BOT_TOKEN missing');
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    return response.ok;
  } catch (err) {
    console.error('[TG] Send failed:', err.message);
    return false;
  }
}

async function sysLog(level, message, context = {}) {
  console.log(`[${level.toUpperCase()}] ${message}`, context);
  db.run('INSERT INTO logs (level, message, context) VALUES (?, ?, ?)',
    [level, message, JSON.stringify(context)]);
}

function verifyTelegramWebAppData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
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
    if (hmac === hash) return JSON.parse(urlParams.get('user'));
  } catch (e) {}
  return null;
}

const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-tg-init-data'];
  if (!initData && process.env.NODE_ENV === 'development') {
    req.tgUser = { id: 98765, first_name: 'Dev', last_name: 'Admin' };
    return next();
  }
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

app.post('/api/auth/sync', authMiddleware, (req, res) => {
  const { id, username, first_name, last_name } = req.tgUser;
  const fullName = [first_name, last_name].filter(Boolean).join(' ') || 'Пользователь';
  const isAdminById = ADMIN_IDS.includes(id);

  db.get('SELECT u.*, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count FROM users u WHERE u.tg_id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        let role = (!err && row.count === 0) || isAdminById ? 'admin' : 'user';
        db.run('INSERT INTO users (tg_id, username, full_name, role) VALUES (?, ?, ?, ?)',
          [id, username, fullName, role],
          function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => res.json(newUser));
          }
        );
      });
    } else {
      if (user.is_blocked) return res.status(403).json({ error: 'Blocked', reason: user.block_reason });
      if (isAdminById && user.role !== 'admin') {
          db.run('UPDATE users SET role = "admin" WHERE tg_id = ?', [id]);
          user.role = 'admin';
      }
      res.json(user);
    }
  });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { id, area, total_price, spec } = req.body;
  db.get('SELECT * FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.run('INSERT INTO orders (id, user_id, area, total_price, spec) VALUES (?, ?, ?, ?, ?)',
      [id, user.id, area, total_price, JSON.stringify(spec)],
      async function(err) {
        if (err) return res.status(500).json({ error: 'Order failed' });
        const text = `🚀 <b>ЗАЯВКА #${id}</b>\n\n👤 ${user.full_name}\n📞 ${user.phone || '—'}\n📐 ${area}м²\n💰 ${total_price} ₽`;
        sendTelegramMessage(user.tg_id, text);
        db.all('SELECT tg_id FROM users WHERE role = "admin"', [], (err, admins) => {
          if (!err && admins) admins.forEach(a => sendTelegramMessage(a.tg_id, `🔔 ADMIN: ${text}`));
        });
        res.json({ success: true, orderId: id });
      }
    );
  });
});

app.get('/api/prices', (req, res) => {
  db.all('SELECT * FROM prices', [], (err, rows) => {
    const p = {}; rows?.forEach(r => p[r.key] = r.value);
    res.json(p);
  });
});

app.put('/api/user/profile', authMiddleware, (req, res) => {
  const { full_name, phone, address } = req.body;
  db.run('UPDATE users SET full_name = ?, phone = ?, address = ? WHERE tg_id = ?',
    [full_name, phone, address, req.tgUser.id], (err) => res.json({ success: !err }));
});

app.get('/api/chat', authMiddleware, (req, res) => {
  db.all('SELECT * FROM messages WHERE user_id = (SELECT id FROM users WHERE tg_id = ?) ORDER BY created_at ASC', [req.tgUser.id], (err, rows) => res.json(rows || []));
});

app.post('/api/chat', authMiddleware, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });

  db.get('SELECT id FROM users WHERE tg_id = ?', [req.tgUser.id], (err, user) => {
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.run('INSERT INTO messages (user_id, sender, text) VALUES (?, ?, ?)', [user.id, 'user', text], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to save message' });
      sysLog('info', `New message from user ${user.id}`, { text });
      res.json({ success: true });
    });
  });
});

// --- ADMIN ENDPOINTS ---

app.get('/api/admin/orders', authMiddleware, adminMiddleware, (req, res) => {
  db.all('SELECT o.*, u.full_name, u.phone FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC', [], (err, rows) => res.json(rows));
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  db.all('SELECT *, (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count FROM users ORDER BY created_at DESC', [], (err, rows) => res.json(rows));
});

app.get('/api/admin/logs', authMiddleware, adminMiddleware, (req, res) => {
  db.all('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100', [], (err, rows) => res.json(rows));
});

app.post('/api/admin/prices', authMiddleware, adminMiddleware, (req, res) => {
  const data = req.body;
  // Handle both single update {key, value} and batch update {key: value}
  const updates = data.key ? { [data.key]: data.value } : data;

  const promises = Object.entries(updates).map(([key, value]) => {
    return new Promise((resolve) => {
      db.run('UPDATE prices SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE `key` = ?', [value, key], () => resolve());
    });
  });
  Promise.all(promises).then(() => {
    sysLog('info', 'Prices updated by admin', { updates });
    res.json({ success: true });
  });
});

app.post('/api/admin/users/block', authMiddleware, adminMiddleware, (req, res) => {
  const { userId, isBlocked = true, reason } = req.body;
  db.run('UPDATE users SET is_blocked = ?, block_reason = ? WHERE id = ?', [isBlocked ? 1 : 0, reason, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    sysLog('warn', `User ${userId} block status changed to ${isBlocked}`, { reason });
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 3000;
initDb().then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`)));
