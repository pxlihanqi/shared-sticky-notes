const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createNote: () => ipcRenderer.send('note:create', { type: 'text', color: '#ffeb3b' }),
  minimizeNote: (noteId) => ipcRenderer.send('note:minimize', noteId),
  maximizeNote: (noteId) => ipcRenderer.send('note:maximize', noteId),
  togglePin: (noteId) => ipcRenderer.sendSync('note:togglePin', noteId),
  isPinned: (noteId) => ipcRenderer.sendSync('note:isPinned', noteId),
  focusNote: (noteId) => ipcRenderer.send('note:focus', noteId),
  setWidthOffset: (noteId, offset) => ipcRenderer.send('note:setWidthOffset', { noteId, offset }),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg) => ipcRenderer.invoke('config:set', cfg),
  generateAuthCode: () => ipcRenderer.invoke('config:generateAuthCode'),
});
