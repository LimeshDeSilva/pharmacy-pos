const { ipcMain, dialog } = require('electron');
const { z } = require('zod');
const crypto = require('crypto');
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
  buy_price: z.number().nonnegative().optional().default(0),
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

  ipcMain.handle('auth:isSetupCompleted', async () => {
    try {
      const settings = settingsRepo.getSettings();
      const isSetup = settings.auth_setup_completed === '1' && !!settings.admin_password;
      return { success: true, isSetup, username: settings.admin_username || 'admin' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  function generateEmergencyRecoveryKey() {
    const bytes = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `MC-${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}-${bytes.slice(12, 16)}`;
  }

  ipcMain.handle('auth:setupCredentials', async (event, { username, password, secQ1, secA1, secQ2, secA2 }) => {
    try {
      if (!username || !username.trim()) throw new Error('Username is required');
      if (!password || !password.trim()) throw new Error('Password is required');
      const cleanUser = username.trim();
      const cleanPass = password.trim();

      const recoveryKey = generateEmergencyRecoveryKey();

      const updateData = {
        admin_username: cleanUser,
        admin_password: cleanPass,
        admin_pin: cleanPass,
        master_recovery_key: recoveryKey,
        auth_setup_completed: '1'
      };

      if (secQ1 && secA1) {
        updateData.sec_question_1 = secQ1.trim();
        updateData.sec_answer_1 = secA1.trim().toLowerCase();
      }
      if (secQ2 && secA2) {
        updateData.sec_question_2 = secQ2.trim();
        updateData.sec_answer_2 = secA2.trim().toLowerCase();
      }

      settingsRepo.updateSettings(updateData);
      return { success: true, username: cleanUser, recoveryKey };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:login', async (event, { username, password }) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedUser = (settings.admin_username || 'admin').trim().toLowerCase();
      const storedPass = String(settings.admin_password || settings.admin_pin || '1234').trim();
      
      const inputUser = String(username || '').trim().toLowerCase();
      const inputPass = String(password || '').trim();

      if (inputUser === storedUser && inputPass === storedPass) {
        return { success: true, username: settings.admin_username || 'admin' };
      }
      return { success: false, error: 'Invalid username or password.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:verifyPassword', async (event, password) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedPass = String(settings.admin_password || settings.admin_pin || '1234').trim();
      return { success: String(password || '').trim() === storedPass };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:verifyPin', async (event, pin) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedPass = String(settings.admin_password || settings.admin_pin || '1234').trim();
      return { success: String(pin || '').trim() === storedPass };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:changeCredentials', async (event, { currentPassword, newUsername, newPassword }) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedPass = String(settings.admin_password || settings.admin_pin || '1234').trim();
      if (String(currentPassword || '').trim() !== storedPass) {
        throw new Error('Current password is incorrect.');
      }
      if (!newUsername || !newUsername.trim()) throw new Error('New username is required.');
      if (!newPassword || !newPassword.trim()) throw new Error('New password is required.');

      const cleanUser = newUsername.trim();
      const cleanPass = newPassword.trim();
      settingsRepo.updateSettings({
        admin_username: cleanUser,
        admin_password: cleanPass,
        admin_pin: cleanPass,
        auth_setup_completed: '1'
      });
      return { success: true, username: cleanUser };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:getSecurityQuestions', async () => {
    try {
      const settings = settingsRepo.getSettings();
      return {
        success: true,
        q1: settings.sec_question_1 || 'What was the name of your primary school?',
        q2: settings.sec_question_2 || 'What city was your store founded in?',
        hasQuestions: !!(settings.sec_question_1 && settings.sec_answer_1)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:resetViaQuestions', async (event, { ans1, ans2, newPassword }) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedAns1 = (settings.sec_answer_1 || '').trim().toLowerCase();
      const storedAns2 = (settings.sec_answer_2 || '').trim().toLowerCase();

      if (!storedAns1 && !storedAns2) {
        throw new Error('No security questions configured in the system. Please use your Master Emergency Recovery Key.');
      }

      const inputAns1 = String(ans1 || '').trim().toLowerCase();
      const inputAns2 = String(ans2 || '').trim().toLowerCase();

      if (storedAns1 && inputAns1 !== storedAns1) {
        throw new Error('Answer to Security Question 1 is incorrect.');
      }
      if (storedAns2 && inputAns2 !== storedAns2) {
        throw new Error('Answer to Security Question 2 is incorrect.');
      }

      if (!newPassword || newPassword.trim().length < 3) {
        throw new Error('New password must be at least 3 characters long.');
      }

      const cleanPass = newPassword.trim();
      settingsRepo.updateSettings({
        admin_password: cleanPass,
        admin_pin: cleanPass,
        auth_setup_completed: '1'
      });

      return { success: true, username: settings.admin_username || 'admin' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:resetViaRecoveryKey', async (event, { recoveryKey, newPassword }) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedRaw = settings.master_recovery_key || '';
      const storedClean = storedRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const inputClean = String(recoveryKey || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      if (!storedClean) {
        throw new Error('No Master Emergency Recovery Key found in system settings.');
      }

      if (inputClean !== storedClean) {
        throw new Error('Invalid Emergency Recovery Key. Please check the code and try again.');
      }

      if (!newPassword || newPassword.trim().length < 3) {
        throw new Error('New password must be at least 3 characters long.');
      }

      const cleanPass = newPassword.trim();
      settingsRepo.updateSettings({
        admin_password: cleanPass,
        admin_pin: cleanPass,
        auth_setup_completed: '1'
      });

      return { success: true, username: settings.admin_username || 'admin' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:getRecoveryDetails', async (event, password) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedPass = String(settings.admin_password || settings.admin_pin || '1234').trim();
      if (String(password || '').trim() !== storedPass) {
        throw new Error('Current master password is required to view recovery credentials.');
      }

      let recoveryKey = settings.master_recovery_key;
      if (!recoveryKey) {
        recoveryKey = generateEmergencyRecoveryKey();
        settingsRepo.updateSettings({ master_recovery_key: recoveryKey });
      }

      return {
        success: true,
        recoveryKey,
        secQ1: settings.sec_question_1 || '',
        secQ2: settings.sec_question_2 || ''
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('auth:updateOfflineRecovery', async (event, { currentPassword, secQ1, secA1, secQ2, secA2, regenerateKey }) => {
    try {
      const settings = settingsRepo.getSettings();
      const storedPass = String(settings.admin_password || settings.admin_pin || '1234').trim();
      if (String(currentPassword || '').trim() !== storedPass) {
        throw new Error('Current master password is incorrect.');
      }

      const updateData = {};
      if (secQ1 && secA1) {
        updateData.sec_question_1 = secQ1.trim();
        updateData.sec_answer_1 = secA1.trim().toLowerCase();
      }
      if (secQ2 && secA2) {
        updateData.sec_question_2 = secQ2.trim();
        updateData.sec_answer_2 = secA2.trim().toLowerCase();
      }
      if (regenerateKey) {
        updateData.master_recovery_key = generateEmergencyRecoveryKey();
      }

      settingsRepo.updateSettings(updateData);
      const updated = settingsRepo.getSettings();
      return { success: true, recoveryKey: updated.master_recovery_key };
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
