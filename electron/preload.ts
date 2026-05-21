import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pitwall', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
});
