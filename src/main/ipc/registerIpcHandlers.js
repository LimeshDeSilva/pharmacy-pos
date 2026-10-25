const { ipcMain, dialog } = require('electron');
const { z } = require('zod');
const PrinterService = require('../services/printerService');
const SystemService = require('../services/systemService');
const ExportService = require('../services/exportService');
const ImportService = require('../services/importService');

const drugSchema = z.object({
  brand_name: z.string().min(1, 'Brand name is required'),
  generic_name: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  min_stock_alert: z.number().int().min(0).default(10)
});

const batchSchema = z.object({
  drug_id: z.number().int().positive(),
  supplier_id: z.number().int().positive().optional().nullable(),
  batch_number: z.string().min(1, 'Batch number is required'),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid expiry format (YYYY-MM-DD)'),
  buy_price: z.number().nonnegative(),
  sell_price: z.number().nonnegative(),
  quantity: z.number().int().positive('Quantity must be greater than 0')
});

const supplierSchema = z.object({
  supplier_name: z.string().min(1, 'Supplier name is required'),
  contact_person: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable()
});

const cartItemSchema = z.object({
  batch_id: z.number().int().positive(),
  brand_name: z.string(),
  batch_number: z.string(),
  sell_price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  total_price: z.number().nonnegative()
});

const checkoutSchema = z.object({
  cart: z.array(cartItemSchema).min(1, 'Cart cannot be empty'),
  total: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  prescription: z.any().optional().nullable()
});

function registerIpcHandlers(db, drugRepo, batchRepo, salesRepo, analyticsRepo, settingsRepo, supplierRepo) {
  ipcMain.handle('license:getHardwareId', () => SystemService.getHardwareId());
  ipcMain.handle('license:activate', (event, key) => SystemService.activateLicense(key));

  // Suppliers
  ipcMain.handle('suppliers:getAll', async () => {
    try {
      return { success: true, data: supplierRepo.getAllSuppliers() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('suppliers:add', async (event, data) => {
    try {
      const validated = supplierSchema.parse(data);
      const res = supplierRepo.addSupplier(validated.supplier_name, validated.contact_person, validated.phone, validated.email, validated.address);
      return { success: true, data: res };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('suppliers:delete', async (event, id) => {
    try {
      const success = await Promise.resolve(supplierRepo.deleteSupplier(id));
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Drugs & Batches
  ipcMain.handle('drugs:add', async (event, drugData) => {
    try {
      const validated = drugSchema.parse(drugData);
      const result = drugRepo.addDrug(validated.brand_name, validated.generic_name, validated.category, validated.min_stock_alert);
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

  ipcMain.handle('inventory:getTodayInwardStats', async () => {
    try {
      return { success: true, data: batchRepo.getTodayInwardStats() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('batches:add', async (event, batchData) => {
    try {
      const validated = batchSchema.parse(batchData);
      const result = batchRepo.addBatch(
        validated.drug_id, 
        validated.batch_number, 
        validated.expiry_date, 
        validated.buy_price, 
        validated.sell_price, 
        validated.quantity,
        validated.supplier_id
      );
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Inventory, POS, Shifts, Reports
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
    try {
      return await ExportService.exportInventoryCSV(batchRepo.getInventoryOverview());
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pos:getStock', async () => {
    try {
      return { success: true, data: batchRepo.getAvailableStock() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pos:checkout', async (event, salePayload) => {
    try {
      const validated = checkoutSchema.parse(salePayload);
      const res = salesRepo.processSale(validated.cart, validated.total, validated.discount, validated.prescription);
      return { success: true, data: res };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('pos:printReceipt', async (event, receiptData) => {
    try {
      return await PrinterService.printReceipt(receiptData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:getActiveShift', async () => {
    try {
      return { success: true, data: salesRepo.getActiveShift() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:openShift', async (event, openingFloat) => {
    try {
      const res = salesRepo.openShift(openingFloat);
      return { success: true, data: res };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:getLiveStats', async (event, shiftId) => {
    try {
      const res = salesRepo.getCurrentShiftLiveStats(shiftId);
      return { success: true, data: res };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('till:closeShift', async (event, { shiftId, actualCash, note }) => {
    try {
      const res = salesRepo.closeShift(shiftId, actualCash, note);
      return { success: true, data: res };
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
    try {
      return await PrinterService.printTillReport(tillData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

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
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

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
      return { success: String(pin).trim() === String(settings.admin_pin || '1234').trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('database:backup', async () => {
    try {
      return await SystemService.backupDatabase();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:deleteSingle', async (event, saleId) => {
    try {
      return { success: salesRepo.deleteSaleById(saleId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:deleteAll', async () => {
    try {
      return { success: salesRepo.deleteAllSales() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sales:update', async (event, { saleId, items, total, discount }) => {
    try {
      return { success: true, data: salesRepo.updateSale(saleId, items, total, discount) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('inventory:importCSV', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (!filePaths || filePaths.length === 0) return { success: false, canceled: true };
      return await ImportService.importInventoryCSV(db, drugRepo, batchRepo, filePaths[0]);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = registerIpcHandlers;
