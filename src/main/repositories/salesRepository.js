class SalesRepository {
  constructor(db) {
    this.db = db;
  }

  processSale(cartItems, totalAmount, discount = 0) {
    const executeSale = this.db.transaction(() => {
      const discountVal = parseFloat(discount) || 0;

      // 1. Get current active shift
      const activeShift = this.db.prepare(`SELECT id FROM till_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1`).get();
      const currentShiftId = activeShift ? activeShift.id : null;

      // 2. Determine shift_invoice_no for this specific shift
      let nextShiftInvoiceNo = 1;
      if (currentShiftId) {
        const lastInvoice = this.db.prepare(`
          SELECT COALESCE(MAX(shift_invoice_no), 0) + 1 AS next_no 
          FROM sales 
          WHERE shift_id = ?
        `).get(currentShiftId);
        nextShiftInvoiceNo = lastInvoice ? lastInvoice.next_no : 1;
      } else {
        const lastInvoice = this.db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS next_no FROM sales`).get();
        nextShiftInvoiceNo = lastInvoice ? lastInvoice.next_no : 1;
      }

      const saleInsert = this.db.prepare(`
        INSERT INTO sales (shift_id, shift_invoice_no, total_amount, discount, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      const saleResult = saleInsert.run(currentShiftId, nextShiftInvoiceNo, totalAmount, discountVal);
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

      return {
        saleId,
        shiftId: currentShiftId,
        invoiceNo: nextShiftInvoiceNo,
        totalAmount,
        discount: discountVal
      };
    });

    return executeSale();
  }

  getAllSales() {
    const query = this.db.prepare(`
      SELECT 
        s.id AS sale_id,
        s.total_amount,
        COALESCE(s.discount, 0) AS discount,
        COALESCE(s.shift_invoice_no, s.id) AS invoice_no,
        s.shift_id,
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
        s.total_amount AS sale_net_total,
        COALESCE(s.shift_invoice_no, s.id) AS invoice_no,
        s.shift_id
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN batches b ON si.batch_id = b.id
      LEFT JOIN drugs d ON b.drug_id = d.id
      WHERE si.sale_id = ?
    `;
    return this.db.prepare(query).all(saleId);
  }

  // ==================== TILL / SHIFT MANAGEMENT ====================
  getActiveShift() {
    return this.db.prepare(`
      SELECT 
        id, 
        datetime(opened_at, 'localtime') AS opened_at, 
        opening_float, 
        status 
      FROM till_shifts 
      WHERE status = 'OPEN' 
      ORDER BY id DESC LIMIT 1
    `).get();
  }

  openShift(openingFloat) {
    const existing = this.getActiveShift();
    if (existing) {
      throw new Error(`A shift is already open (#${existing.id} opened at ${existing.opened_at}). Close it first.`);
    }

    const floatVal = Math.max(0, parseFloat(openingFloat) || 0);
    const stmt = this.db.prepare(`
      INSERT INTO till_shifts (opening_float, status, opened_at)
      VALUES (?, 'OPEN', CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(floatVal);
    return { shiftId: info.lastInsertRowid, opening_float: floatVal };
  }

  getCurrentShiftLiveStats(shiftId) {
    const shift = this.db.prepare(`SELECT * FROM till_shifts WHERE id = ?`).get(shiftId);
    if (!shift) throw new Error('Shift not found');

    const stats = this.db.prepare(`
      SELECT 
        COUNT(id) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COALESCE(SUM(discount), 0) AS total_discounts
      FROM sales
      WHERE shift_id = ?
    `).get(shiftId);

    const expectedCash = shift.opening_float + stats.total_sales;

    const localTimes = this.db.prepare(`
      SELECT 
        datetime(opened_at, 'localtime') AS local_opened,
        datetime(closed_at, 'localtime') AS local_closed
      FROM till_shifts WHERE id = ?
    `).get(shiftId);

    return {
      shiftId: shift.id,
      opened_at: localTimes?.local_opened || shift.opened_at,
      closed_at: localTimes?.local_closed || shift.closed_at,
      opening_float: shift.opening_float,
      total_orders: stats.total_orders,
      total_sales: stats.total_sales,
      total_discounts: stats.total_discounts,
      expected_cash: expectedCash,
      status: shift.status
    };
  }

  closeShift(shiftId, actualCash, note = '') {
    const shift = this.db.prepare(`SELECT * FROM till_shifts WHERE id = ? AND status = 'OPEN'`).get(shiftId);
    if (!shift) throw new Error('Active shift not found or already closed.');

    const stats = this.db.prepare(`
      SELECT 
        COUNT(id) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COALESCE(SUM(discount), 0) AS total_discounts
      FROM sales
      WHERE shift_id = ?
    `).get(shiftId);

    const countedCash = Math.max(0, parseFloat(actualCash) || 0);
    const expectedCash = shift.opening_float + stats.total_sales;
    const variance = countedCash - expectedCash;

    const closeTx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE till_shifts
        SET closed_at = CURRENT_TIMESTAMP,
            total_sales = ?,
            total_orders = ?,
            total_discounts = ?,
            expected_cash = ?,
            actual_cash = ?,
            variance = ?,
            note = ?,
            status = 'CLOSED'
        WHERE id = ?
      `).run(
        stats.total_sales,
        stats.total_orders,
        stats.total_discounts,
        expectedCash,
        countedCash,
        variance,
        note,
        shiftId
      );

      const localTimes = this.db.prepare(`
        SELECT 
          datetime(opened_at, 'localtime') AS local_opened,
          datetime(closed_at, 'localtime') AS local_closed
        FROM till_shifts WHERE id = ?
      `).get(shiftId);

      return {
        shiftId,
        opened_at: localTimes?.local_opened || shift.opened_at,
        closed_at: localTimes?.local_closed || new Date().toLocaleString(),
        opening_float: shift.opening_float,
        total_orders: stats.total_orders,
        total_sales: stats.total_sales,
        total_discounts: stats.total_discounts,
        expected_cash: expectedCash,
        actual_cash: countedCash,
        variance,
        note
      };
    });

    return closeTx();
  }

  getAllShifts() {
    return this.db.prepare(`
      SELECT 
        id,
        datetime(opened_at, 'localtime') AS opened_at,
        datetime(closed_at, 'localtime') AS closed_at,
        opening_float,
        total_sales,
        total_orders,
        total_discounts,
        expected_cash,
        actual_cash,
        variance,
        status,
        note
      FROM till_shifts
      ORDER BY id DESC
    `).all();
  }

  clearEntireInventory() {
    const resetAll = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sale_items').run();
      this.db.prepare('DELETE FROM sales').run();
      this.db.prepare('DELETE FROM batches').run();
      this.db.prepare('DELETE FROM drugs').run();
      this.db.prepare('DELETE FROM till_shifts').run();
      this.db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('drugs', 'batches', 'sales', 'sale_items', 'till_shifts')").run();
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
      this.db.prepare('DELETE FROM till_shifts').run();
      this.db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('sales', 'sale_items', 'till_shifts')").run();
      return true;
    });

    return transaction();
  }

  updateSale(saleId, newItems, totalAmount, discount = 0) {
    const updateTx = this.db.transaction(() => {
      const discountVal = parseFloat(discount) || 0;

      // 1. Restore previous stock for batches that still exist in the database
      const oldItems = this.db.prepare(`SELECT batch_id, quantity FROM sale_items WHERE sale_id = ?`).all(saleId);
      const checkBatchExists = this.db.prepare(`SELECT id FROM batches WHERE id = ?`);
      const restoreStock = this.db.prepare(`UPDATE batches SET quantity = quantity + ? WHERE id = ?`);

      for (const old of oldItems) {
        if (old.batch_id) {
          const exists = checkBatchExists.get(old.batch_id);
          if (exists) {
            restoreStock.run(old.quantity, old.batch_id);
          }
        }
      }

      // 2. Clear old line items and update sale headers
      this.db.prepare(`DELETE FROM sale_items WHERE sale_id = ?`).run(saleId);
      this.db.prepare(`UPDATE sales SET total_amount = ?, discount = ? WHERE id = ?`).run(totalAmount, discountVal, saleId);

      const insertItem = this.db.prepare(`
        INSERT INTO sale_items (sale_id, batch_id, drug_name, batch_number, buy_price, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const deductStock = this.db.prepare(`
        UPDATE batches 
        SET quantity = quantity - ? 
        WHERE id = ? AND quantity >= ?
      `);

      // 3. Deduct updated stock and insert replacement items
      for (const item of newItems) {
        const buyPrice = parseFloat(item.buy_price) || 0;
        const sellPrice = parseFloat(item.sell_price) || 0;
        const qty = parseInt(item.quantity, 10) || 1;

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
          finalBatchId || null,
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