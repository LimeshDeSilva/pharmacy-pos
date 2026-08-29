const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Medicines & Batches
  addDrug: (drugData) => ipcRenderer.invoke('drugs:add', drugData),
  getAllDrugs: () => ipcRenderer.invoke('drugs:getAll'),
  addBatch: (batchData) => ipcRenderer.invoke('batches:add', batchData),
  
  // Inventory
  getInventory: () => ipcRenderer.invoke('inventory:getAll'),
  updateInventoryItem: (itemData) => ipcRenderer.invoke('inventory:updateItem', itemData),
  deleteMedicineKeepSales: (drugId) => ipcRenderer.invoke('inventory:deleteSingleDrug', drugId),
  deleteAllMedicinesKeepSales: () => ipcRenderer.invoke('inventory:deleteAllDrugs', () => {}),
  clearInventory: () => ipcRenderer.invoke('inventory:clearAll'),
  getAlertsSummary: () => ipcRenderer.invoke('inventory:getAlerts'),
  exportCSV: () => ipcRenderer.invoke('inventory:exportCSV'),
  backupDatabase: () => ipcRenderer.invoke('database:backup'),

  // POS & Sales
  getPosStock: () => ipcRenderer.invoke('pos:getStock'),
  checkout: (saleData) => ipcRenderer.invoke('pos:checkout', saleData),
  printReceipt: (receiptData) => ipcRenderer.invoke('pos:printReceipt', receiptData),
  getAllSales: () => ipcRenderer.invoke('sales:getAll'),
  getSaleDetails: (saleId) => ipcRenderer.invoke('sales:getDetails', saleId),

  // Analytics & Reports
  getAnalytics: () => ipcRenderer.invoke('reports:getAnalytics'),
  getProfitAnalytics: () => ipcRenderer.invoke('get:profit-analytics'),

  // Store Settings (Must be present)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // Sales Deletion
  deleteSingleSale: (saleId) => ipcRenderer.invoke('sales:deleteSingle', saleId),
  deleteAllSales: () => ipcRenderer.invoke('sales:deleteAll')
});