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
      batch_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
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


// Fetch inventory details
function getInventoryOverview() {
  const query = db.prepare(`
    SELECT 
      d.id AS drug_id,
      d.brand_name,
      d.generic_name,
      d.category,
      d.min_stock_alert,
      COALESCE(SUM(b.quantity), 0) AS total_stock,
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.buy_price,
      b.sell_price,
      b.quantity AS batch_quantity
    FROM drugs d
    LEFT JOIN batches b ON d.id = b.drug_id
    GROUP BY d.id, b.id
    ORDER BY d.brand_name ASC, b.expiry_date ASC
  `);
  return query.all();
}


// Fetch active batches with available stock sorted by earliest expiry
function getAvailableStock() {
  const query = db.prepare(`
    SELECT 
      b.id AS batch_id,
      b.batch_number,
      b.expiry_date,
      b.sell_price,
      b.quantity AS available_qty,
      d.id AS drug_id,
      d.brand_name,
      d.generic_name
    FROM batches b
    JOIN drugs d ON b.drug_id = d.id
    WHERE b.quantity > 0
    ORDER BY d.brand_name ASC, b.expiry_date ASC
  `);
  return query.all();
}


// Atomic Checkout Transaction
function processSale(cartItems, totalAmount) {
  const executeSale = db.transaction(() => {
    // 1. Insert Sales Header
    const saleInsert = db.prepare(`INSERT INTO sales (total_amount) VALUES (?)`);
    const saleResult = saleInsert.run(totalAmount);
    const saleId = saleResult.lastInsertRowid;

    // Prepared statements for loop
    const itemInsert = db.prepare(`
      INSERT INTO sale_items (sale_id, batch_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?)
    `);
    const stockDeduct = db.prepare(`
      UPDATE batches 
      SET quantity = quantity - ? 
      WHERE id = ? AND quantity >= ?
    `);

    // 2. Process each cart item
    for (const item of cartItems) {
      // Deduct stock safely
      const updateResult = stockDeduct.run(item.quantity, item.batch_id, item.quantity);
      if (updateResult.changes === 0) {
        throw new Error(`Insufficient stock for ${item.brand_name} (Batch: ${item.batch_number})`);
      }

      // Record line item
      itemInsert.run(saleId, item.batch_id, item.quantity, item.sell_price, item.total_price);
    }

    return { saleId, totalAmount };
  });

  return executeSale();
}


// Get summary list of all sales
function getAllSales() {
  const query = db.prepare(`
    SELECT 
      s.id AS sale_id,
      s.total_amount,
      datetime(s.created_at, 'localtime') AS sale_date,
      COUNT(si.id) AS item_count
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    GROUP BY s.id
    ORDER BY s.id DESC
  `);
  return query.all();
}


// Get line items for a specific receipt modal
function getSaleDetails(saleId) {
  const query = db.prepare(`
    SELECT 
      si.id,
      si.quantity,
      si.unit_price,
      si.total_price,
      b.batch_number,
      d.brand_name,
      d.generic_name
    FROM sale_items si
    JOIN batches b ON si.batch_id = b.id
    JOIN drugs d ON b.drug_id = d.id
    WHERE si.sale_id = ?
  `);
  return query.all(saleId);
}




// Analytics: Key KPI summary metrics
function getSalesKPIs() {
  const today = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS today_revenue, COUNT(id) AS today_orders
    FROM sales 
    WHERE date(created_at, 'localtime') = date('now', 'localtime')
  `).get();

  const month = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS month_revenue, COUNT(id) AS month_orders
    FROM sales 
    WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
  `).get();

  const total = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS all_time_revenue, COUNT(id) AS all_time_orders
    FROM sales
  `).get();

  return { today, month, total };
}

// Analytics: Last 7 days breakdown
function getDailySalesAnalytics() {
  const query = db.prepare(`
    SELECT 
      date(created_at, 'localtime') AS period,
      COALESCE(SUM(total_amount), 0) AS total_revenue
    FROM sales
    WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-6 days')
    GROUP BY date(created_at, 'localtime')
    ORDER BY date(created_at, 'localtime') ASC
  `);
  return query.all();
}

// Analytics: Weekly breakdown (last 8 weeks)
function getWeeklySalesAnalytics() {
  const query = db.prepare(`
    SELECT 
      strftime('%Y-W%W', created_at, 'localtime') AS period,
      COALESCE(SUM(total_amount), 0) AS total_revenue
    FROM sales
    WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-56 days')
    GROUP BY strftime('%Y-W%W', created_at, 'localtime')
    ORDER BY period ASC
  `);
  return query.all();
}

// Analytics: Monthly breakdown (last 6 months)
function getMonthlySalesAnalytics() {
  const query = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at, 'localtime') AS period,
      COALESCE(SUM(total_amount), 0) AS total_revenue
    FROM sales
    WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-180 days')
    GROUP BY strftime('%Y-%m', created_at, 'localtime')
    ORDER BY period ASC
  `);
  return query.all();
}


//Low stock count / Expired / Expiring within 30 days count
function getStockAlertsSummary() {
  // Low stock count (drugs where total stock <= min_stock_alert)
  const lowStock = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT d.id, d.min_stock_alert, COALESCE(SUM(b.quantity), 0) as total_qty
      FROM drugs d
      LEFT JOIN batches b ON d.id = b.drug_id
      GROUP BY d.id
      HAVING total_qty <= d.min_stock_alert
    )
  `).get();

  // Expired / Expiring within 30 days count
  const expiringSoon = db.prepare(`
    SELECT COUNT(*) as count 
    FROM batches 
    WHERE quantity > 0 AND date(expiry_date) <= date('now', '+30 days')
  `).get();

  return {
    lowStockCount: lowStock.count,
    expiringCount: expiringSoon.count
  };
}


// Clear entire inventory
function clearEntireInventory() {
  const resetAll = db.transaction(() => {
    // Delete in order to respect foreign key constraints
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM batches').run();
    db.prepare('DELETE FROM drugs').run();

    // Reset sqlite auto-increment sequences back to 0/1
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('drugs', 'batches', 'sales', 'sale_items')").run();

    return true;
  });

  return resetAll();
}


initDatabase();

module.exports = {
  addDrug,
  getAllDrugs,
  addBatch,
  getInventoryOverview,
  getAvailableStock,
  processSale,
  getAllSales,
  getSaleDetails,
  getSalesKPIs,
  getDailySalesAnalytics,
  getWeeklySalesAnalytics,
  getMonthlySalesAnalytics,
  getStockAlertsSummary,
  clearEntireInventory
};