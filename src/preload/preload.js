const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getHardwareId: () => ipcRenderer.invoke('license:getHardwareId'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),

  getSuppliers: () => ipcRenderer.invoke('suppliers:getAll'),
  addSupplier: (data) => ipcRenderer.invoke('suppliers:add', data),
  deleteSupplier: (id) => ipcRenderer.invoke('suppliers:delete', id),

  addDrug: (drugData) => ipcRenderer.invoke('drugs:add', drugData),
  getAllDrugs: () => ipcRenderer.invoke('drugs:getAll'),
  addBatch: (batchData) => ipcRenderer.invoke('batches:add', batchData),
  getTodayInwardStats: () => ipcRenderer.invoke('inventory:getTodayInwardStats'),
  
  getInventory: () => ipcRenderer.invoke('inventory:getAll'),
  updateInventoryItem: (itemData) => ipcRenderer.invoke('inventory:updateItem', itemData),
  deleteMedicineKeepSales: (drugId) => ipcRenderer.invoke('inventory:deleteSingleDrug', drugId),
  deleteAllMedicinesKeepSales: () => ipcRenderer.invoke('inventory:deleteAllDrugs'),
  clearInventory: () => ipcRenderer.invoke('inventory:clearAll'),
  getAlertsSummary: () => ipcRenderer.invoke('inventory:getAlerts'),
  exportCSV: () => ipcRenderer.invoke('inventory:exportCSV'),
  backupDatabase: () => ipcRenderer.invoke('database:backup'),

  getPosStock: () => ipcRenderer.invoke('pos:getStock'),
  checkout: (saleData) => ipcRenderer.invoke('pos:checkout', saleData),
  printReceipt: (receiptData) => ipcRenderer.invoke('pos:printReceipt', receiptData),
  getAllSales: () => ipcRenderer.invoke('sales:getAll'),
  getSaleDetails: (saleId) => ipcRenderer.invoke('sales:getDetails', saleId),

  getActiveShift: () => ipcRenderer.invoke('till:getActiveShift'),
  openShift: (openingFloat) => ipcRenderer.invoke('till:openShift', openingFloat),
  getTillLiveStats: (shiftId) => ipcRenderer.invoke('till:getLiveStats', shiftId),
  closeShift: (data) => ipcRenderer.invoke('till:closeShift', data),
  getAllShifts: () => ipcRenderer.invoke('till:getAllShifts'),
  printTillReport: (tillData) => ipcRenderer.invoke('till:printReport', tillData),

  getAnalytics: () => ipcRenderer.invoke('reports:getAnalytics'),
  getProfitAnalytics: () => ipcRenderer.invoke('get:profit-analytics'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  verifyPin: (pin) => ipcRenderer.invoke('auth:verifyPin', pin),
  isAuthSetupCompleted: () => ipcRenderer.invoke('auth:isSetupCompleted'),
  setupCredentials: (data) => ipcRenderer.invoke('auth:setupCredentials', data),
  login: (data) => ipcRenderer.invoke('auth:login', data),
  verifyPassword: (password) => ipcRenderer.invoke('auth:verifyPassword', password),
  changeCredentials: (data) => ipcRenderer.invoke('auth:changeCredentials', data),

  deleteSingleSale: (saleId) => ipcRenderer.invoke('sales:deleteSingle', saleId),
  deleteAllSales: () => ipcRenderer.invoke('sales:deleteAll'),
  updateSale: (data) => ipcRenderer.invoke('sales:update', data),

  importCSV: () => ipcRenderer.invoke('inventory:importCSV'),
});