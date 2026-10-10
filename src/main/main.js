const { app, BrowserWindow, ipcMain } = require('electron');
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

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function createActivationWindow() {
  const activationWin = new BrowserWindow({
    width: 500,
    height: 420,
    resizable: false,
    minimizable: false,
    title: 'Software Activation - MediCare POS',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  activationWin.loadFile(path.join(__dirname, '../renderer/activate.html'));
}

app.whenReady().then(() => {
  const licenseCheck = SystemService.verifyLicense();
  if (!licenseCheck.valid) {
    createActivationWindow();
  } else {
    SystemService.setupThermalPrinterSharing();
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});