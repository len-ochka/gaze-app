const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'gaze.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER UNIQUE,
    username TEXT,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    role TEXT DEFAULT 'user',
    is_blocked INTEGER DEFAULT 0,
    block_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    area INTEGER,
    camera_type TEXT,
    package_id TEXT,
    options TEXT,
    spec TEXT,
    total_price INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Prices table (cache for provider prices)
  db.run(`CREATE TABLE IF NOT EXISTS prices (
    key TEXT PRIMARY KEY,
    value INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Logs table
  db.run(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    message TEXT,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Support messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    sender TEXT,
    text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Seed initial prices if not exists
  const initialPrices = {
    cam_budget: 1490, cam_standard: 2900, cam_premium: 5900,
    dvr_budget_4: 4900, dvr_budget_8: 7900, dvr_standard_4: 8500, dvr_standard_8: 14900, dvr_standard_16: 24900, dvr_premium_4: 14900, dvr_premium_8: 24900, dvr_premium_16: 39900,
    cable_budget: 18, cable_standard: 28, cable_premium: 55,
    poe_budget_4: 1900, poe_budget_8: 3200, poe_standard_4: 3200, poe_standard_8: 5900, poe_premium_4: 5900, poe_premium_8: 9800, poe_premium_16: 16900,
    hdd_budget: 2500, hdd_standard: 3500, hdd_premium: 6500,
    install_budget: 1500, install_standard: 2500, install_premium: 4000,
    mic: 890, courier: 500
  };

  const stmt = db.prepare("INSERT OR IGNORE INTO prices (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(initialPrices)) {
    stmt.run(key, value);
  }
  stmt.finalize();
});

module.exports = db;
