const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addDrug: (drugData) => ipcRenderer.invoke('drugs:add', drugData),
  getAllDrugs: () => ipcRenderer.invoke('drugs:getAll'),
  addBatch: (batchData) => ipcRenderer.invoke('batches:add', batchData),
  getInventory: () => ipcRenderer.invoke('inventory:getAll'),
  getPosStock: () => ipcRenderer.invoke('pos:getStock')
});