const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("feishuSetup", {
  getDefaultWorkspace: () => ipcRenderer.invoke("workspace:default"),
  chooseWorkspace: (language) => ipcRenderer.invoke("workspace:choose", language),
  start: (workspace, language) => ipcRenderer.invoke("setup:start", workspace, language),
  copy: (text) => ipcRenderer.invoke("clipboard:write", text),
  getContent: (kind, language) => ipcRenderer.invoke("content:get", kind, language),
  onLog: (callback) => ipcRenderer.on("setup:log", (_event, line) => callback(line)),
  onUrl: (callback) => ipcRenderer.on("setup:url", (_event, url) => callback(url)),
  onComplete: (callback) => ipcRenderer.on("setup:complete", (_event, payload) => callback(payload))
});
