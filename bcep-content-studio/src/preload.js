const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bcep", {
  bootstrap: () => ipcRenderer.invoke("app:bootstrap"),
  chooseVideo: () => ipcRenderer.invoke("dialog:video"),
  chooseTranscript: () => ipcRenderer.invoke("dialog:transcript"),
  chooseOutput: (currentPath) => ipcRenderer.invoke("dialog:output", currentPath),
  videoMetadata: (videoPath) => ipcRenderer.invoke("video:metadata", videoPath),
  previewFrame: (payload) => ipcRenderer.invoke("video:preview", payload),
  generateFeature: (payload) => ipcRenderer.invoke("feature:generate", payload),
  generateBlog: (payload) => ipcRenderer.invoke("blog:generate", payload),
  saveBlog: (payload) => ipcRenderer.invoke("blog:save", payload),
  createTerminal: (cwd) => ipcRenderer.invoke("terminal:create", cwd),
  writeTerminal: (id, data) =>
    ipcRenderer.send("terminal:write", { id, data }),
  resizeTerminal: (id, cols, rows) =>
    ipcRenderer.send("terminal:resize", { id, cols, rows }),
  killTerminal: (id) => ipcRenderer.send("terminal:kill", id),
  codexStatus: () => ipcRenderer.invoke("system:codex-status"),
  openPath: (targetPath) => ipcRenderer.invoke("system:open-path", targetPath),
  showItem: (targetPath) => ipcRenderer.invoke("system:show-item", targetPath),
  onTerminalData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("terminal:exit", listener);
    return () => ipcRenderer.removeListener("terminal:exit", listener);
  },
  onBlogProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("blog:progress", listener);
    return () => ipcRenderer.removeListener("blog:progress", listener);
  }
});
