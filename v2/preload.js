const { contextBridge, ipcRenderer } = require('electron');

// Expõe a API ao renderer de forma segura (substitui window.pywebview.api)
contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
