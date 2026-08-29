class SalesRepository {
  constructor(db) {
    this.db = db;
  }

  processSale(cartItems, totalAmount) {
    const executeSale = this.db.transaction(() => {
      const saleInsert = this.db.prepare(`INSERT INTO sales (total_amount) VALUES (?)`);
      const saleResult = saleInsert.run(totalAmount);
      const saleId = saleResult.lastInsertRowid;

      const itemInsert = this.db.prepare(`
        INSERT INTO sale_items (sale_id, batch_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `);
      const stockDeduct = this.db.prepare(`
        UPDATE batches 
        SET quantity = quantity - ? 
        WHERE id = ? AND quantity >= ?
      `);

      for (const item of cartItems) {
        const updateResult = stockDeduct.run(item.quantity, item.batch_id, item.quantity);
        if (updateResult.changes === 0) {
          throw new Error(`Insufficient stock for ${item.brand_name} (Batch: ${item.batch_number})`);
        }

        itemInsert.run(saleId, item.batch_id, item.quantity, item.sell_price, item.total_price);
      }

      return { saleId, totalAmount };
    });

    return executeSale();
  }

  getAllSales() {
    const query = this.db.prepare(`
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

  getSaleDetails(saleId) {
    const query = this.db.prepare(`
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

  clearEntireInventory() {
    const resetAll = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sale_items').run();
      this.db.prepare('DELETE FROM sales').run();
      this.db.prepare('DELETE FROM batches').run();
      this.db.prepare('DELETE FROM drugs').run();
      this.db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('drugs', 'batches', 'sales', 'sale_items')").run();
      return true;
    });

    return resetAll();
  }
}

module.exports = SalesRepository;