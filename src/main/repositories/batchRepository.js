class BatchRepository {
  constructor(db) {
    this.db = db;
  }

  addBatch(drugId, batchNumber, expiryDate, buyPrice, sellPrice, quantity) {
    const query = this.db.prepare(`
      INSERT INTO batches (drug_id, batch_number, expiry_date, buy_price, sell_price, quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return query.run(drugId, batchNumber, expiryDate, buyPrice, sellPrice, quantity);
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
        b.quantity AS batch_quantity
      FROM drugs d
      LEFT JOIN batches b ON d.id = b.drug_id
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