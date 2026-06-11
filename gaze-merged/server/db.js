'use strict';

/**
 * GAZE — Database layer v2.1
 * Supports: PostgreSQL (Railway/production), SQLite (local dev), MySQL (legacy)
 */

const path = require('path');

let _db = null;

// ─── DEFAULT PRICES (РФ/СНГ 2026, -7% от рынка) ──────────────────────────────
const DEFAULT_PRICES = [
  // Пакеты — цена за камеру
  ['pkg_budget_cam',       2050],  // OEM 720p
  ['pkg_standard_cam',     4180],  // Hikvision DS-2CD1143 1080p
  ['pkg_premium_cam',      9110],  // Hikvision DS-2CD2T47 4K

  // Профессиональные камеры HiWatch/Hikvision
  ['pro_cam_2mp_bullet',   2600],  // HiWatch DS-I226
  ['pro_cam_4mp_dome',     3900],  // HiWatch DS-I452
  ['pro_cam_8mp_bullet',   8280],  // Hikvision DS-2CD2T83
  ['pro_cam_ptz',         13480],  // Hikvision DS-2DE4A425

  // NVR
  ['nvr_4ch',              4190],  // HiWatch DS-N104
  ['nvr_8ch',              6700],  // HiWatch DS-N108
  ['nvr_16ch',            11620],  // Hikvision DS-7616
  ['pro_nvr_4ch',          4190],
  ['pro_nvr_8ch',          6700],
  ['pro_nvr_16ch',        11620],

  // HDD WD Purple (цены Яндекс.Маркет 2026 -7%)
  ['hdd_1tb',              2980],
  ['hdd_2tb',              5120],
  ['hdd_4tb',              8560],
  ['pro_hdd_2tb',          5120],
  ['pro_hdd_4tb',          8560],

  // Монтаж
  ['install_per_cam',      1670],
  ['cable_per_meter',        33],
  ['install_base',          3260],

  // ИБП (12V DC для видеонаблюдения — APC/Powercom)
  // 4-камерная система: APC BE650G2 ~4500р, -7%
  ['ups',                  4190],
  ['ups_8cam',             6980],  // Powercom SPT-850 для 8 камер
  ['ups_16cam',           11160],  // Powercom SPT-1500 для 16 камер

  // PoE коммутаторы
  ['poe_switch_8p',        3350],
  ['poe_switch_16p',       5770],

  // Wi-Fi ретрансляторы (беспроводная опция)
  ['wifi_extender',        2790],  // TP-Link EAP225-Outdoor
  ['wifi_bridge',          4650],  // Ubiquiti Bullet M2
  ['solar_controller',     3720],  // Солнечный контроллер 20А
  ['solar_battery_100ah',  8370],  // АКБ 100Ah для камер

  // Интернет
  ['internet_router',      2980],
  ['internet_4g_monthly',   837],

  // Сервисные пакеты (ТО)
  ['service_basic',        1395],
  ['service_extended',     3260],
  ['service_premium',      6980],

  // Скидки пакетные
  ['discount_standard',     465],
  ['discount_premium',     1395],
];

// ─── POSTGRESQL ───────────────────────────────────────────────────────────────
function initPostgres(url) {
  return new Promise(async (resolve, reject) => {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: url,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Unified interface matching SQLite signature
    pool.isPostgres = true;
    pool.isMySQL    = false;

    // run(sql, params, cb) → void
    pool.run = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      // Convert ? placeholders to $1,$2... for pg
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      pool.query(pgSql, params || [])
        .then(r => cb && cb.call({ lastID: r.rows?.[0]?.id, changes: r.rowCount }, null))
        .catch(e => cb && cb(e));
    };

    // get(sql, params, cb) → first row
    pool.get = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      pool.query(pgSql, params || [])
        .then(r => cb && cb(null, r.rows?.[0] || null))
        .catch(e => cb && cb(e, null));
    };

    // all(sql, params, cb) → rows[]
    pool.all = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      pool.query(pgSql, params || [])
        .then(r => cb && cb(null, r.rows || []))
        .catch(e => cb && cb(e, []));
    };

    pool.serialize = fn => fn();

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        tg_id         BIGINT UNIQUE,
        username      VARCHAR(128),
        full_name     VARCHAR(256),
        email         VARCHAR(256),
        phone         VARCHAR(32),
        address       TEXT,
        role          VARCHAR(16) DEFAULT 'user',
        referral_code VARCHAR(32) UNIQUE,
        invited_by    BIGINT,
        bonus_balance INTEGER DEFAULT 0,
        order_count   INTEGER DEFAULT 0,
        is_blocked    SMALLINT DEFAULT 0,
        block_reason  TEXT,
        notify_orders SMALLINT DEFAULT 1,
        notify_promos SMALLINT DEFAULT 1,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id           VARCHAR(64) PRIMARY KEY,
        user_id      INTEGER REFERENCES users(id),
        area         FLOAT,
        camera_type  VARCHAR(32),
        package_id   VARCHAR(32),
        options      TEXT,
        spec         TEXT,
        total_price  FLOAT,
        status       VARCHAR(32) DEFAULT 'new',
        status_note  TEXT,
        address      TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS prices (
        key        VARCHAR(64) PRIMARY KEY,
        value      FLOAT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        sender     VARCHAR(16),
        text       TEXT,
        is_read    SMALLINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS logs (
        id         SERIAL PRIMARY KEY,
        level      VARCHAR(16),
        message    TEXT,
        context    TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS reviews (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        order_id   VARCHAR(64),
        rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text       TEXT,
        status     VARCHAR(16) DEFAULT 'pending',
        is_public  SMALLINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS promo_codes (
        id         SERIAL PRIMARY KEY,
        code       VARCHAR(32) UNIQUE NOT NULL,
        discount   INTEGER NOT NULL,
        type       VARCHAR(16) DEFAULT 'fixed',
        max_uses   INTEGER DEFAULT 1,
        uses       INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    try {
      await pool.query('SELECT 1'); // connectivity check
      for (const sql of tables) await pool.query(sql);

      // Seed prices
      for (const [k, v] of DEFAULT_PRICES) {
        await pool.query(
          'INSERT INTO prices (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
          [k, v]
        );
      }

      console.log('[DB] PostgreSQL connected and schema ready');
      _db = pool;
      resolve(pool);
    } catch (e) {
      reject(e);
    }
  });
}

// ─── SQLITE ───────────────────────────────────────────────────────────────────
function initSQLite() {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath  = process.env.SQLITE_PATH || path.join(__dirname, '..', 'gaze.sqlite');
    const db      = new sqlite3.Database(dbPath, err => {
      if (err) return reject(err);
      console.log('[DB] SQLite connected:', dbPath);
    });

    db.isPostgres = false;
    db.isMySQL    = false;

    db.serialize(() => {
      db.run('PRAGMA journal_mode=WAL');
      db.run('PRAGMA foreign_keys=ON');

      db.run(`CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_id         INTEGER UNIQUE,
        username      TEXT,
        full_name     TEXT,
        email         TEXT,
        phone         TEXT,
        address       TEXT,
        role          TEXT DEFAULT 'user',
        referral_code TEXT UNIQUE,
        invited_by    INTEGER,
        bonus_balance INTEGER DEFAULT 0,
        order_count   INTEGER DEFAULT 0,
        is_blocked    INTEGER DEFAULT 0,
        block_reason  TEXT,
        notify_orders INTEGER DEFAULT 1,
        notify_promos INTEGER DEFAULT 1,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id           TEXT PRIMARY KEY,
        user_id      INTEGER,
        area         REAL,
        camera_type  TEXT,
        package_id   TEXT,
        options      TEXT,
        spec         TEXT,
        total_price  REAL,
        status       TEXT DEFAULT 'new',
        status_note  TEXT,
        address      TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS prices (
        key        TEXT PRIMARY KEY,
        value      REAL NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER,
        sender     TEXT,
        text       TEXT,
        is_read    INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS logs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        level      TEXT,
        message    TEXT,
        context    TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER,
        order_id   TEXT,
        rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        text       TEXT,
        status     TEXT DEFAULT 'pending',
        is_public  INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS promo_codes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        code       TEXT UNIQUE NOT NULL,
        discount   INTEGER NOT NULL,
        type       TEXT DEFAULT 'fixed',
        max_uses   INTEGER DEFAULT 1,
        uses       INTEGER DEFAULT 0,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, err => {
        if (err) return reject(err);
        const stmt = db.prepare('INSERT OR IGNORE INTO prices (key, value) VALUES (?, ?)');
        DEFAULT_PRICES.forEach(([k, v]) => stmt.run(k, v));
        stmt.finalize(e => { if (e) return reject(e); _db = db; resolve(db); });
      });
    });
  });
}

// ─── MYSQL (legacy) ───────────────────────────────────────────────────────────
function initMySQL(url) {
  return new Promise(async (resolve, reject) => {
    const mysql = require('mysql2');
    const conn  = mysql.createConnection(url);
    conn.isPostgres = false;
    conn.isMySQL    = true;

    conn.run = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      conn.query(sql, params || [], (err, result) => {
        if (cb) cb.call({ lastID: result?.insertId, changes: result?.affectedRows }, err);
      });
    };
    conn.get = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      conn.query(sql, params || [], (err, rows) => cb && cb(err, rows?.[0] || null));
    };
    conn.all = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      conn.query(sql, params || [], (err, rows) => cb && cb(err, rows || []));
    };
    conn.serialize = fn => fn();

    // MySQL table creation omitted for brevity — same as before
    conn.query('SELECT 1', err => {
      if (err) return reject(err);
      console.log('[DB] MySQL connected');
      _db = conn; resolve(conn);
    });
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function initDb() {
  const pg  = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  const my  = process.env.MYSQL_URL     || '';
  const url = pg || my;

  if (pg && (pg.startsWith('postgres://') || pg.startsWith('postgresql://'))) {
    return initPostgres(pg);
  }
  if (my && (my.startsWith('mysql://') || my.startsWith('mysql2://'))) {
    return initMySQL(my);
  }
  return initSQLite();
}

function getDb() {
  if (!_db) throw new Error('[DB] Not initialized. Call initDb() first.');
  return _db;
}

module.exports = { initDb, getDb };
