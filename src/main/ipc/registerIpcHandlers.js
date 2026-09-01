const { ipcMain, dialog } = require('electron');
const PrinterService = require('../services/printerService');
const SystemService = require('../services/systemService');
const ExportService = require('../services/exportService');
const ImportService = require('../services/importService');

function registerIpcHandlers(db, drugRepo, batchRepo, salesRepo, analyticsRepo, settingsRepo) {
  // Drugs
  ipcMain.handle('drugs:add', async (event, drugData) => {
    try {
      const result = drugRepo.addDrug(drugData.brand_name, drugData.generic_name, drugData.category, drugData.min_stock_alert, drugData.barcode);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs:getAll', async () => {
    try {
      return { success: true, data: drugRepo.getAllDrugs() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs:getByBarcode', async (event, barcode) => {
    try {
      return { success: true, data: drugRepo.getDrugByBarcode(barcode) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('drugs:bindBarcode', async (event, { drugId, barcode }) => {
    try {
      drugRepo.bindBarcode(drugId, barcode);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Batches
  ipcMain.handle('batches:add', async (event, batchData) => {
    try {
      const result = batchRepo.addBatch(batchData.drug_id, batchData.batch_number, batchData.expiry_date, batchData.buy_price, batchData.sell_price, batchData.quantity);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Inventory
  ipcMain.handle('inventory:getAll', async () => {
    try {
      return { success: true, data: batchRepo.getInventoryOverview() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:updateItem', async (event, itemData) => {
    try {
      drugRepo.updateInventoryItem(itemData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:deleteSingleDrug', async (event, drugId) => {
    try {
      return { success: drugRepo.deleteMedicineKeepSales(drugId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:deleteAllDrugs', async () => {
    try {
      return { success: drugRepo.deleteAllMedicinesKeepSales() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:clearAll', async () => {
    try {
      return { success: salesRepo.clearEntireInventory() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:getAlerts', async () => {
    try {
      return { success: true, data: analyticsRepo.getStockAlertsSummary() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:exportCSV', async () => {
    const inventory = batchRepo.getInventoryOverview();
    return await ExportService.exportInventoryCSV(inventory);
  });

  // POS
  ipcMain.handle('pos:getStock', async () => {
    try {
      return { success: true, data: batchRepo.getAvailableStock() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pos:checkout', async (event, { cart, total, discount }) => {
    try {
      const result = salesRepo.processSale(cart, total, discount);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pos:printReceipt', async (event, receiptData) => {
    return await PrinterService.printReceipt(receiptData);
  });

  // Till & Shift Management
  ipcMain.handle('till:getActiveShift', async () => {
    try {
      return { success: true, data: salesRepo.getActiveShift() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:openShift', async (event, openingFloat) => {
    try {
      const result = salesRepo.openShift(openingFloat);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:getLiveStats', async (event, shiftId) => {
    try {
      return { success: true, data: salesRepo.getCurrentShiftLiveStats(shiftId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:closeShift', async (event, { shiftId, actualCash, note }) => {
    try {
      const result = salesRepo.closeShift(shiftId, actualCash, note);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:getAllShifts', async () => {
    try {
      return { success: true, data: salesRepo.getAllShifts() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:printReport', async (event, tillData) => {
    return await PrinterService.printTillReport(tillData);
  });

  // Sales History
  ipcMain.handle('sales:getAll', async () => {
    try {
      return { success: true, data: salesRepo.getAllSales() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:getDetails', async (event, saleId) => {
    try {
      return { success: true, data: salesRepo.getSaleDetails(saleId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Analytics & Reports
  ipcMain.handle('reports:getAnalytics', async () => {
    try {
      return {
        success: true,
        data: {
          kpis: analyticsRepo.getSalesKPIs(),
          daily: analyticsRepo.getDailySalesAnalytics(),
          weekly: analyticsRepo.getWeeklySalesAnalytics(),
          monthly: analyticsRepo.getMonthlySalesAnalytics()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get:profit-analytics', async () => {
    try {
      return {
        success: true,
        data: {
          kpis: analyticsRepo.getProfitKPIs(),
          daily: analyticsRepo.getDailyProfitAnalytics(),
          weekly: analyticsRepo.getWeeklyProfitAnalytics(),
          monthly: analyticsRepo.getMonthlyProfitAnalytics()
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Settings & PIN Verification Handlers
  ipcMain.handle('settings:get', async () => {
    try {
      return { success: true, data: settingsRepo.getSettings() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings:update', async (event, settings) => {
    try {
      settingsRepo.updateSettings(settings);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:verifyPin', async (event, pin) => {
    try {
      const settings = settingsRepo.getSettings();
      const currentPin = settings.admin_pin || '1234';
      return { success: String(pin).trim() === String(currentPin).trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // System Backup
  ipcMain.handle('database:backup', async () => {
    return await SystemService.backupDatabase();
  });
  
  // Sales Deletion Handlers
  ipcMain.handle('sales:deleteSingle', async (event, saleId) => {
    try {
      const success = salesRepo.deleteSaleById(saleId);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:deleteAll', async () => {
    try {
      const success = salesRepo.deleteAllSales();
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:update', async (event, { saleId, items, total, discount }) => {
    try {
      const result = salesRepo.updateSale(saleId, items, total, discount);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Inventory Import Handler (Allows CSV, TSV, TXT, and all structured sheets)
  ipcMain.handle('inventory:importCSV', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Import Inventory Spreadsheet / CSV',
        filters: [
          { name: 'CSV & Delimited Text Files (*.csv, *.txt, *.tsv)', extensions: ['csv', 'txt', 'tsv'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (!filePaths || filePaths.length === 0) return { success: false, canceled: true };

      return await ImportService.importInventoryCSV(db, drugRepo, batchRepo, filePaths[0]);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = registerIpcHandlers;