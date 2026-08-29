const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');

class SystemService {
  static setupThermalPrinterSharing() {
    if (process.platform !== 'win32') return;

    const psScript = `
      $printer = Get-Printer | Where-Object { $_.Name -match 'XP-80|POS|Thermal|Receipt|80mm' } | Select-Object -First 1
      if ($printer -and -not $printer.Shared) {
        Set-Printer -Name $printer.Name -Shared $true -ShareName 'receipt'
      }
    `;

    exec(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/\n/g, ' ')}"`, (err) => {
      if (err) {
        console.warn('Printer auto-share notice:', err.message);
      }
    });
  }

  static async backupDatabase() {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Backup SQLite Database',
        defaultPath: `pharmacy_backup_${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
      });

      if (!filePath) return { success: false, canceled: true };

      const dbPath = path.join(__dirname, '../../../pharmacy.db');
      fs.copyFileSync(dbPath, filePath);

      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = SystemService;