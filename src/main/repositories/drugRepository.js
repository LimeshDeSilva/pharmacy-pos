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
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE sale_items 
        SET batch_id = NULL 
        WHERE batch_id IN (SELECT id FROM batches WHERE drug_id = ?)
      `).run(drugId);

      this.db.prepare(`DELETE FROM batches WHERE drug_id = ?`).run(drugId);
      const res = this.db.prepare(`DELETE FROM drugs WHERE id = ?`).run(drugId);
      return res.changes > 0;
    });

    return transaction();
  }

  deleteAllMedicinesKeepSales() {
    const transaction = this.db.transaction(() => {
      this.db.prepare(`UPDATE sale_items SET batch_id = NULL`).run();
      this.db.prepare(`DELETE FROM batches`).run();
      this.db.prepare(`DELETE FROM drugs`).run();
      this.db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('drugs', 'batches')`).run();
      return true;
    });

    return transaction();
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