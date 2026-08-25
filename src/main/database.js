const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../pharmacy.db');
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
  `);
}

function addDrug(brand_name, generic_name, category, min_stock_alert) {
  const query = db.prepare(`
    INSERT INTO drugs (brand_name, generic_name, category, min_stock_alert)
    VALUES (?, ?, ?, ?)
  `);
  return query.run(brand_name, generic_name, category, min_stock_alert);
}

initDatabase();

module.exports = {
  addDrug
};