const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dbOps = require('./database.js');
const os = require('os');
const { exec } = require('child_process');
const ReceiptPrinterEncoder = require('@point-of-sale/receipt-printer-encoder');

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
ipcMain.handle('pos:printReceipt', async (event, receiptData) => {
  try {
    const encoder = new ReceiptPrinterEncoder({
      language: 'esc-pos',
      columns: 48
    });

    // 1. Header (Centered with explicit hardware alignment & space padding)
    const receiptContent = encoder
      .initialize()
      .raw([0x1b, 0x61, 0x01]) // ESC a 1 -> Pure ESC/POS Center Alignment
      .bold(true)
      .size(2, 2)
      .line('NEW SAHASNA PHARMACY')
      .size(1, 1)
      .bold(false)
      .raw([0x1b, 0x61, 0x01]) // ESC a 1 -> Center Alignment
      .line('No.514, Walagedara, Balapitiya')
      .line('Tel: 077-6723395')
      .rule({ style: 'single' })
      .raw([0x1b, 0x61, 0x00]) // ESC a 0 -> Reset to Left Alignment
      .line(`Invoice #: #${receiptData.saleId}`)
      .line(`Date     : ${receiptData.dateStr}`)
      .rule({ style: 'single' })
      // 2. Table Headers (22 + 4 + 10 + 12 = 48 columns)
      .bold(true)
      .table(
        [
          { width: 22, align: 'left' },
          { width: 4, align: 'center' },
          { width: 10, align: 'right' },
          { width: 12, align: 'right' }
        ],
        [['Item', 'Qty', 'Price', 'Total']]
      )
      .bold(false)
      .rule({ style: 'single' });

    // 3. Line Items
    receiptData.items.forEach((item) => {
      const rawName = item.brand_name || item.brand || item.generic_name || 'Item';
      const name = rawName.length > 21 ? rawName.slice(0, 20) + '.' : rawName;
      const qty = String(item.quantity || 1);
      const unitPrice = Number(item.sell_price !== undefined ? item.sell_price : (item.unit_price || 0)).toFixed(2);
      const total = Number(item.total_price !== undefined ? item.total_price : (item.quantity * unitPrice)).toFixed(2);

      receiptContent
      .newline(1)
      .table(
        [
          { width: 22, align: 'left' },
          { width: 4, align: 'center' },
          { width: 10, align: 'right' },
          { width: 12, align: 'right' }
        ],
        [[name, qty, unitPrice, total]]
      );
    });

    // 4. Totals and Balances (24 + 24 = 48 columns)
    receiptContent
      .rule({ style: 'single' })
      .bold(true)
      .table(
        [
          { width: 24, align: 'left' },
          { width: 24, align: 'right' }
        ],
        [['GRAND TOTAL:', `LKR ${Number(receiptData.grandTotal).toFixed(2)}`]]
      )
      .newline(1)
      .bold(false)
      .table(
        [
          { width: 24, align: 'left' },
          { width: 24, align: 'right' }
        ],
        [
          ['Cash Paid:', `LKR ${Number(receiptData.paidAmount).toFixed(2)}`],
          ['Change / Balance:', `LKR ${Number(receiptData.balanceAmount).toFixed(2)}`]
        ]
      )
      .rule({ style: 'single' })
      // 5. Footer & Auto-Cut
      .raw([0x1b, 0x61, 0x01]) // ESC a 1 -> Center Alignment
      .line('Thank you for choosing Sahasna Pharmacy!')
      .line('Get well soon!')
      .newline(6)
      .cut();

    const rawBytes = encoder.encode();
    const tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
    fs.writeFileSync(tempFilePath, Buffer.from(rawBytes));

    const rawPrintCmd = `cmd.exe /c copy /b "${tempFilePath}" "\\\\127.0.0.1\\receipt"`;

    return new Promise((resolve) => {
      exec(rawPrintCmd, (err) => {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
        if (err) {
          console.error('Raw print error:', err);
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('Receipt Generation Error:', error);
    return { success: false, error: error.message };
  }
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



// Auto-detect and share the thermal printer as 'receipt'
function setupThermalPrinterSharing() {
  if (process.platform !== 'win32') return;

  const psScript = "$printer = Get-Printer | Where-Object { $_.Name -match 'XP-80|POS|Thermal|Receipt|80mm' } | Select-Object -First 1; if ($printer -and -not $printer.Shared) { Set-Printer -Name $printer.Name -Shared $true -ShareName 'receipt' }";

  exec(`powershell -ExecutionPolicy Bypass -Command "${psScript}"`, (err) => {
    if (err) {
      console.warn('Printer auto-share notice:', err.message);
    }
  });
}

app.whenReady().then(() => {
  setupThermalPrinterSharing();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});