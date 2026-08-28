const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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


ipcMain.handle('inventory:getAlerts', async () => {
  try {
    const alerts = dbOps.getStockAlertsSummary();
    return { success: true, data: alerts };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// Export Inventory as CSV
ipcMain.handle('inventory:exportCSV', async () => {
  try {
    const inventory = dbOps.getInventoryOverview();
    if (!inventory || inventory.length === 0) {
      return { success: false, error: 'No inventory records found to export.' };
    }

    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Inventory to CSV',
      defaultPath: `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (!filePath) return { success: false, canceled: true };

    const headers = 'Brand Name,Generic Name,Category,Batch Number,Expiry Date,Sell Price,Batch Stock,Total Stock\n';
    const rows = inventory.map(item => 
      `"${item.brand_name || ''}","${item.generic_name || ''}","${item.category || ''}","${item.batch_number || ''}","${item.expiry_date || ''}",${item.sell_price || 0},${item.batch_quantity !== null ? item.batch_quantity : 0},${item.total_stock || 0}`
    ).join('\n');

    fs.writeFileSync(filePath, headers + rows, 'utf-8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Safe Database Backup
ipcMain.handle('database:backup', async () => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Backup SQLite Database',
      defaultPath: `pharmacy_backup_${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
    });

    if (!filePath) return { success: false, canceled: true };

    const dbPath = path.join(__dirname, '../../pharmacy.db');
    fs.copyFileSync(dbPath, filePath);

    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Clear Entire Inventory
ipcMain.handle('inventory:clearAll', async () => {
  try {
    dbOps.clearEntireInventory();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Delete a Single Drug (Keep Sales History)
ipcMain.handle('inventory:deleteSingleDrug', async (event, drugId) => {
  try {
    const success = dbOps.deleteMedicineKeepSales(drugId);
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// Delete All Drugs (Keep Sales History)
ipcMain.handle('inventory:deleteAllDrugs', async () => {
  try {
    dbOps.deleteAllMedicinesKeepSales();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// Native Print Handler
ipcMain.handle('print:receipt', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Window not found' };

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: false, // Set to true for instant direct printing without prompt
        printBackground: true,
        pageSize: {
          width: 80000, // 80mm in microns
          height: 297000
        },
        margins: {
          marginType: 'none'
        }
      },
      (success, failureReason) => {
        if (!success) {
          console.error('Print failed:', failureReason);
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
});


// Profit Analytics Handler
ipcMain.handle('get:profit-analytics', async () => {
  try {
    return {
      success: true,
      data: {
        kpis: dbOps.getProfitKPIs(),
        daily: dbOps.getDailyProfitAnalytics(),
        weekly: dbOps.getWeeklyProfitAnalytics(),
        monthly: dbOps.getMonthlyProfitAnalytics()
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Update Drug Handler
ipcMain.handle('inventory:updateItem', async (event, itemData) => {
  try {
    dbOps.updateInventoryItem(itemData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});



app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});