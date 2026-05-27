require('dotenv').config();
const path = require('path');

let db;
let initialized = false;

// Пул подключений MySQL или база SQLite
const getDb = () => {
  if (db) return db;

  if (process.env.MYSQL_URL || process.env.MYSQLHOST) {
    const mysql = require('mysql2');
    const url = process.env.MYSQL_URL || `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`;

    console.log('Попытка подключения к MySQL...');
    const pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

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
    console.log('Используется SQLite');
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

  console.log('Инициализация таблиц базы данных...');

  for (const query of queries) {
    await new Promise((resolve, reject) => {
      database.run(query, [], (err) => {
        if (err) {
          console.error('Ошибка создания таблицы:', err);
          reject(err);
        } else resolve();
      });
    });
  }

  // Сид цен
  const initialPrices = {
    cam_budget: 1490, cam_standard: 2900, cam_premium: 5900,
    dvr_budget_4: 4900, dvr_budget_8: 7900, dvr_standard_4: 8500, dvr_standard_8: 14900, dvr_standard_16: 24900, dvr_premium_4: 14900, dvr_premium_8: 24900, dvr_premium_16: 39900,
    cable_budget: 18, cable_standard: 28, cable_premium: 55,
    poe_budget_4: 1900, poe_budget_8: 3200, poe_standard_4: 3200, poe_standard_8: 5900, poe_premium_4: 5900, poe_premium_8: 9800, poe_premium_16: 16900,
    hdd_budget: 2500, hdd_standard: 3500, hdd_premium: 6500,
    install_budget: 2500, install_standard: 3500, install_premium: 4500,
    mic: 1200, courier: 1000
  };

  const insertSql = isMySQL
    ? "INSERT IGNORE INTO prices (`key`, value) VALUES (?, ?)"
    : "INSERT OR IGNORE INTO prices (key, value) VALUES (?, ?)";

  for (const [key, value] of Object.entries(initialPrices)) {
    database.run(insertSql, [key, value]);
  }

  initialized = true;
  console.log('База данных готова.');
};

module.exports = {
  getDb,
  initDb
};
