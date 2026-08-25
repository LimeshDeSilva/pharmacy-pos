const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addDrug: (drugData) => ipcRenderer.invoke('drugs:add', drugData)
});