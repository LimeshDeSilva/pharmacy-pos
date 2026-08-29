const { ipcMain } = require('electron');
const PrinterService = require('../services/printerService');
const SystemService = require('../services/systemService');
const ExportService = require('../services/exportService');

function registerIpcHandlers(drugRepo, batchRepo, salesRepo, analyticsRepo) {
  // Drugs
  ipcMain.handle('drugs:add', async (event, drugData) => {
    try {
      const result = drugRepo.addDrug(drugData.brand_name, drugData.generic_name, drugData.category, drugData.min_stock_alert);
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

  ipcMain.handle('pos:checkout', async (event, { cart, total }) => {
    try {
      const result = salesRepo.processSale(cart, total);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pos:printReceipt', async (event, receiptData) => {
    return await PrinterService.printReceipt(receiptData);
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

  // System
  ipcMain.handle('database:backup', async () => {
    return await SystemService.backupDatabase();
  });
}

module.exports = registerIpcHandlers;