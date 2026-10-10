class SupplierRepository {
  constructor(db) {
    this.db = db;
  }

  getAllSuppliers() {
    return this.db.prepare(`SELECT * FROM suppliers ORDER BY supplier_name ASC`).all();
  }

  addSupplier(name, contactPerson, phone, email, address) {
    const stmt = this.db.prepare(`
      INSERT INTO suppliers (supplier_name, contact_person, phone, email, address)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(name, contactPerson, phone, email, address);
  }

  deleteSupplier(id) {
    const deleteTx = this.db.transaction(() => {
      // Unlink supplier from batches first to prevent constraint locks
      this.db.prepare(`UPDATE batches SET supplier_id = NULL WHERE supplier_id = ?`).run(id);
      
      // Now safely delete the supplier
      const stmt = this.db.prepare(`DELETE FROM suppliers WHERE id = ?`);
      const res = stmt.run(id);
      return res.changes > 0;
    });

    return deleteTx();
  }
}

module.exports = SupplierRepository;