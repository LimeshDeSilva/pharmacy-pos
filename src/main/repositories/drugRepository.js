class DrugRepository {
  constructor(db) {
    this.db = db;
  }

  addDrug(brandName, genericName, category, minStockAlert) {
    const query = this.db.prepare(`
      INSERT INTO drugs (brand_name, generic_name, category, min_stock_alert)
      VALUES (?, ?, ?, ?)
    `);
    return query.run(brandName, genericName, category, minStockAlert);
  }

  getAllDrugs() {
    const query = this.db.prepare(`SELECT id, brand_name, generic_name FROM drugs ORDER BY brand_name ASC`);
    return query.all();
  }

  deleteMedicineKeepSales(drugId) {
    const runTransaction = this.db.transaction(() => {
      const batches = this.db.prepare('SELECT id FROM batches WHERE drug_id = ?').all(drugId);
      const batchIds = batches.map(b => b.id);

      if (batchIds.length > 0) {
        const placeholders = batchIds.map(() => '?').join(',');
        this.db.prepare(`DELETE FROM batches WHERE id IN (${placeholders})`).run(...batchIds);
      }

      const res = this.db.prepare(`DELETE FROM drugs WHERE id = ?`).run(drugId);
      return res.changes > 0;
    });

    try {
      this.db.pragma('foreign_keys = OFF');
      const result = runTransaction();
      this.db.pragma('foreign_keys = ON');
      return result;
    } catch (err) {
      this.db.pragma('foreign_keys = ON');
      throw err;
    }
  }

  deleteAllMedicinesKeepSales() {
    const runTransaction = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM batches`).run();
      this.db.prepare(`DELETE FROM drugs`).run();
      this.db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('drugs', 'batches')`).run();
      return true;
    });

    try {
      this.db.pragma('foreign_keys = OFF');
      const result = runTransaction();
      this.db.pragma('foreign_keys = ON');
      return result;
    } catch (err) {
      this.db.pragma('foreign_keys = ON');
      throw err;
    }
  }

  updateInventoryItem(data) {
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE drugs
        SET brand_name = ?, generic_name = ?, category = ?, min_stock_alert = ?
        WHERE id = ?
      `).run(data.brand_name, data.generic_name, data.category, data.min_stock_alert, data.drug_id);

      if (data.batch_id) {
        this.db.prepare(`
          UPDATE batches
          SET batch_number = ?, expiry_date = ?, buy_price = ?, sell_price = ?, quantity = ?
          WHERE id = ?
        `).run(data.batch_number, data.expiry_date, data.buy_price, data.sell_price, data.quantity, data.batch_id);
      }
    });

    return tx();
  }
}

module.exports = DrugRepository;