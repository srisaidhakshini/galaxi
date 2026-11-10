const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "galaxiDesktop",
  Object.freeze({
    pickDirectory: () => ipcRenderer.invoke("galaxi:directory"),
    openExternal: (url) => ipcRenderer.invoke("galaxi:external", url),
  }),
);
