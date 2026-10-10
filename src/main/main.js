const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

const db = require('./config/database');
const DrugRepository = require('./repositories/drugRepository');
const BatchRepository = require('./repositories/batchRepository');
const SalesRepository = require('./repositories/salesRepository');
const AnalyticsRepository = require('./repositories/analyticsRepository');
const SystemService = require('./services/systemService');
const SettingsRepository = require('./repositories/settingsRepository');
const registerIpcHandlers = require('./ipc/registerIpcHandlers');

const drugRepo = new DrugRepository(db);
const batchRepo = new BatchRepository(db);
const salesRepo = new SalesRepository(db);
const analyticsRepo = new AnalyticsRepository(db);
const settingsRepo = new SettingsRepository(db);

registerIpcHandlers(db, drugRepo, batchRepo, salesRepo, analyticsRepo, settingsRepo);

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: 'Pharmacy Management System',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  // Check Hardware-Locked License
  const licenseCheck = SystemService.verifyLicense();
  if (!licenseCheck.valid) {
    dialog.showErrorBox(
      'License Activation Required',
      `This computer is not licensed to run MediCare POS.\n\nYour Hardware ID is:\n${licenseCheck.hardwareId}\n\nPlease provide this ID to the software vendor to obtain your license key.`
    );
    app.quit();
    return;
  }

  SystemService.setupThermalPrinterSharing();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});