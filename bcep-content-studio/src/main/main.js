const fs = require("node:fs/promises");
const path = require("node:path");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell
} = require("electron");
const {
  framePreview,
  generateFeatureImage,
  getVideoMetadata
} = require("./services/video-service");
const {
  commandExists,
  generateBlog,
  saveBlog
} = require("./services/blog-service");
const { TerminalService } = require("./services/terminal-service");

const terminalService = new TerminalService();
let mainWindow;

function projectRoot() {
  return path.join(app.getPath("documents"), "BCEP Content Studio");
}

function createWindow() {
  const icon = path.join(__dirname, "../../assets/app-icon-source.png");
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 960,
    minWidth: 420,
    minHeight: 640,
    backgroundColor: "#1a1a2e",
    title: "BCEP Content Studio",
    icon,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  mainWindow.removeMenu();
}

function requireWindow(event) {
  return BrowserWindow.fromWebContents(event.sender) || mainWindow;
}

function registerIpc() {
  ipcMain.handle("app:bootstrap", async () => {
    const outputDirectory = projectRoot();
    await fs.mkdir(outputDirectory, { recursive: true });
    return {
      outputDirectory,
      platform: process.platform,
      codexInstalled: await commandExists("codex"),
      version: app.getVersion()
    };
  });

  ipcMain.handle("dialog:video", async (event) => {
    const result = await dialog.showOpenDialog(requireWindow(event), {
      title: "Choose an OBS video",
      properties: ["openFile"],
      filters: [
        {
          name: "Video",
          extensions: ["mp4", "mov", "mkv", "webm", "m4v", "avi"]
        }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("dialog:transcript", async (event) => {
    const result = await dialog.showOpenDialog(requireWindow(event), {
      title: "Choose a transcript",
      properties: ["openFile"],
      filters: [
        { name: "Transcript", extensions: ["txt", "md", "srt", "vtt"] }
      ]
    });
    if (result.canceled) return null;
    const transcriptPath = result.filePaths[0];
    return {
      path: transcriptPath,
      content: await fs.readFile(transcriptPath, "utf8")
    };
  });

  ipcMain.handle("dialog:output", async (event, currentPath) => {
    const result = await dialog.showOpenDialog(requireWindow(event), {
      title: "Choose the BCEP project folder",
      defaultPath: currentPath || projectRoot(),
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("video:metadata", (_event, videoPath) =>
    getVideoMetadata(videoPath)
  );
  ipcMain.handle("video:preview", (_event, payload) =>
    framePreview(payload.videoPath, payload.seconds)
  );
  ipcMain.handle("feature:generate", (_event, payload) =>
    generateFeatureImage(payload)
  );

  ipcMain.handle("blog:generate", async (event, payload) =>
    generateBlog(payload, (message) => {
      if (message) event.sender.send("blog:progress", message);
    })
  );
  ipcMain.handle("blog:save", (_event, payload) => saveBlog(payload));

  ipcMain.handle("terminal:create", (event, cwd) =>
    terminalService.create(event.sender, cwd || projectRoot())
  );
  ipcMain.on("terminal:write", (_event, payload) =>
    terminalService.write(payload.id, payload.data)
  );
  ipcMain.on("terminal:resize", (_event, payload) =>
    terminalService.resize(payload.id, payload.cols, payload.rows)
  );
  ipcMain.on("terminal:kill", (_event, id) => terminalService.kill(id));

  ipcMain.handle("system:codex-status", () => commandExists("codex"));
  ipcMain.handle("system:open-path", async (_event, targetPath) => {
    const error = await shell.openPath(targetPath);
    return { ok: !error, error };
  });
  ipcMain.handle("system:show-item", (_event, targetPath) => {
    shell.showItemInFolder(targetPath);
    return true;
  });
}

app.whenReady().then(() => {
  app.setName("BCEP Content Studio");
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  terminalService.killAll();
  if (process.platform !== "darwin") app.quit();
});
