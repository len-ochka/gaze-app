require('dotenv').config();
const path = require('path');

let db;

if (process.env.MYSQL_URL || process.env.MYSQLHOST) {
  // MySQL configuration (for Railway.app)
  const mysql = require('mysql2');
  const url = process.env.MYSQL_URL || `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`;

  const pool = mysql.createPool(url);

  // Wrapper to match sqlite3 API roughly
  db = {
    run: (sql, params, callback) => {
      // Convert SQLite's '?' to MySQL's '?' (same)
      // Convert 'INSERT OR REPLACE' to 'REPLACE INTO' if needed, but better handle in index.js
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

  console.log('Using MySQL database');
} else {
  // SQLite configuration (Local)
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'gaze.sqlite');
  const sqliteDb = new sqlite3.Database(dbPath);

  db = {
    run: (sql, params, callback) => sqliteDb.run(sql, params, callback),
    get: (sql, params, callback) => sqliteDb.get(sql, params, callback),
    all: (sql, params, callback) => sqliteDb.all(sql, params, callback),
    exec: (sql, callback) => sqliteDb.exec(sql, callback),
    serialize: (cb) => sqliteDb.serialize(cb),
    prepare: (sql) => sqliteDb.prepare(sql),
    isMySQL: false
  };
  console.log('Using SQLite database');
}

// Initialization logic
const initDb = () => {
  const isMySQL = db.isMySQL;
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

  // Execute each query
  const executeSequentially = (index) => {
    if (index < queries.length) {
      db.run(queries[index], [], (err) => {
        if (err) console.error('Error creating table:', err);
        executeSequentially(index + 1);
      });
    } else {
      seedPrices();
    }
  };

  const seedPrices = () => {
    const initialPrices = {
      cam_budget: 1490, cam_standard: 2900, cam_premium: 5900,
      dvr_budget_4: 4900, dvr_budget_8: 7900, dvr_standard_4: 8500, dvr_standard_8: 14900, dvr_standard_16: 24900, dvr_premium_4: 14900, dvr_premium_8: 24900, dvr_premium_16: 39900,
      cable_budget: 18, cable_standard: 28, cable_premium: 55,
      poe_budget_4: 1900, poe_budget_8: 3200, poe_standard_4: 3200, poe_standard_8: 5900, poe_premium_4: 5900, poe_premium_8: 9800, poe_premium_16: 16900,
      hdd_budget: 2500, hdd_standard: 3500, hdd_premium: 6500,
      install_budget: 1500, install_standard: 2500, install_premium: 4000,
      mic: 890, courier: 500
    };

    const insertSql = isMySQL
      ? "INSERT IGNORE INTO prices (\`key\`, value) VALUES (?, ?)"
      : "INSERT OR IGNORE INTO prices (key, value) VALUES (?, ?)";

    for (const [key, value] of Object.entries(initialPrices)) {
      db.run(insertSql, [key, value]);
    }
  };

  executeSequentially(0);
};

initDb();

module.exports = db;
