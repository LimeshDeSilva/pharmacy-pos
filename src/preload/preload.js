const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addDrug: (drugData) => ipcRenderer.invoke('drugs:add', drugData),
  getAllDrugs: () => ipcRenderer.invoke('drugs:getAll'),
  addBatch: (batchData) => ipcRenderer.invoke('batches:add', batchData),
  getInventory: () => ipcRenderer.invoke('inventory:getAll'),
  getPosStock: () => ipcRenderer.invoke('pos:getStock'),
  checkout: (saleData) => ipcRenderer.invoke('pos:checkout', saleData),
  getAllSales: () => ipcRenderer.invoke('sales:getAll'),
  getSaleDetails: (saleId) => ipcRenderer.invoke('sales:getDetails', saleId),
  getAnalytics: () => ipcRenderer.invoke('reports:getAnalytics'),
  getAlertsSummary: () => ipcRenderer.invoke('inventory:getAlerts'),
  exportCSV: () => ipcRenderer.invoke('inventory:exportCSV'),
  backupDatabase: () => ipcRenderer.invoke('database:backup'),
  clearInventory: () => ipcRenderer.invoke('inventory:clearAll'),
  deleteMedicineKeepSales: (drugId) => ipcRenderer.invoke('inventory:deleteSingleDrug', drugId),
  deleteAllMedicinesKeepSales: () => ipcRenderer.invoke('inventory:deleteAllDrugs')
});