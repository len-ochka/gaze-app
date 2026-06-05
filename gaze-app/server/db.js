'use strict';

/**
 * GAZE — Database layer
 * Supports SQLite (local/Railway) and MySQL (if DATABASE_URL set).
 */

const path = require('path');

let _db = null;

// ─── DEFAULT PRICES ──────────────────────────────────────────────────────────
const DEFAULT_PRICES = [
  // Пакеты (базовая цена за камеру)
  ['pkg_budget_cam',      2200],
  ['pkg_standard_cam',    4500],
  ['pkg_premium_cam',     9800],
  // Видеорегистраторы (NVR)
  ['nvr_4ch',             4500],
  ['nvr_8ch',             7200],
  ['nvr_16ch',           12500],
  // HDD
  ['hdd_1tb',             3200],
  ['hdd_2tb',             5500],
  ['hdd_4tb',             9200],
  // Монтаж
  ['install_per_cam',     1800],
  ['cable_per_meter',       35],
  ['install_base',         3500],
  // Интернет
  ['internet_router',     3200],
  ['internet_4g_monthly',  900],
  // Дополнительно
  ['ups',                 2800],
  ['poe_switch_8p',       3600],
  ['poe_switch_16p',      6200],
  // Профессиональные камеры
  ['pro_cam_2mp_bullet',  2800],
  ['pro_cam_4mp_dome',    4200],
  ['pro_cam_8mp_bullet',  8900],
  ['pro_cam_ptz',        14500],
  ['pro_nvr_4ch',         4500],
  ['pro_nvr_8ch',         7200],
  ['pro_nvr_16ch',       12500],
  ['pro_hdd_2tb',         5500],
  ['pro_hdd_4tb',         9200],
  // Скидки
  ['discount_standard',    500],
  ['discount_premium',    1500],
];

// ─── SQLITE ───────────────────────────────────────────────────────────────────
function initSQLite() {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'gaze.sqlite');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      console.log('[DB] SQLite connected:', dbPath);
    });

    db.isMySQL = false;

    // Обёртки для единообразного API
    const _run  = db.run.bind(db);
    const _get  = db.get.bind(db);
    const _all  = db.all.bind(db);

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
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS logs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        level      TEXT,
        message    TEXT,
        context    TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);

        // Seed default prices
        const stmt = db.prepare(
          'INSERT OR IGNORE INTO prices (key, value) VALUES (?, ?)'
        );
        DEFAULT_PRICES.forEach(([k, v]) => stmt.run(k, v));
        stmt.finalize((e) => {
          if (e) return reject(e);
          _db = db;
          resolve(db);
        });
      });
    });
  });
}

// ─── MYSQL ────────────────────────────────────────────────────────────────────
function initMySQL(url) {
  return new Promise(async (resolve, reject) => {
    const mysql = require('mysql2');
    const conn = mysql.createConnection(url);

    conn.isMySQL = true;

    // Wrap to sqlite3-compatible callback API
    conn.run = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      conn.query(sql, params || [], (err, result) => {
        if (cb) cb.call({ lastID: result?.insertId, changes: result?.affectedRows }, err);
      });
    };
    conn.get = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      conn.query(sql, params || [], (err, rows) => {
        if (cb) cb(err, rows?.[0] || null);
      });
    };
    conn.all = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      conn.query(sql, params || [], (err, rows) => {
        if (cb) cb(err, rows || []);
      });
    };
    conn.prepare = () => ({
      run: () => {}, finalize: (cb) => cb && cb()
    });
    conn.serialize = (fn) => fn();

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        tg_id         BIGINT UNIQUE,
        username      VARCHAR(128),
        full_name     VARCHAR(256),
        email         VARCHAR(256),
        phone         VARCHAR(32),
        address       TEXT,
        role          VARCHAR(16) DEFAULT 'user',
        referral_code VARCHAR(32) UNIQUE,
        invited_by    BIGINT,
        bonus_balance INT DEFAULT 0,
        order_count   INT DEFAULT 0,
        is_blocked    TINYINT DEFAULT 0,
        block_reason  TEXT,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id           VARCHAR(64) PRIMARY KEY,
        user_id      INT,
        area         FLOAT,
        camera_type  VARCHAR(32),
        package_id   VARCHAR(32),
        options      TEXT,
        spec         TEXT,
        total_price  FLOAT,
        status       VARCHAR(32) DEFAULT 'new',
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS prices (
        \`key\`     VARCHAR(64) PRIMARY KEY,
        value      FLOAT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT,
        sender     VARCHAR(16),
        text       TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS logs (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        level      VARCHAR(16),
        message    TEXT,
        context    TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    try {
      for (const sql of tables) {
        await new Promise((res, rej) =>
          conn.query(sql, (e) => e ? rej(e) : res())
        );
      }

      // Seed prices
      for (const [k, v] of DEFAULT_PRICES) {
        await new Promise((res) =>
          conn.query(
            'INSERT IGNORE INTO prices (`key`, value) VALUES (?, ?)',
            [k, v],
            () => res()
          )
        );
      }

      console.log('[DB] MySQL connected and tables ready');
      _db = conn;
      resolve(conn);
    } catch (e) {
      reject(e);
    }
  });
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
async function initDb() {
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || '';
  if (dbUrl && (dbUrl.startsWith('mysql://') || dbUrl.startsWith('mysql2://'))) {
    return initMySQL(dbUrl);
  }
  return initSQLite();
}

function getDb() {
  if (!_db) throw new Error('[DB] Database not initialized. Call initDb() first.');
  return _db;
}

module.exports = { initDb, getDb };
