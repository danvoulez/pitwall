import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pitwall', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  getAuthToken: () => ipcRenderer.invoke('get-auth-token'),
});
