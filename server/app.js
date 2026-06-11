'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express  = require('express');
const cors     = require('cors');
const crypto   = require('crypto');
const path     = require('path');
const { getDb, initDb }          = require('./db');
const { calculateSpec }          = require('./pricing_engine');
const { filterProfanity }        = require('./profanity');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

// ─── DB HELPER: dynamic timestamp ────────────────────────────────────────────
function nowExpr() {
  const db = getDb();
  if (db.isPostgres) return 'NOW()';
  if (db.isMySQL)    return 'NOW()';
  return "datetime('now')";
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
async function sendTg(chatId, text, retries = 2) {
  if (!BOT_TOKEN || !chatId) return false;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      });
      if (res.ok) return true;
      const err = await res.json();
      // 403 = user blocked bot, skip retry
      if (err?.error_code === 403) return false;
      console.error(`[TG] attempt ${i+1}:`, err.description);
    } catch (e) { console.error(`[TG] network error:`, e.message); }
    if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return false;
}

async function notifyAdmins(text, excludeTgId = null) {
  const db = getDb();
  db.all('SELECT tg_id FROM users WHERE role = ?', ['admin'], async (err, rows) => {
    if (err || !rows) return;
    for (const r of rows) {
      if (r.tg_id !== excludeTgId) await sendTg(r.tg_id, text);
    }
  });
}

// ─── EMAIL FALLBACK ───────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' }
});

async function emailFallback(order, user) {
  try {
    await mailer.sendMail({
      from: '"GAZE System" <noreply@gaze.app>',
      to: process.env.ADMIN_EMAIL || 'admin@gaze.app',
      subject: `[FALLBACK] Заявка #${order.id}`,
      text: `Заявка #${order.id}\nКлиент: ${user.full_name}\nТел: ${user.phone}\nСумма: ${order.total_price} ₽`
    });
  } catch (e) {
    console.error('[SMTP]', e.message);
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function verifyTgData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash'); if (!hash) return null;
    params.delete('hash'); params.sort();
    const data = Array.from(params.entries()).map(([k, v]) => `${k}=${v}`).join('\n');
    const key  = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', key).update(data).digest('hex');
    if (hmac === hash) {
      const u = params.get('user'); return u ? JSON.parse(u) : null;
    }
  } catch {}
  return null;
}

const authMw = (req, res, next) => {
  const data = req.headers['x-tg-init-data'];
  if (!data || data === 'guest') { req.tgUser = null; req.isGuest = true; return next(); }
  if (!BOT_TOKEN && process.env.NODE_ENV !== 'production') {
    try {
      const u = new URLSearchParams(data).get('user');
      if (u) { req.tgUser = JSON.parse(u); req.isGuest = false; return next(); }
    } catch {}
    req.tgUser = null; req.isGuest = true; return next();
  }
  const user = verifyTgData(data);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.tgUser = user; req.isGuest = false; next();
};

const requireAuth = (req, res, next) => {
  if (req.isGuest || !req.tgUser) return res.status(401).json({ error: 'Authentication required' });
  next();
};

const adminMw = (req, res, next) => {
  const db = getDb();
  db.get('SELECT role FROM users WHERE tg_id = ?', [req.tgUser.id], (err, u) => {
    if (err || !u || u.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
};

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok', version: '2.1.0',
  db: getDb()?.isPostgres ? 'postgres' : getDb()?.isMySQL ? 'mysql' : 'sqlite',
  ts: Date.now()
}));

// ─── AUTH SYNC ────────────────────────────────────────────────────────────────
app.post('/api/auth/sync', authMw, (req, res) => {
  if (req.isGuest) {
    return res.json({ id: null, tg_id: null, username: 'guest', full_name: 'Гость',
      role: 'guest', order_count: 0, isGuest: true, notify_orders: 1, notify_promos: 1 });
  }
  const db = getDb();
  const { id, username, first_name, last_name } = req.tgUser;
  const { start_param } = req.body;
  const fullName = [first_name, last_name].filter(Boolean).join(' ');
  const isAdmin  = ADMIN_IDS.includes(id);

  db.get(
    'SELECT u.*, (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count FROM users u WHERE u.tg_id = ?',
    [id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) {
        db.get('SELECT COUNT(*) as count FROM users', [], (err2, row) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const isFirst = !row?.count || row.count === 0;
          const role    = (isFirst || isAdmin) ? 'admin' : 'user';
          const refCode = 'GZ' + crypto.randomBytes(4).toString('hex').toUpperCase();
          const invCode = (start_param && /^GZ[A-F0-9]{8}$/i.test(start_param)) ? start_param : null;

          db.run(
            `INSERT INTO users (tg_id, username, full_name, role, referral_code, invited_by)
             VALUES (?, ?, ?, ?, ?, (SELECT tg_id FROM users WHERE referral_code = ?))`,
            [id, username || '', fullName, role, refCode, invCode],
            function(e) {
              if (e) return res.status(500).json({ error: e.message });
              db.get('SELECT *, 0 as order_count FROM users WHERE id = ?', [this.lastID], (e2, u) => {
                if (e2) return res.status(500).json({ error: e2.message });
                res.json(u);
              });
            }
          );
        });
      } else {
        if (user.is_blocked) return res.status(403).json({ error: 'User is blocked', reason: user.block_reason });
        if (isAdmin && user.role !== 'admin') {
          db.run('UPDATE users SET role = ? WHERE tg_id = ?', ['admin', id]);
          user.role = 'admin';
        }
        res.json(user);
      }
    }
  );
});

// ─── PROFILE ──────────────────────────────────────────────────────────────────
app.put('/api/user/profile', authMw, requireAuth, (req, res) => {
  const db = getDb();
  const { full_name, email, phone, address } = req.body;
  db.run('UPDATE users SET full_name=?, email=?, phone=?, address=? WHERE tg_id=?',
    [full_name||'', email||'', phone||'', address||'', req.tgUser.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM users WHERE tg_id=?', [req.tgUser.id], (e, u) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json(u);
      });
    }
  );
});

app.put('/api/user/notifications', authMw, requireAuth, (req, res) => {
  const db = getDb();
  const { notify_orders, notify_promos } = req.body;
  db.run('UPDATE users SET notify_orders=?, notify_promos=? WHERE tg_id=?',
    [notify_orders?1:0, notify_promos?1:0, req.tgUser.id],
    err => err ? res.status(500).json({ error: err.message }) : res.json({ success: true })
  );
});

// ─── PRICES ───────────────────────────────────────────────────────────────────
app.get('/api/prices', authMw, (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM prices', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const prices = {};
    rows.forEach(r => { prices[r.key] = r.value; });
    res.json(prices);
  });
});

// ─── PROMO CODE ───────────────────────────────────────────────────────────────
app.post('/api/promo/validate', authMw, requireAuth, (req, res) => {
  const db   = getDb();
  const code = req.body.code?.toUpperCase();
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const sql = `SELECT * FROM promo_codes WHERE code=? AND uses < max_uses AND (expires_at IS NULL OR expires_at > ${nowExpr()})`;
  db.get(sql, [code], (err, p) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!p)  return res.status(404).json({ error: 'Промокод недействителен или истёк' });
    res.json({ discount: p.discount, type: p.type });
  });
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────
app.post('/api/orders', authMw, requireAuth, (req, res) => {
  const db = getDb();
  const { id, area, camera_type, package_id, options, spec, total_price, address, promo_code } = req.body;
  if (!id || !total_price) return res.status(400).json({ error: 'Missing id or total_price' });

  db.get('SELECT * FROM users WHERE tg_id=?', [req.tgUser.id], async (err, user) => {
    if (err)  return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // ── Пересчёт через pricing engine на сервере ──────────────────────────
    let serverSpec  = null;
    let finalPrice  = total_price;
    try {
      const priceRows = await new Promise((resolve, reject) =>
        db.all('SELECT * FROM prices', [], (e, rows) => e ? reject(e) : resolve(rows))
      );
      const customPrices = priceRows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
      serverSpec = calculateSpec({ area, cameraType: camera_type, pkgId: package_id, options: options || {}, customPrices });
      finalPrice = serverSpec.total; // доверяем серверному расчёту
    } catch (e) {
      console.warn('[Orders] pricing engine fallback:', e.message);
    }

    // ── Промокод ─────────────────────────────────────────────────────────
    let promoDiscount = 0;
    if (promo_code) {
      const promoSql = `SELECT * FROM promo_codes WHERE code=? AND uses < max_uses AND (expires_at IS NULL OR expires_at > ${nowExpr()})`;
      const promo = await new Promise(r => db.get(promoSql, [promo_code.toUpperCase()], (e, row) => r(row||null)));
      if (promo) {
        promoDiscount = promo.type === 'percent' ? Math.floor(finalPrice * promo.discount/100) : promo.discount;
        finalPrice    = Math.max(0, finalPrice - promoDiscount);
        db.run('UPDATE promo_codes SET uses = uses + 1 WHERE code=?', [promo_code.toUpperCase()]);
      }
    }

    const orderAddress = address || user.address || '';
    db.run(
      'INSERT INTO orders (id, user_id, area, camera_type, package_id, options, spec, total_price, address) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, user.id, area, camera_type, package_id, JSON.stringify(options||{}), JSON.stringify(serverSpec||spec||{}), finalPrice, orderAddress],
      async function(insErr) {
        if (insErr) {
          db.run('INSERT INTO logs (level,message,context) VALUES (?,?,?)', ['error','Order save failed', JSON.stringify({error:insErr.message,id})]);
          await emailFallback({ id, total_price: finalPrice }, user);
          return res.status(500).json({ error: 'Order failed to save' });
        }

        db.run('UPDATE users SET order_count = order_count + 1 WHERE id=?', [user.id]);

        // Реферальный бонус 1%
        if (user.invited_by) {
          db.run('UPDATE users SET bonus_balance = bonus_balance + ? WHERE tg_id=?', [Math.floor(finalPrice*0.01), user.invited_by]);
        }

        const promoNote = promoDiscount > 0 ? `\n🎟 Промокод: −${promoDiscount.toLocaleString('ru')} ₽` : '';
        const tgText = `🚀 <b>НОВАЯ ЗАЯВКА #${id}</b>\n\n👤 ${user.full_name}\n📞 ${user.phone||'не указан'}\n📍 ${orderAddress||'не указан'}\n📐 ${area||'—'} м²\n💰 <b>${finalPrice.toLocaleString('ru')} ₽</b>${promoNote}`;

        if (user.notify_orders !== 0) await sendTg(user.tg_id, `✅ <b>Заявка принята!</b>\n\n${tgText}`);
        notifyAdmins(`🔔 <b>ADMIN ALERT</b>\n${tgText}`);

        res.json({ success: true, orderId: id, finalPrice, promoDiscount });
      }
    );
  });
});

app.get('/api/orders/history', authMw, requireAuth, (req, res) => {
  const db = getDb();
  db.get('SELECT id FROM users WHERE tg_id=?', [req.tgUser.id], (err, user) => {
    if (err||!user) return res.status(404).json({ error: 'User not found' });
    db.all('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC', [user.id], (e, rows) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(rows);
    });
  });
});

// ─── REVIEWS ─────────────────────────────────────────────────────────────────
app.post('/api/reviews', authMw, requireAuth, (req, res) => {
  const db = getDb();
  const { order_id, rating, text } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

  // Модерация через profanity filter
  const { clean, matches } = filterProfanity(text || '');
  const status    = clean ? 'pending' : 'flagged';
  const cleanText = text || '';

  db.get('SELECT id FROM users WHERE tg_id=?', [req.tgUser.id], (err, user) => {
    if (err||!user) return res.status(404).json({ error: 'User not found' });

    const insert = (uid) => {
      db.run('INSERT INTO reviews (user_id, order_id, rating, text, status, is_public) VALUES (?,?,?,?,?,?)',
        [uid, order_id||null, rating, cleanText, status, status==='pending'?0:0],
        function(e) {
          if (e) return res.status(500).json({ error: e.message });
          res.json({ success: true, id: this.lastID, status,
            message: status === 'flagged'
              ? 'Отзыв отправлен на дополнительную проверку'
              : 'Отзыв будет опубликован после модерации'
          });
          if (status === 'flagged') {
            notifyAdmins(`⚠️ <b>Подозрительный отзыв</b>\nПользователь: ${req.tgUser.id}\nМатчи: ${matches.slice(0,3).join(', ')}\nТекст: ${cleanText.substring(0,100)}`);
          }
        }
      );
    };

    if (order_id) {
      db.get('SELECT id FROM orders WHERE id=? AND user_id=?', [order_id, user.id], (e, order) => {
        if (e||!order) return res.status(403).json({ error: 'Order not found or not yours' });
        insert(user.id);
      });
    } else {
      insert(user.id);
    }
  });
});

// Публичные отзывы (только approved)
app.get('/api/reviews', authMw, (req, res) => {
  const db = getDb();
  db.all(
    `SELECT r.id, r.rating, r.text, r.created_at, u.full_name
     FROM reviews r JOIN users u ON r.user_id = u.id
     WHERE r.status = ? AND r.is_public = 1
     ORDER BY r.created_at DESC LIMIT 20`,
    ['approved'],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ─── CHAT ─────────────────────────────────────────────────────────────────────
app.get('/api/chat', authMw, requireAuth, (req, res) => {
  const db = getDb();
  db.get('SELECT id FROM users WHERE tg_id=?', [req.tgUser.id], (err, user) => {
    if (err||!user) return res.status(404).json({ error: 'User not found' });
    db.run('UPDATE messages SET is_read=1 WHERE user_id=? AND sender=? AND is_read=0', [user.id, 'admin']);
    db.all('SELECT * FROM messages WHERE user_id=? ORDER BY created_at ASC LIMIT 100', [user.id], (e, rows) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(rows);
    });
  });
});

app.post('/api/chat', authMw, requireAuth, (req, res) => {
  const db = getDb();
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Empty message' });
  if (text.length > 2000) return res.status(400).json({ error: 'Message too long' });

  db.get('SELECT * FROM users WHERE tg_id=?', [req.tgUser.id], (err, user) => {
    if (err||!user) return res.status(404).json({ error: 'User not found' });
    db.run('INSERT INTO messages (user_id, sender, text) VALUES (?,?,?)', [user.id, 'user', text.trim()], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      notifyAdmins(`💬 <b>Сообщение от ${user.full_name}</b>\n\n${text.substring(0,300)}`);
      setTimeout(() => {
        db.run('INSERT INTO messages (user_id, sender, text) VALUES (?,?,?)',
          [user.id, 'admin', 'Спасибо за обращение! Наш специалист ответит в ближайшее время.']);
      }, 1000);
      res.json({ success: true });
    });
  });
});

app.get('/api/chat/unread', authMw, requireAuth, (req, res) => {
  const db = getDb();
  db.get('SELECT id FROM users WHERE tg_id=?', [req.tgUser.id], (err, user) => {
    if (err||!user) return res.status(404).json({ error: 'User not found' });
    db.get('SELECT COUNT(*) as count FROM messages WHERE user_id=? AND sender=? AND is_read=0', [user.id, 'admin'], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ count: row?.count || 0 });
    });
  });
});

// ─── REFERRALS ────────────────────────────────────────────────────────────────
app.get('/api/user/referrals', authMw, requireAuth, (req, res) => {
  const db = getDb();
  db.get('SELECT referral_code, bonus_balance FROM users WHERE tg_id=?', [req.tgUser.id], (err, user) => {
    if (err||!user) return res.status(404).json({ error: 'Not found' });
    db.all('SELECT full_name, created_at FROM users WHERE invited_by=?', [req.tgUser.id], (e, invites) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ code: user.referral_code, balance: user.bonus_balance, invites });
    });
  });
});

app.post('/api/user/referral/generate', authMw, requireAuth, (req, res) => {
  const db = getDb();
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  db.get('SELECT referral_code FROM users WHERE tg_id=?', [req.tgUser.id], (err, user) => {
    if (err||!user) return res.status(404).json({ error: 'Not found' });
    if (user.referral_code) return res.json({ code: user.referral_code });
    db.run('UPDATE users SET referral_code=? WHERE tg_id=?', [code, req.tgUser.id], e => {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ code });
    });
  });
});

// ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────────────
app.get('/api/admin/orders', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { status, limit=50, offset=0 } = req.query;
  const where  = status ? 'WHERE o.status=?' : '';
  const params = status
    ? [status, parseInt(limit), parseInt(offset)]
    : [parseInt(limit), parseInt(offset)];
  db.all(
    `SELECT o.*, u.full_name, u.phone, u.email FROM orders o
     JOIN users u ON o.user_id = u.id ${where}
     ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get('/api/admin/stats', authMw, requireAuth, adminMw, (req, res) => {
  const db  = getDb();
  const now = nowExpr();
  const d7  = db.isPostgres
    ? `NOW() - INTERVAL '7 days'`
    : db.isMySQL ? 'DATE_SUB(NOW(), INTERVAL 7 DAY)' : "date('now', '-7 days')";
  const d14 = db.isPostgres
    ? `NOW() - INTERVAL '14 days'`
    : db.isMySQL ? 'DATE_SUB(NOW(), INTERVAL 14 DAY)' : "date('now', '-14 days')";

  const dateExpr = db.isPostgres || db.isMySQL ? 'DATE(created_at)' : "date(created_at)";

  db.get(`
    SELECT
      COALESCE((SELECT SUM(total_price) FROM orders WHERE status != 'cancelled'), 0) as total_revenue,
      (SELECT COUNT(*) FROM orders) as total_orders,
      (SELECT COUNT(*) FROM users)  as total_users,
      (SELECT COUNT(*) FROM orders WHERE created_at > ${d7}) as recent_orders,
      (SELECT COUNT(*) FROM orders WHERE status = 'new') as pending_orders,
      (SELECT COALESCE(AVG(rating),0) FROM reviews) as avg_rating,
      (SELECT COUNT(*) FROM reviews) as total_reviews
  `, [], (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(
      `SELECT ${dateExpr} as date, SUM(total_price) as revenue, COUNT(*) as count
       FROM orders WHERE created_at > ${d14}
       GROUP BY ${dateExpr} ORDER BY date`,
      [],
      (e, history) => {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ ...stats, history });
      }
    );
  });
});

app.post('/api/admin/orders/status', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { orderId, status, note } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });
  const valid = ['new', 'processing', 'done', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.run(
    `UPDATE orders SET status=?, status_note=?, updated_at=${nowExpr()} WHERE id=?`,
    [status, note||'', orderId],
    async err => {
      if (err) return res.status(500).json({ error: err.message });

      // Уведомление клиенту через Telegram
      db.get(
        'SELECT u.tg_id, u.notify_orders FROM orders o JOIN users u ON o.user_id=u.id WHERE o.id=?',
        [orderId], async (e, row) => {
          if (!e && row && row.notify_orders !== 0) {
            const names = { new:'🆕 Новая', processing:'⚙️ В обработке', done:'✅ Выполнена', cancelled:'❌ Отменена' };
            await sendTg(row.tg_id,
              `📋 <b>Статус заявки изменён</b>\n\nЗаявка #${orderId}\nСтатус: <b>${names[status]||status}</b>${note?`\n\n💬 ${note}`:''}`
            );
          }
        }
      );
      res.json({ success: true });
    }
  );
});

app.get('/api/admin/users', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { search, limit=50, offset=0 } = req.query;
  const where  = search ? 'WHERE full_name LIKE ? OR username LIKE ? OR phone LIKE ?' : '';
  const params = search
    ? [`%${search}%`, `%${search}%`, `%${search}%`, parseInt(limit), parseInt(offset)]
    : [parseInt(limit), parseInt(offset)];
  db.all(
    `SELECT id, tg_id, username, full_name, email, phone, role, order_count, bonus_balance, is_blocked, created_at
     FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/api/admin/users/block', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { userId, reason } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  db.run('UPDATE users SET is_blocked=1, block_reason=? WHERE id=?', [reason||'', userId],
    err => err ? res.status(500).json({ error: err.message }) : res.json({ success: true })
  );
});

app.post('/api/admin/users/unblock', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  db.run('UPDATE users SET is_blocked=0, block_reason=NULL WHERE id=?', [userId],
    err => err ? res.status(500).json({ error: err.message }) : res.json({ success: true })
  );
});

app.get('/api/admin/logs', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { level, limit=100 } = req.query;
  const where  = level ? 'WHERE level=?' : '';
  const params = level ? [level, parseInt(limit)] : [parseInt(limit)];
  db.all(`SELECT * FROM logs ${where} ORDER BY created_at DESC LIMIT ?`, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/admin/prices', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'Missing key or value' });
  const sql = db.isPostgres
    ? 'INSERT INTO prices (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()'
    : db.isMySQL
    ? 'REPLACE INTO prices (`key`, value) VALUES (?, ?)'
    : 'INSERT OR REPLACE INTO prices (key, value) VALUES (?, ?)';
  db.run(sql, [key, Number(value)], err =>
    err ? res.status(500).json({ error: err.message }) : res.json({ success: true })
  );
});

app.post('/api/admin/chat/reply', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { userId, text } = req.body;
  if (!userId || !text) return res.status(400).json({ error: 'Missing userId or text' });
  db.run('INSERT INTO messages (user_id, sender, text) VALUES (?,?,?)', [userId, 'admin', text.trim()], async function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT tg_id FROM users WHERE id=?', [userId], async (e, user) => {
      if (!e && user) await sendTg(user.tg_id, `💬 <b>Ответ от GAZE</b>\n\n${text}`);
    });
    res.json({ success: true });
  });
});

app.post('/api/admin/promo', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { code, discount, type='fixed', max_uses=1, expires_at } = req.body;
  if (!code || !discount) return res.status(400).json({ error: 'Missing code or discount' });
  const sql = db.isPostgres
    ? 'INSERT INTO promo_codes (code, discount, type, max_uses, expires_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO UPDATE SET discount=$2, type=$3, max_uses=$4, expires_at=$5'
    : db.isMySQL
    ? 'REPLACE INTO promo_codes (code, discount, type, max_uses, expires_at) VALUES (?,?,?,?,?)'
    : 'INSERT OR REPLACE INTO promo_codes (code, discount, type, max_uses, expires_at) VALUES (?,?,?,?,?)';
  db.run(sql, [code.toUpperCase(), discount, type, max_uses, expires_at||null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.get('/api/admin/promo', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM promo_codes ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/admin/broadcast', authMw, requireAuth, adminMw, async (req, res) => {
  const db = getDb();
  const { text, target='all' } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  const where = target === 'customers'
    ? 'WHERE order_count > 0 AND is_blocked=0 AND notify_promos=1'
    : 'WHERE is_blocked=0 AND notify_promos=1';
  db.all(`SELECT tg_id FROM users ${where}`, [], async (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    let sent = 0, failed = 0;
    for (const u of users) {
      const ok = await sendTg(u.tg_id, text); ok ? sent++ : failed++;
      await new Promise(r => setTimeout(r, 50));
    }
    db.run('INSERT INTO logs (level,message,context) VALUES (?,?,?)',
      ['info', 'Broadcast sent', JSON.stringify({ sent, failed, target })]);
    res.json({ success: true, sent, failed });
  });
});

// ─── ADMIN REVIEWS ────────────────────────────────────────────────────────────
app.get('/api/admin/reviews', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  db.all(
    `SELECT r.*, u.full_name, u.username FROM reviews r
     JOIN users u ON r.user_id=u.id ORDER BY r.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Одобрить/скрыть отзыв (approve → is_public=1)
app.put('/api/admin/reviews/:id', authMw, requireAuth, adminMw, (req, res) => {
  const db = getDb();
  const { action } = req.body; // 'approve' | 'reject' | 'hide'
  const status    = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'hidden';
  const is_public = action === 'approve' ? 1 : 0;
  db.run('UPDATE reviews SET status=?, is_public=? WHERE id=?', [status, is_public, req.params.id],
    err => err ? res.status(500).json({ error: err.message }) : res.json({ success: true })
  );
});

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200);
  const upd = req.body;
  if (!upd.message) return;
  const chatId  = upd.message.chat.id;
  const text    = upd.message.text || '';
  const appUrl  = process.env.APP_URL || '';

  if (text.startsWith('/start')) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `👋 <b>Добро пожаловать в GAZE!</b>\n\nПрофессиональные системы видеонаблюдения под ключ.\n🎯 Расчёт стоимости за 2 минуты — прямо в приложении.`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[{ text: '🚀 Открыть GAZE', web_app: { url: appUrl } }]]
          }
        })
      });
    } catch {}
    return;
  }
  if (text === '/help') {
    await sendTg(chatId, '❓ <b>Помощь</b>\n\n/start — открыть приложение\n/help — эта справка');
  }
});

// ─── FALLBACK SPA ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GAZE] v2.1 ready on :${PORT}`);
  });
}).catch(err => {
  console.error('[GAZE] DB init failed:', err);
  process.exit(1);
});
