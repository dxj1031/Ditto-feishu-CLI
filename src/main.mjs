import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultWorkspace, getDialogContent, getValidationPrompt, normalizeWorkspace, runSetup } from "./setup-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let running = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 820,
    minHeight: 600,
    title: "Feishu CLI Setup",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle("workspace:default", () => getDefaultWorkspace());

function normalizeLanguage(language = "zh") {
  return language === "en" ? "en" : "zh";
}

ipcMain.handle("workspace:choose", async (_event, language = "zh") => {
  const title = normalizeLanguage(language) === "en" ? "Choose workspace folder" : "选择工作目录";
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return normalizeWorkspace(result.filePaths[0]);
});

ipcMain.handle("clipboard:write", async (_event, text) => {
  clipboard.writeText(String(text || ""));
  return true;
});

ipcMain.handle("content:get", async (_event, kind, language) => getDialogContent(kind, language));

ipcMain.handle("setup:start", async (event, workspace, language = "zh") => {
  if (running) {
    const error = normalizeLanguage(language) === "en" ? "Setup is already running." : "安装流程已经在运行。";
    return { ok: false, error };
  }

  running = true;
  const webContents = event.sender;

  try {
    const summary = await runSetup({
      workspace,
      onLog: (line) => webContents.send("setup:log", line),
      onUrl: async (url) => {
        webContents.send("setup:url", url);
        await shell.openExternal(url);
      }
    });

    const prompt = getValidationPrompt(language);
    webContents.send("setup:complete", { ok: true, summary, prompt });
    return { ok: true, summary, prompt };
  } catch (error) {
    webContents.send("setup:complete", { ok: false, error: error.message });
    return { ok: false, error: error.message };
  } finally {
    running = false;
  }
});
