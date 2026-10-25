class BatchRepository {
  constructor(db) {
    this.db = db;
  }

  ensureCreatedAtColumn() {
    try {
      const batchCols = this.db.prepare(`PRAGMA table_info(batches)`).all();
      const hasCreatedAt = batchCols.some(c => c.name === 'created_at');
      if (!hasCreatedAt) {
        this.db.exec(`ALTER TABLE batches ADD COLUMN created_at TEXT;`);
        this.db.exec(`UPDATE batches SET created_at = datetime('now', 'localtime') WHERE created_at IS NULL;`);
      }
    } catch (e) {
      try {
        this.db.exec(`ALTER TABLE batches ADD COLUMN created_at TEXT;`);
        this.db.exec(`UPDATE batches SET created_at = datetime('now', 'localtime') WHERE created_at IS NULL;`);
      } catch (e2) { }
    }
  }

  addBatch(drugId, batchNumber, expiryDate, buyPrice, sellPrice, quantity, supplierId = null) {
    this.ensureCreatedAtColumn();
    try {
      const query = this.db.prepare(`
        INSERT INTO batches (drug_id, supplier_id, batch_number, expiry_date, buy_price, sell_price, quantity, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        ON CONFLICT(drug_id, batch_number) DO UPDATE SET 
          quantity = quantity + excluded.quantity,
          buy_price = excluded.buy_price,
          sell_price = excluded.sell_price,
          expiry_date = excluded.expiry_date,
          created_at = datetime('now', 'localtime')
      `);
      return query.run(drugId, supplierId, batchNumber, expiryDate, buyPrice, sellPrice, quantity);
    } catch (err) {
      if (err.message && err.message.includes('has no column named created_at')) {
        this.db.exec(`ALTER TABLE batches ADD COLUMN created_at TEXT;`);
        this.db.exec(`UPDATE batches SET created_at = datetime('now', 'localtime') WHERE created_at IS NULL;`);
        const retryQuery = this.db.prepare(`
          INSERT INTO batches (drug_id, supplier_id, batch_number, expiry_date, buy_price, sell_price, quantity, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
          ON CONFLICT(drug_id, batch_number) DO UPDATE SET 
            quantity = quantity + excluded.quantity,
            buy_price = excluded.buy_price,
            sell_price = excluded.sell_price,
            expiry_date = excluded.expiry_date,
            created_at = datetime('now', 'localtime')
        `);
        return retryQuery.run(drugId, supplierId, batchNumber, expiryDate, buyPrice, sellPrice, quantity);
      }
      // Fallback if ON CONFLICT is not supported on this table schema
      const fallbackQuery = this.db.prepare(`
        INSERT INTO batches (drug_id, supplier_id, batch_number, expiry_date, buy_price, sell_price, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      return fallbackQuery.run(drugId, supplierId, batchNumber, expiryDate, buyPrice, sellPrice, quantity);
    }
  }

  getTodayInwardStats() {
    this.ensureCreatedAtColumn();
    try {
      const todayRow = this.db.prepare(`
        SELECT 
          COUNT(*) AS total_items,
          COALESCE(SUM(quantity), 0) AS total_quantity
        FROM batches
        WHERE date(created_at, 'localtime') = date('now', 'localtime')
      `).get();

      const yesterdayRow = this.db.prepare(`
        SELECT 
          COUNT(*) AS total_items,
          COALESCE(SUM(quantity), 0) AS total_quantity
        FROM batches
        WHERE date(created_at, 'localtime') = date('now', 'localtime', '-1 day')
      `).get();

      const todayItems = todayRow ? (todayRow.total_items || 0) : 0;
      const todayQty = todayRow ? (todayRow.total_quantity || 0) : 0;
      const yesterdayItems = yesterdayRow ? (yesterdayRow.total_items || 0) : 0;
      const diff = todayItems - yesterdayItems;

      let trendText = `${diff >= 0 ? '+' : ''}${diff} from yesterday`;
      if (diff > 0) {
        trendText = `↑ +${diff} from yesterday`;
      } else if (diff < 0) {
        trendText = `↓ ${diff} from yesterday`;
      } else {
        trendText = `― 0 from yesterday`;
      }

      return {
        today_items: todayItems,
        today_quantity: todayQty,
        yesterday_items: yesterdayItems,
        diff: diff,
        trend_text: trendText
      };
    } catch (err) {
      console.error('Error fetching today inward stats:', err);
      return {
        today_items: 0,
        today_quantity: 0,
        yesterday_items: 0,
        diff: 0,
        trend_text: '0 from yesterday'
      };
    }
  }

  getInventoryOverview() {
    const query = this.db.prepare(`
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
        b.quantity AS batch_quantity,
        s.supplier_name
      FROM drugs d
      JOIN batches b ON d.id = b.drug_id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      GROUP BY d.id, b.id
      ORDER BY d.brand_name ASC, b.expiry_date ASC
    `);
    return query.all();
  }

  getAvailableStock() {
    const query = this.db.prepare(`
      SELECT 
        b.id AS batch_id,
        b.batch_number,
        b.expiry_date,
        b.buy_price,
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
}

module.exports = BatchRepository;