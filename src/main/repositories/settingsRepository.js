class SettingsRepository {
  constructor(db) {
    this.db = db;
  }

  getSettings() {
    const rows = this.db.prepare(`SELECT key, value FROM settings`).all();
    const settings = {};
    rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    return settings;
  }

  updateSettings(settings) {
    const updateStmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const tx = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        updateStmt.run(key, value);
      }
    });

    return tx();
  }
}

module.exports = SettingsRepository;