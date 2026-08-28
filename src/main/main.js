const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dbOps = require('./database.js');

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



ipcMain.handle('drugs:getAll', async () => {
  try {
    const drugs = dbOps.getAllDrugs();
    return { success: true, data: drugs };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('batches:add', async (event, batchData) => {
  try {
    const result = dbOps.addBatch(
      batchData.drug_id,
      batchData.batch_number,
      batchData.expiry_date,
      batchData.buy_price,
      batchData.sell_price,
      batchData.quantity
    );
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('inventory:getAll', async () => {
  try {
    const inventory = dbOps.getInventoryOverview();
    return { success: true, data: inventory };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('pos:getStock', async () => {
  try {
    const stock = dbOps.getAvailableStock();
    return { success: true, data: stock };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('pos:checkout', async (event, { cart, total }) => {
  try {
    const result = dbOps.processSale(cart, total);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('sales:getAll', async () => {
  try {
    const sales = dbOps.getAllSales();
    return { success: true, data: sales };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('sales:getDetails', async (event, saleId) => {
  try {
    const details = dbOps.getSaleDetails(saleId);
    return { success: true, data: details };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('reports:getAnalytics', async () => {
  try {
    const kpis = dbOps.getSalesKPIs();
    const daily = dbOps.getDailySalesAnalytics();
    const weekly = dbOps.getWeeklySalesAnalytics();
    const monthly = dbOps.getMonthlySalesAnalytics();

    return {
      success: true,
      data: { kpis, daily, weekly, monthly }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});



app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});