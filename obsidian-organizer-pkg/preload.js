const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  loadVault:   ()      => ipcRenderer.invoke('load-vault'),
  saveVault:   (v)     => ipcRenderer.invoke('save-vault', v),
  deleteNote:  (id)    => ipcRenderer.invoke('delete-note', id),
  callOllama:  (data)  => ipcRenderer.invoke('call-ollama', data),
  getConfig:   ()      => ipcRenderer.invoke('get-config'),
  setConfig:   (cfg)   => ipcRenderer.invoke('set-config', cfg),
  listModels:  ()      => ipcRenderer.invoke('list-models'),
});
