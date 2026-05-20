const workspaceInput = document.querySelector("#workspace");
const languageSelect = document.querySelector("#language");
const appTitle = document.querySelector("#app-title");
const languageLabel = document.querySelector("#language-label");
const workspaceLabel = document.querySelector("#workspace-label");
const browseButton = document.querySelector("#browse");
const runButton = document.querySelector("#run");
const copyUrlButton = document.querySelector("#copy-url");
const statusLabel = document.querySelector("#status");
const logBox = document.querySelector("#log");
const progress = document.querySelector("#progress");
const completeDialog = document.querySelector("#complete-dialog");
const promptRender = document.querySelector("#prompt-render");
const copyPromptButton = document.querySelector("#copy-prompt");
const okButton = document.querySelector("#ok");
const skillsGuideButton = document.querySelector("#skills-guide");
const installedSkillsButton = document.querySelector("#installed-skills");
const workflowPromptButton = document.querySelector("#workflow-prompt");
const visualWorkflowButton = document.querySelector("#visual-workflow");
const contentDialog = document.querySelector("#content-dialog");
const contentTitle = document.querySelector("#content-title");
const contentRender = document.querySelector("#content-render");
const copyContentButton = document.querySelector("#copy-content");
const closeContentButton = document.querySelector("#close-content");
const completeTitle = document.querySelector("#complete-title");
const completeDescription = document.querySelector("#complete-description");
const failureDialog = document.querySelector("#failure-dialog");
const failureTitle = document.querySelector("#failure-title");
const failureRender = document.querySelector("#failure-render");
const copyFailureButton = document.querySelector("#copy-failure");
const closeFailureButton = document.querySelector("#close-failure");

let lastUrl = "";
let busy = false;
let currentContentKind = "";
let promptSource = "";
let contentSource = "";
let failureSource = "";

const I18N = {
  zh: {
    htmlLang: "zh-CN",
    appTitle: "飞书 CLI Setup",
    language: "语言",
    workspace: "工作目录",
    browse: "选择",
    run: "run",
    copyUrl: "复制最近 URL",
    skillsGuide: "Skills 指南",
    installedSkills: "当前 Skills",
    workflowPrompt: "工作流 Prompt",
    visualWorkflow: "可视化工作流",
    copyPrompt: "复制 Prompt",
    copyFailure: "复制错误信息",
    copy: "复制",
    close: "关闭",
    ok: "OK",
    completeTitle: "安装完成",
    completeDescription: "使用飞书 Skills 前，请重启 Codex 或其他 AI 工具。可以复制下面这个只读验证 prompt：",
    copiedUrl: "最近 URL 已复制。",
    alertPrefix: "Feishu CLI setup 失败。",
    failureTitle: "安装失败",
    statuses: {
      ready: "准备就绪",
      running: "运行中...",
      complete: "完成",
      failed: "失败",
      bridgeFailed: "窗口桥接失败"
    },
    titles: {
      "skills-guide": "Skills 指南",
      "installed-skills": "当前 Skills",
      "workflow-prompt": "工作流 Prompt",
      "visual-workflow": "可视化工作流"
    }
  },
  en: {
    htmlLang: "en",
    appTitle: "Feishu CLI Setup",
    language: "Language",
    workspace: "Workspace folder",
    browse: "Browse",
    run: "run",
    copyUrl: "Copy last URL",
    skillsGuide: "Skills guide",
    installedSkills: "Current skills",
    workflowPrompt: "Workflow prompt",
    visualWorkflow: "Visual workflow",
    copyPrompt: "Copy prompt",
    copyFailure: "Copy error",
    copy: "Copy",
    close: "Close",
    ok: "OK",
    completeTitle: "Setup complete",
    completeDescription: "Restart Codex or your AI tool before using Feishu skills. You can copy this read-only validation prompt:",
    copiedUrl: "Last URL copied.",
    alertPrefix: "Feishu CLI setup failed.",
    failureTitle: "Setup failed",
    statuses: {
      ready: "Ready",
      running: "Running...",
      complete: "Complete",
      failed: "Failed",
      bridgeFailed: "Window bridge failed"
    },
    titles: {
      "skills-guide": "Skills guide",
      "installed-skills": "Current skills",
      "workflow-prompt": "Workflow prompt",
      "visual-workflow": "Visual workflow"
    }
  }
};

function currentLanguage() {
  return languageSelect.value === "en" ? "en" : "zh";
}

function text(key) {
  return I18N[currentLanguage()][key];
}

function setStatus(key) {
  statusLabel.dataset.statusKey = key;
  statusLabel.textContent = I18N[currentLanguage()].statuses[key];
}

function updateLanguage() {
  const strings = I18N[currentLanguage()];
  document.documentElement.lang = strings.htmlLang;
  appTitle.textContent = strings.appTitle;
  languageLabel.textContent = strings.language;
  workspaceLabel.textContent = strings.workspace;
  browseButton.textContent = strings.browse;
  runButton.textContent = strings.run;
  copyUrlButton.textContent = strings.copyUrl;
  skillsGuideButton.textContent = strings.skillsGuide;
  installedSkillsButton.textContent = strings.installedSkills;
  workflowPromptButton.textContent = strings.workflowPrompt;
  visualWorkflowButton.textContent = strings.visualWorkflow;
  copyPromptButton.textContent = strings.copyPrompt;
  copyFailureButton.textContent = strings.copyFailure;
  okButton.textContent = strings.ok;
  completeTitle.textContent = strings.completeTitle;
  completeDescription.textContent = strings.completeDescription;
  failureTitle.textContent = strings.failureTitle;
  copyContentButton.textContent = strings.copy;
  closeContentButton.textContent = strings.close;
  closeFailureButton.textContent = strings.close;
  if (currentContentKind) contentTitle.textContent = strings.titles[currentContentKind];
  setStatus(statusLabel.dataset.statusKey || "ready");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines, start) {
  const header = splitTableRow(lines[start]);
  const rows = [];
  let index = start + 2;

  while (index < lines.length && lines[index].trim().startsWith("|")) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const thead = `<thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`;
  const tbody = rows
    .map((row) => `<tr>${header.map((_cell, cellIndex) => `<td>${renderInline(row[cellIndex] || "")}</td>`).join("")}</tr>`)
    .join("");

  return {
    html: `<div class="table-scroll"><table>${thead}<tbody>${tbody}</tbody></table></div>`,
    next: index
  };
}

function renderMarkdown(source) {
  const lines = String(source || "").replace(/\r/g, "").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 3);
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (trimmed.startsWith("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const table = renderTable(lines, index);
      html.push(table.html);
      index = table.next;
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInline(lines[index].trim().replace(/^-\s+/, ""))}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${renderInline(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        index += 1;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !(lines[index].trim().startsWith("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) &&
      !/^-\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !/^(#{1,6})\s+/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${paragraph.map((item) => renderInline(item)).join("<br>")}</p>`);
  }

  return html.join("");
}

function buildFailureContent(error) {
  const message = String(error || "Unknown error");
  const lang = currentLanguage();
  const isSkillInstallError = /npx\s+skills\s+add|Feishu AI Agent Skills|lark-[a-z0-9-]+/i.test(message);

  if (lang === "en") {
    const steps = isSkillInstallError
      ? [
          "Click Close, then click run again. The installer now skips unsupported/deprecated skill names and uses the official full skills install when anything is missing.",
          "If it still fails, run `npx skills add larksuite/cli -g -y` in a terminal, then reopen this window and click run.",
          "If the terminal command also fails, check network/proxy/GitHub access and Node/npm availability, then copy this error when asking for help."
        ]
      : [
          "Read the failed command and last log lines in the main window.",
          "Fix the missing dependency, network access, permission, or authorization step mentioned in the error.",
          "Click run again after the fix."
        ];

    return `# Feishu CLI setup failed

## Error
\`\`\`text
${message}
\`\`\`

## Next steps
${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`;
  }

  const steps = isSkillInstallError
    ? [
        "点击关闭，回到主窗口后重新点击 run。安装器现在会跳过不支持或已废弃的 skill 名称，并在发现缺失时使用官方全量 Skills 安装。",
        "如果仍然失败，在终端里运行 `npx skills add larksuite/cli -g -y`，完成后重新打开这个窗口并点击 run。",
        "如果终端命令也失败，优先检查网络、代理、GitHub 访问、Node/npm/npx 是否可用，然后复制这段错误信息继续排查。"
      ]
    : [
        "先看主窗口日志里的失败命令和最后几行输出。",
        "按错误内容修复缺失依赖、网络访问、权限或授权步骤。",
        "修复后重新点击 run。"
      ];

  return `# Feishu CLI setup 失败

## 错误
\`\`\`text
${message}
\`\`\`

## 下一步
${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`;
}

if (!window.feishuSetup) {
  runButton.disabled = true;
  browseButton.disabled = true;
  copyUrlButton.disabled = true;
  skillsGuideButton.disabled = true;
  installedSkillsButton.disabled = true;
  workflowPromptButton.disabled = true;
  visualWorkflowButton.disabled = true;
  setStatus("bridgeFailed");
  appendLog("ERROR: window.feishuSetup is unavailable. Check preload configuration.");
}

function appendLog(line) {
  logBox.value += `${line}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function setBusy(value) {
  busy = value;
  runButton.disabled = value;
  browseButton.disabled = value;
  copyUrlButton.disabled = value || !lastUrl;
  skillsGuideButton.disabled = value;
  installedSkillsButton.disabled = value;
  workflowPromptButton.disabled = value;
  visualWorkflowButton.disabled = value;
  progress.classList.toggle("running", value);
}

async function init() {
  if (!window.feishuSetup) return;
  updateLanguage();
  workspaceInput.value = await window.feishuSetup.getDefaultWorkspace();
}

browseButton.addEventListener("click", async () => {
  const folder = await window.feishuSetup.chooseWorkspace(currentLanguage());
  if (folder) workspaceInput.value = folder;
});

runButton.addEventListener("click", async () => {
  if (busy) return;
  lastUrl = "";
  logBox.value = "";
  setStatus("running");
  setBusy(true);
  await window.feishuSetup.start(workspaceInput.value, currentLanguage());
});

copyUrlButton.addEventListener("click", async () => {
  if (!lastUrl) return;
  await window.feishuSetup.copy(lastUrl);
  appendLog(text("copiedUrl"));
});

copyPromptButton.addEventListener("click", async () => {
  await window.feishuSetup.copy(promptSource);
});

okButton.addEventListener("click", () => {
  completeDialog.close();
});

async function openContentDialog(kind) {
  if (!window.feishuSetup) return;
  currentContentKind = kind;
  contentTitle.textContent = I18N[currentLanguage()].titles[kind];
  contentSource = await window.feishuSetup.getContent(kind, currentLanguage());
  contentRender.innerHTML = renderMarkdown(contentSource);
  contentDialog.showModal();
}

skillsGuideButton.addEventListener("click", () => openContentDialog("skills-guide"));
installedSkillsButton.addEventListener("click", () => openContentDialog("installed-skills"));
workflowPromptButton.addEventListener("click", () => openContentDialog("workflow-prompt"));
visualWorkflowButton.addEventListener("click", () => openContentDialog("visual-workflow"));

copyContentButton.addEventListener("click", async () => {
  await window.feishuSetup.copy(contentSource);
});

closeContentButton.addEventListener("click", () => {
  currentContentKind = "";
  contentDialog.close();
});

copyFailureButton.addEventListener("click", async () => {
  await window.feishuSetup.copy(failureSource);
});

closeFailureButton.addEventListener("click", () => {
  failureDialog.close();
});

languageSelect.addEventListener("change", updateLanguage);

if (window.feishuSetup) {
  window.feishuSetup.onLog((line) => appendLog(line));

  window.feishuSetup.onUrl((url) => {
    lastUrl = url;
    if (!busy) copyUrlButton.disabled = false;
  });

  window.feishuSetup.onComplete((payload) => {
    setBusy(false);
    if (payload.ok) {
      setStatus("complete");
      promptSource = payload.prompt;
      promptRender.innerHTML = renderMarkdown(`\`\`\`text\n${promptSource}\n\`\`\``);
      completeDialog.showModal();
    } else {
      setStatus("failed");
      appendLog("");
      appendLog(`ERROR: ${payload.error}`);
      failureSource = buildFailureContent(payload.error);
      failureRender.innerHTML = renderMarkdown(failureSource);
      failureDialog.showModal();
    }
  });

  init();
} else {
  updateLanguage();
}
