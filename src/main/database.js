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


//get all drugs from the database
function getAllDrugs() {
  const query = db.prepare(`SELECT id, brand_name, generic_name FROM drugs ORDER BY brand_name ASC`);
  return query.all();
}


// Insert new batch record
function addBatch(drug_id, batch_number, expiry_date, buy_price, sell_price, quantity) {
  const query = db.prepare(`
    INSERT INTO batches (drug_id, batch_number, expiry_date, buy_price, sell_price, quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return query.run(drug_id, batch_number, expiry_date, buy_price, sell_price, quantity);
}

initDatabase();

module.exports = {
  addDrug,
  getAllDrugs,
  addBatch
};