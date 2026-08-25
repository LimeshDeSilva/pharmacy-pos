const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dbOps = require('./database');

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

ipcMain.handle('drugs:add', async (event, drugData) => {
  try {
    const result = dbOps.addDrug(
      drugData.brand_name,
      drugData.generic_name,
      drugData.category,
      drugData.min_stock_alert
    );
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});