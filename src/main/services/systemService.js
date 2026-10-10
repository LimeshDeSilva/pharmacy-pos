const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { dialog, app } = require('electron');
const os = require('os');
const crypto = require('crypto');

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

      const dbPath = app.isPackaged
        ? path.join(app.getPath('userData'), 'pharmacy.db')
        : path.join(__dirname, '../../../pharmacy.db');
      
      fs.copyFileSync(dbPath, filePath);

      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  static getHardwareId() {
    const cpus = os.cpus();
    const cpuModel = cpus && cpus.length > 0 ? cpus[0].model : 'UnknownCPU';
    const totalMem = os.totalmem();
    const platform = os.platform();
    const hostname = os.hostname();

    const rawId = `${cpuModel}-${totalMem}-${platform}-${hostname}`;
    return crypto.createHash('sha256').update(rawId).digest('hex').toUpperCase();
  }

  static getLicensePath() {
    return app.isPackaged
      ? path.join(app.getPath('userData'), 'license.key')
      : path.join(__dirname, '../../../license.key');
  }

  static verifyLicense() {
    try {
      const licensePath = SystemService.getLicensePath();

      if (!fs.existsSync(licensePath)) {
        return { valid: false, hardwareId: SystemService.getHardwareId(), error: 'License file not found.' };
      }

      const licenseContent = fs.readFileSync(licensePath, 'utf-8').trim();
      const expectedKey = crypto.createHash('sha256').update(SystemService.getHardwareId() + 'MEDICARE_POS_SECRET').digest('hex').toUpperCase();

      if (licenseContent === expectedKey) {
        return { valid: true };
      } else {
        return { valid: false, hardwareId: SystemService.getHardwareId(), error: 'Invalid license key for this PC.' };
      }
    } catch (err) {
      return { valid: false, hardwareId: SystemService.getHardwareId(), error: err.message };
    }
  }

  static activateLicense(enteredKey) {
    try {
      const cleanKey = String(enteredKey).trim().toUpperCase();
      const expectedKey = crypto.createHash('sha256').update(SystemService.getHardwareId() + 'MEDICARE_POS_SECRET').digest('hex').toUpperCase();

      if (cleanKey === expectedKey) {
        const licensePath = SystemService.getLicensePath();
        fs.writeFileSync(licensePath, cleanKey, 'utf-8');
        return { success: true };
      } else {
        return { success: false, error: 'The license key provided is invalid for this computer.' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = SystemService;