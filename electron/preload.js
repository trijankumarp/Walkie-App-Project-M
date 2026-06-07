const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  ping: () => ipcRenderer.invoke("ping"),
  // Add more secure bridges here later:
  // showNotification: (title, body) => ipcRenderer.invoke("show-notification", title, body),
});
