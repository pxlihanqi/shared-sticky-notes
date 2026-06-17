const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createNote: () => ipcRenderer.send('note:create', { type: 'text', color: '#ffeb3b' }),
  minimizeNote: (noteId) => ipcRenderer.send('note:minimize', noteId),
  togglePin: (noteId) => ipcRenderer.sendSync('note:togglePin', noteId),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg) => ipcRenderer.invoke('config:set', cfg),
  generateAuthCode: () => ipcRenderer.invoke('config:generateAuthCode'),
});
