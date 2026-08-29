const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../../pharmacy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_name TEXT NOT NULL UNIQUE,
      generic_name TEXT,
      category TEXT,
      min_stock_alert INTEGER DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE CASCADE,
      UNIQUE(drug_id, batch_number)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      batch_id INTEGER,
      drug_name TEXT,
      batch_number TEXT,
      buy_price REAL DEFAULT 0,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES 
      ('pharmacy_name', 'NEW SAHASNA PHARMACY'),
      ('pharmacy_address', 'No.514, Walagedara, Balapitiya'),
      ('pharmacy_phone', '077-6723395');
  `);

  // Migrations for existing databases
  try { db.exec(`ALTER TABLE sale_items ADD COLUMN drug_name TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE sale_items ADD COLUMN batch_number TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE sale_items ADD COLUMN buy_price REAL DEFAULT 0;`); } catch (e) {}

  // Backfill existing sales records with correct buy prices from active batches
  try {
    db.exec(`
      UPDATE sale_items 
      SET buy_price = (SELECT buy_price FROM batches WHERE batches.id = sale_items.batch_id)
      WHERE (buy_price IS NULL OR buy_price = 0) AND batch_id IS NOT NULL;
    `);
  } catch (e) {}
}

initDatabase();

module.exports = db;