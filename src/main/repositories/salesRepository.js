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
        INSERT INTO sale_items (sale_id, batch_id, drug_name, batch_number, buy_price, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

        const buyPrice = parseFloat(item.buy_price) || 0;
        const sellPrice = parseFloat(item.sell_price) || 0;
        const qty = parseInt(item.quantity, 10) || 1;

        itemInsert.run(
          saleId,
          item.batch_id,
          item.brand_name,
          item.batch_number,
          buyPrice,
          qty,
          sellPrice,
          item.total_price || (qty * sellPrice)
        );
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
        COALESCE(si.batch_number, b.batch_number, 'N/A') AS batch_number,
        COALESCE(si.drug_name, d.brand_name, 'Deleted Medicine') AS brand_name,
        COALESCE(d.generic_name, '') AS generic_name
      FROM sale_items si
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN drugs d ON b.drug_id = d.id
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

  deleteSaleById(saleId) {
    const deleteSaleItems = this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?');
    const deleteSale = this.db.prepare('DELETE FROM sales WHERE id = ?');

    const transaction = this.db.transaction(() => {
      deleteSaleItems.run(saleId);
      const res = deleteSale.run(saleId);
      return res.changes > 0;
    });

    return transaction();
  }

  deleteAllSales() {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sale_items').run();
      this.db.prepare('DELETE FROM sales').run();
      this.db.prepare("DELETE FROM sqlite_sequence WHERE name = 'sales' OR name = 'sale_items'").run();
      return true;
    });

    return transaction();
  }
}

module.exports = SalesRepository;