require('dotenv').config();
const path = require('path');

let db;
let initialized = false;

/**
 * Enhanced Database Provider
 * Supporting both local SQLite and professional MySQL/Railway.app pools.
 */
const getDb = () => {
  if (db) return db;

  const mysqlHost = process.env.MYSQLHOST || process.env.MYSQL_HOST;

  if (mysqlHost) {
    const mysql = require('mysql2');

    // Connection string assembly
    const config = {
      host: mysqlHost,
      user: process.env.MYSQLUSER || process.env.MYSQL_USER,
      password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
      database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
      port: process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      ssl: {
        rejectUnauthorized: false
      }
    };

    console.log(`[DB] Initializing MySQL pool for ${config.host}...`);
    const pool = mysql.createPool(config);

    db = {
      run: (sql, params, callback) => {
        pool.query(sql, params, (err, results) => {
          if (callback) callback.call({ lastID: results ? results.insertId : null, changes: results ? results.affectedRows : 0 }, err);
        });
      },
      get: (sql, params, callback) => {
        pool.query(sql, params, (err, results) => {
          if (callback) callback(err, results ? results[0] : null);
        });
      },
      all: (sql, params, callback) => {
        pool.query(sql, params, (err, results) => {
          if (callback) callback(err, results);
        });
      },
      exec: (sql, callback) => {
        pool.query(sql, (err) => {
          if (callback) callback(err);
        });
      },
      isMySQL: true
    };
  } else {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'gaze.sqlite');
    const sqliteDb = new sqlite3.Database(dbPath);

    db = {
      run: (sql, params, callback) => sqliteDb.run(sql, params, callback),
      get: (sql, params, callback) => sqliteDb.get(sql, params, callback),
      all: (sql, params, callback) => sqliteDb.all(sql, params, callback),
      exec: (sql, callback) => sqliteDb.exec(sql, callback),
      isMySQL: false
    };
    console.log('[DB] Using SQLite for local development.');
  }
  return db;
};

const initDb = async () => {
  if (initialized) return;
  const database = getDb();
  const isMySQL = database.isMySQL;
  const autoInc = isMySQL ? 'AUTO_INCREMENT' : 'AUTOINCREMENT';
  const textType = isMySQL ? 'LONGTEXT' : 'TEXT';

  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY ${autoInc},
      tg_id BIGINT UNIQUE,
      username VARCHAR(255),
      full_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(255),
      address VARCHAR(255),
      role VARCHAR(50) DEFAULT 'user',
      is_blocked TINYINT(1) DEFAULT 0,
      block_reason ${textType},
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER,
      area INTEGER,
      camera_type VARCHAR(100),
      package_id VARCHAR(100),
      options ${textType},
      spec ${textType},
      total_price INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prices (
      \`key\` VARCHAR(100) PRIMARY KEY,
      value INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY ${autoInc},
      level VARCHAR(50),
      message ${textType},
      context ${textType},
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY ${autoInc},
      user_id INTEGER,
      sender VARCHAR(50),
      text ${textType},
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const query of queries) {
    await new Promise((resolve, reject) => {
      database.run(query, [], (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  const initialPrices = {
    cam_budget: 1490, cam_standard: 2900, cam_premium: 5900,
    dvr_budget_4: 4900, dvr_budget_8: 7900, dvr_standard_4: 8500, dvr_standard_8: 14900, dvr_standard_16: 24900,
    cable_budget: 18, install_budget: 2500, install_standard: 3500, install_premium: 4500
  };

  const insertSql = isMySQL
    ? "INSERT IGNORE INTO prices (`key`, value) VALUES (?, ?)"
    : "INSERT OR IGNORE INTO prices (key, value) VALUES (?, ?)";

  const pricePromises = Object.entries(initialPrices).map(([key, value]) => {
    return new Promise((resolve) => {
      database.run(insertSql, [key, value], () => resolve());
    });
  });

  await Promise.all(pricePromises);

  initialized = true;
  console.log('[DB] Core tables verified and ready.');
};

module.exports = { getDb, initDb };
