class SalesRepository {
  constructor(db) {
    this.db = db;
  }

  processSale(cartItems, totalAmount, discount = 0) {
    const executeSale = this.db.transaction(() => {
      const discountVal = parseFloat(discount) || 0;
      const saleInsert = this.db.prepare(`INSERT INTO sales (total_amount, discount) VALUES (?, ?)`);
      const saleResult = saleInsert.run(totalAmount, discountVal);
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

      return { saleId, totalAmount, discount: discountVal };
    });

    return executeSale();
  }

  getAllSales() {
    const query = this.db.prepare(`
      SELECT 
        s.id AS sale_id,
        s.total_amount,
        COALESCE(s.discount, 0) AS discount,
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
    const query = `
      SELECT 
        si.id,
        si.batch_id,
        si.buy_price,
        si.quantity,
        si.unit_price,
        si.total_price,
        COALESCE(si.batch_number, b.batch_number, 'N/A') AS batch_number,
        COALESCE(si.drug_name, d.brand_name, 'Deleted Medicine') AS brand_name,
        COALESCE(d.generic_name, '') AS generic_name,
        COALESCE(s.discount, 0) AS sale_discount,
        s.total_amount AS sale_net_total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN drugs d ON b.drug_id = d.id
      WHERE si.sale_id = ?
    `;
    return this.db.prepare(query).all(saleId);
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

  updateSale(saleId, newItems, totalAmount, discount = 0) {
    const updateTx = this.db.transaction(() => {
      const discountVal = parseFloat(discount) || 0;

      // 1. Fetch old sale items to restore stock to active batches
      const oldItems = this.db.prepare(`SELECT batch_id, quantity FROM sale_items WHERE sale_id = ?`).all(saleId);
      const restoreStock = this.db.prepare(`UPDATE batches SET quantity = quantity + ? WHERE id = ?`);

      for (const old of oldItems) {
        if (old.batch_id) {
          restoreStock.run(old.quantity, old.batch_id);
        }
      }

      // 2. Clear old sale items
      this.db.prepare(`DELETE FROM sale_items WHERE sale_id = ?`).run(saleId);

      // 3. Update parent sales table total & discount
      this.db.prepare(`UPDATE sales SET total_amount = ?, discount = ? WHERE id = ?`).run(totalAmount, discountVal, saleId);

      // 4. Insert updated sale items & deduct new stock
      const insertItem = this.db.prepare(`
        INSERT INTO sale_items (sale_id, batch_id, drug_name, batch_number, buy_price, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const deductStock = this.db.prepare(`
        UPDATE batches 
        SET quantity = quantity - ? 
        WHERE id = ? AND quantity >= ?
      `);

      for (const item of newItems) {
        const buyPrice = parseFloat(item.buy_price) || 0;
        const sellPrice = parseFloat(item.sell_price) || 0;
        const qty = parseInt(item.quantity, 10) || 1;

        // If batch_id was missing, try looking it up by batch_number
        let finalBatchId = item.batch_id;
        if (!finalBatchId && item.batch_number) {
          const found = this.db.prepare(`SELECT id, buy_price FROM batches WHERE batch_number = ?`).get(item.batch_number);
          if (found) {
            finalBatchId = found.id;
          }
        }

        if (finalBatchId) {
          const deductRes = deductStock.run(qty, finalBatchId, qty);
          if (deductRes.changes === 0) {
            throw new Error(`Insufficient stock for ${item.brand_name} (Batch: ${item.batch_number})`);
          }
        }

        insertItem.run(
          saleId,
          finalBatchId || 0,
          item.brand_name,
          item.batch_number || 'N/A',
          buyPrice,
          qty,
          sellPrice,
          item.total_price || (qty * sellPrice)
        );
      }

      return { saleId, totalAmount, discount: discountVal };
    });

    return updateTx();
  }
}

module.exports = SalesRepository;