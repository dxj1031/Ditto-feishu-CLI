const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const chosenRoot = path.parse(process.cwd()).root;
const expectedChosenWorkspace = path.join(chosenRoot, "feishu-CLI");
let chosenLanguage = "";
let copiedText = "";
const copiedTexts = [];
const fakePrompt = "Run a read-only Feishu CLI preflight.";
const fakeError = "Command failed (1): npx skills add larksuite/cli -g -y --skill lark-calendar";
let runCount = 0;
const fakeContent = {
  "skills-guide:en": "# Skills guide\n\n- Read first\n- Preview writes",
  "installed-skills:zh": "| 名称 | 权限 | 功能 |\n| --- | --- | --- |\n| lark-doc | docs:read | 读取文档 |"
};

ipcMain.handle("workspace:default", () => "DEFAULT_WORKSPACE");
ipcMain.handle("workspace:choose", (_event, language) => {
  chosenLanguage = language;
  return expectedChosenWorkspace;
});
ipcMain.handle("setup:start", (event) => {
  runCount += 1;
  if (runCount === 1) {
    event.sender.send("setup:complete", { ok: true, prompt: fakePrompt });
  } else {
    event.sender.send("setup:complete", { ok: false, error: fakeError });
  }
  return { ok: true };
});
ipcMain.handle("clipboard:write", (_event, text) => {
  copiedText = text;
  copiedTexts.push(text);
  return true;
});
ipcMain.handle("content:get", (_event, kind, language) => fakeContent[`${kind}:${language}`] || `CONTENT:${kind}:${language}`);

async function main() {
  await app.whenReady();

  const window = new BrowserWindow({
    show: false,
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(projectRoot, "src", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await window.loadFile(path.join(projectRoot, "src", "renderer", "index.html"));

  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const apiKeys = Object.keys(window.feishuSetup || {}).sort();
      const before = document.querySelector("#workspace").value;
      const initialBrowseText = document.querySelector("#browse").textContent;
      document.querySelector("#language").value = "en";
      document.querySelector("#language").dispatchEvent(new Event("change"));
      const englishWorkspaceLabel = document.querySelector("#workspace-label").textContent;
      document.querySelector("#browse").click();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const after = document.querySelector("#workspace").value;
    document.querySelector("#skills-guide").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const guide = document.querySelector("#content-render").textContent;
    document.querySelector("#close-content").click();
    document.querySelector("#language").value = "zh";
    document.querySelector("#language").dispatchEvent(new Event("change"));
    document.querySelector("#installed-skills").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const installed = document.querySelector("#content-render").textContent;
    const installedHasTable = Boolean(document.querySelector("#content-render table"));
    document.querySelector("#copy-content").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    document.querySelector("#close-content").click();
    document.querySelector("#run").click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const completeOpened = document.querySelector("#complete-dialog").open;
    const promptRendered = document.querySelector("#prompt-render").textContent;
    document.querySelector("#copy-prompt").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    document.querySelector("#ok").click();
    const completeClosed = !document.querySelector("#complete-dialog").open;
    document.querySelector("#run").click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const failureOpened = document.querySelector("#failure-dialog").open;
    const failureRendered = document.querySelector("#failure-render").textContent;
    document.querySelector("#copy-failure").click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    document.querySelector("#close-failure").click();
    const failureClosed = !document.querySelector("#failure-dialog").open;
    return { apiKeys, before, after, initialBrowseText, englishWorkspaceLabel, guide, installed, installedHasTable, completeOpened, promptRendered, completeClosed, failureOpened, failureRendered, failureClosed };
  })()
`);

const required = ["chooseWorkspace", "copy", "getContent", "getDefaultWorkspace", "onComplete", "onLog", "onUrl", "start"];
  for (const key of required) {
    if (!result.apiKeys.includes(key)) {
      throw new Error(`Missing preload API: ${key}`);
    }
  }

  if (result.before !== "DEFAULT_WORKSPACE") {
    throw new Error(`Default workspace did not initialize: ${result.before}`);
  }

if (result.after !== expectedChosenWorkspace) {
  throw new Error(`Browse button did not update workspace: ${result.after}`);
}

if (result.initialBrowseText !== "选择") {
  throw new Error(`Default language did not start in Chinese: ${result.initialBrowseText}`);
}

if (result.englishWorkspaceLabel !== "Workspace folder") {
  throw new Error(`English language switch failed: ${result.englishWorkspaceLabel}`);
}

if (chosenLanguage !== "en") {
  throw new Error(`Browse did not receive selected language: ${chosenLanguage}`);
}

if (!result.guide.includes("Skills guide") || !result.guide.includes("Read first")) {
  throw new Error(`Skills guide button did not render content: ${result.guide}`);
}

if (!result.installedHasTable || !result.installed.includes("lark-doc")) {
  throw new Error(`Current skills button did not render a table: ${result.installed}`);
}

if (!copiedTexts.includes(fakeContent["installed-skills:zh"])) {
  throw new Error(`Copy did not preserve markdown source: ${copiedText}`);
}

if (!result.completeOpened || !result.promptRendered.includes(fakePrompt) || !result.completeClosed) {
  throw new Error(`Completion dialog did not render and close correctly: ${JSON.stringify(result)}`);
}

if (!copiedTexts.includes(fakePrompt)) {
  throw new Error(`Prompt copy did not preserve source: ${copiedText}`);
}

if (!result.failureOpened || !result.failureRendered.includes(fakeError) || !result.failureRendered.includes("下一步") || !result.failureClosed) {
  throw new Error(`Failure dialog did not render next steps correctly: ${JSON.stringify(result)}`);
}

if (!copiedText.includes(fakeError)) {
  throw new Error(`Failure copy did not preserve error source: ${copiedText}`);
}

console.log("WINDOW SMOKE PASSED");
  window.destroy();
  app.exit(0);
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
