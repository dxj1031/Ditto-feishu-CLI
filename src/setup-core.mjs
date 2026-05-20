import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/g;
export const LARK_SKILLS_FALLBACK = [
  "lark-approval",
  "lark-attendance",
  "lark-base",
  "lark-calendar",
  "lark-contact",
  "lark-doc",
  "lark-drive",
  "lark-event",
  "lark-im",
  "lark-mail",
  "lark-markdown",
  "lark-minutes",
  "lark-okr",
  "lark-openapi-explorer",
  "lark-shared",
  "lark-sheets",
  "lark-skill-maker",
  "lark-slides",
  "lark-task",
  "lark-vc",
  "lark-vc-agent",
  "lark-whiteboard",
  "lark-wiki",
  "lark-workflow-meeting-summary",
  "lark-workflow-standup-report"
];

const LARK_SKILL_ENGLISH_FUNCTIONS = {
  "lark-approval": "Feishu Approval API operations for approval instances and approval tasks.",
  "lark-attendance": "Query personal Feishu attendance and check-in records.",
  "lark-base": "Search, create, inspect, and manage Feishu Base apps, tables, fields, records, views, roles, dashboards, forms, and workflows.",
  "lark-calendar": "Manage Feishu calendars and events, including agenda lookup, event creation, updates, attendees, rooms, free/busy checks, and RSVP.",
  "lark-contact": "Resolve Feishu users by name or email to open IDs, and look up user profile, department, email, and contact details.",
  "lark-doc": "Create, read, summarize, rewrite, translate, review, and edit Feishu Docx and Wiki document content.",
  "lark-drive": "Manage Feishu Drive files and folders, including upload, download, import, move, copy, delete, permissions, comments, and titles.",
  "lark-event": "Subscribe to and consume Feishu real-time events such as IM messages, reactions, chat membership changes, and event streams.",
  "lark-im": "Send, draft, search, and manage Feishu IM messages, chats, members, files, images, and reactions.",
  "lark-mail": "Read, search, draft, send, reply, forward, and manage Feishu Mail messages, folders, labels, contacts, attachments, and rules.",
  "lark-markdown": "Create, read, upload, and edit Markdown files through Feishu workflows.",
  "lark-minutes": "Search Feishu Minutes, fetch summaries and action items, download media, and upload audio or video to generate meeting notes.",
  "lark-okr": "View and manage Feishu OKR cycles, objectives, key results, alignment, metrics, and progress records.",
  "lark-openapi-explorer": "Explore Feishu OpenAPI documentation and call raw APIs when no existing lark-* skill or CLI command covers the request.",
  "lark-shared": "Handle shared Feishu CLI setup, login, identity switching, permission errors, scope requests, updates, and JSON notices.",
  "lark-sheets": "Create and manage Feishu Sheets, worksheets, cells, rows, search, export, and spreadsheet data operations.",
  "lark-skill-maker": "Create reusable lark-cli custom skills from Feishu API workflows.",
  "lark-slides": "Create, read, and update Feishu Slides presentations and slide pages through the XML protocol.",
  "lark-task": "Manage Feishu Tasks, task lists, subtasks, assignees, attachments, task agents, and task records.",
  "lark-vc": "Search Feishu video meetings and retrieve meeting summaries, transcripts, artifacts, and participant snapshots.",
  "lark-vc-agent": "Join or leave active Feishu video meetings as an agent and read real-time meeting events.",
  "lark-whiteboard": "Read, export, and edit Feishu whiteboards, including diagrams from DSL, Mermaid, PlantUML, and structured workflows.",
  "lark-wiki": "Manage Feishu Wiki spaces, space members, document nodes, hierarchy, moves, copies, and shortcuts.",
  "lark-workflow-meeting-summary": "Workflow skill for collecting meeting minutes across a date range and generating a structured report.",
  "lark-workflow-standup-report": "Workflow skill that combines agenda and task data into a daily or weekly standup summary."
};

function normalizeLanguage(language = "zh") {
  return language === "en" ? "en" : "zh";
}

function targetPlatform() {
  return process.env.FEISHU_SETUP_PLATFORM_OVERRIDE || process.platform;
}

function hostPlatform() {
  return process.platform;
}

export function getDefaultWorkspace() {
  return path.resolve(process.cwd());
}

export function normalizeWorkspace(input) {
  const workspace = path.resolve(input || getDefaultWorkspace());
  const parsed = path.parse(workspace);
  const root = path.resolve(parsed.root);
  if (workspace === root) {
    return path.join(workspace, "feishu-CLI");
  }
  return workspace;
}

export function getValidationPrompt(language = "zh") {
  if (normalizeLanguage(language) === "en") {
    return `Run a read-only Feishu CLI preflight. Check \`lark-cli --version\`, \`lark-cli config show\`, and \`lark-cli auth status\`. Report the CLI version, whether app config exists, the current identity, tokenStatus, and whether Feishu Skills are ready to use. Do not create, update, delete, send, or modify anything in Feishu.`;
  }

  return `请运行只读的飞书 CLI 预检。检查 \`lark-cli --version\`、\`lark-cli config show\` 和 \`lark-cli auth status\`。只汇报 CLI 版本、是否存在 app 配置、当前 identity、tokenStatus，以及是否可以开始使用飞书 Skills。不要创建、更新、删除、发送或修改任何飞书内容。`;
}

export function getSkillsGuide(language = "zh") {
  if (normalizeLanguage(language) === "en") {
    return `Feishu/Lark Skills Guide

Core usage:
1. Describe the goal in natural language first; do not start with raw commands.
2. When possible, include URLs, titles, chat names, date ranges, people, tables, or files.
3. For create, update, send, delete, move, or bulk operations, ask the AI to dry-run or preview before writing.
4. To force a specific skill, name it directly, for example: use lark-calendar, use lark-doc, use lark-base.

Natural-language examples:
- Check my Feishu CLI authorization status. Read-only only; do not modify anything.
- Use lark-calendar to summarize today's schedule and list possible conflicts.
- Use lark-doc to read this document, extract action items, and group them by owner.
- Use lark-base to inspect this Base schema and suggest a customer follow-up workflow.
- Use lark-im to draft a group announcement. Dry-run first; do not send it directly.
- Use lark-whiteboard to turn the workflow below into a Feishu whiteboard.

Safety defaults:
- Query/read/summarize: can run directly.
- Create/update/send: preview first, then confirm.
- Delete/overwrite/move/bulk write: must dry-run and wait for explicit confirmation.`;
  }

  return `Feishu/Lark Skills 使用指南

核心用法：
1. 用自然语言说目标，不要先写命令。
2. 涉及飞书对象时尽量给 URL、标题、群名、日期范围或负责人。
3. 写入、删除、发消息、移动文件前，要求 AI 先 dry-run 或先给预览。
4. 如果要强制使用某个 skill，可以直接点名，例如：使用 lark-calendar、使用 lark-doc、使用 lark-base。

常用自然语言例子：
- 检查我的飞书 CLI 授权状态，只读，不要修改任何内容。
- 使用 lark-calendar 总结我今天的日程，并列出可能的冲突。
- 使用 lark-doc 读取这个文档，提取 action items，并按负责人分类。
- 使用 lark-base 查看这个 Base 的表结构，建议一个客户跟进 workflow。
- 使用 lark-im 起草一条群通知，先 dry-run 给我确认，不要直接发送。
- 使用 lark-whiteboard 把下面的流程画成飞书画板。

安全默认值：
- 查询、读取、总结：可以直接执行。
- 创建、更新、发送：先预览，再确认。
- 删除、覆盖、移动、批量写入：必须 dry-run，并等待明确确认。`;
}

export function getWorkflowPrompt(language = "zh") {
  if (normalizeLanguage(language) === "en") {
    return `Convert a natural-language request into a Feishu workflow prompt:

You are a Feishu CLI workflow design assistant. Convert my natural-language request into an executable workflow, but do not write anything to Feishu yet.

Output:
1. Goal: one sentence describing what should be done.
2. Inputs: URLs, dates, people, chats, tables, or files I need to provide.
3. Skills: which lark-* skills to use, and in what order.
4. Steps: what each step reads, generates, and whether it needs confirmation.
5. Risks: which steps create, update, send, delete, move, or bulk modify content.
6. Dry-run: how to preview the execution before writing.
7. Success criteria: how to know the workflow is complete.

My request:
<paste your natural-language request here>`;
  }

  return `把自然语言需求转成飞书工作流 prompt：

你是飞书 CLI 工作流设计助手。请把我的自然语言需求转成可执行工作流，但先不要写入飞书。

请输出：
1. 目标：一句话说明要完成什么。
2. 输入：需要我提供哪些 URL、日期、人员、群、表格或文件。
3. Skills：应该使用哪些 lark-* skills，以及使用顺序。
4. 步骤：每一步要读取什么、生成什么、是否需要确认。
5. 风险：哪些步骤是写入、发送、删除、移动或批量修改。
6. Dry-run：给出执行前预览方案。
7. 成功标准：怎么判断 workflow 完成。

我的需求：
<在这里粘贴你的自然语言需求>`;
}

export function getVisualWorkflow(language = "zh") {
  if (normalizeLanguage(language) === "en") {
    return `Visual workflow template:

Request input
  -> Identify Feishu object
     - Doc / Calendar / Chat / Base / Sheet / Task / Mail / Minutes
  -> Choose Skills
     - lark-doc / lark-calendar / lark-im / lark-base / lark-sheets / lark-task / ...
  -> Read-only preflight
     - auth status
     - config show
     - resource access check
  -> Read and analyze
     - fetch/search/list
     - summarize/classify/extract
  -> Generate plan
     - actions
     - owners
     - dates
     - target resources
  -> Risk check
     - read-only: run directly
     - write/send/update: dry-run first
     - delete/move/bulk update: explicit confirmation required
  -> Execute
  -> Verify result
  -> Output links, summary, and next step`;
  }

  return `可视化工作流模板：

需求输入
  -> 识别飞书对象
     - 文档 / 日历 / 群消息 / Base / 表格 / 任务 / 邮件 / 会议纪要
  -> 选择 Skills
     - lark-doc / lark-calendar / lark-im / lark-base / lark-sheets / lark-task / ...
  -> 只读预检
     - auth status
     - config show
     - 资源是否可访问
  -> 读取与分析
     - fetch/search/list
     - summarize/classify/extract
  -> 生成计划
     - actions
     - owners
     - dates
     - target resources
  -> 风险判断
     - read-only: 直接执行
     - write/send/update: 先 dry-run
     - delete/move/bulk update: 必须确认
  -> 执行
  -> 验证结果
  -> 输出链接、摘要、下一步`;
}

function parseFrontmatterDescription(text) {
  const match = text.match(/^---\s*[\s\S]*?\bdescription:\s*["']?(.+?)["']?\s*$/m);
  return match ? match[1].trim() : "";
}

function extractScopes(text) {
  const scopes = new Set();
  const lines = text.replace(/\r/g, "").split("\n");
  let inPermissionSection = false;
  let headingLevel = 0;

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const title = heading[2];
      const level = heading[1].length;
      if (inPermissionSection && level <= headingLevel) {
        inPermissionSection = false;
      }
      if (/权限表|权限速查|permission scopes?/i.test(title)) {
        inPermissionSection = true;
        headingLevel = level;
      }
      continue;
    }

    if (!inPermissionSection) continue;

    for (const match of line.matchAll(/`([a-z][a-z0-9_]+:[a-zA-Z0-9_.:-]+(?::[a-zA-Z0-9_.:-]+)?)`/g)) {
      const value = match[1];
      if (value === "scope:name") continue;
      scopes.add(value);
    }
  }
  return [...scopes].sort();
}

function compactText(text, max = 120) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 3)}...`;
}

export async function getInstalledSkillsReport(language = "zh") {
  const lang = normalizeLanguage(language);
  const entries = await scanInstalledLarkSkills(LARK_SKILLS_FALLBACK);
  const validEntries = entries
    .filter((entry) => entry.hasSkillFile)
    .sort((a, b) => a.name.localeCompare(b.name) || a.rootPriority - b.rootPriority);

  if (validEntries.length === 0) {
    return lang === "en" ? "No installed lark-* skills were found." : "当前没有扫描到已安装的 lark-* skills。";
  }

  const rows = [];
  for (const entry of validEntries) {
    const text = await readFile(path.join(entry.path, "SKILL.md"), "utf8");
    const description =
      lang === "en"
        ? LARK_SKILL_ENGLISH_FUNCTIONS[entry.name] || "No English function description declared."
        : parseFrontmatterDescription(text) || "未声明功能描述。";
    const scopes = extractScopes(text);
    rows.push({
      name: entry.name,
      root: entry.rootLabel,
      permissions:
        scopes.length > 0
          ? compactText(scopes.join(", "), 160)
          : lang === "en"
            ? "No fixed scope declared in SKILL.md; lark-cli checks permissions per command."
            : "未在 SKILL.md 中声明固定 scope；按具体命令动态检查。",
      functionText: compactText(description, 160)
    });
  }

  const lines =
    lang === "en"
      ? [
          "Current Feishu/Lark Skills",
          "",
          "Note: the permissions column is parsed from scope/permission text in each SKILL.md. Skills without fixed scopes are checked by lark-cli when a command runs.",
          "",
          "| Name | Location | Permissions | Function |",
          "| --- | --- | --- | --- |"
        ]
      : [
          "当前已有 Feishu/Lark Skills 列表",
          "",
          "说明：权限列来自每个 SKILL.md 中可解析到的 scope/权限文本；未声明固定 scope 的 skill 会在具体命令执行时由 lark-cli 检查权限。",
          "",
          "| 名称 | 位置 | 权限 | 功能 |",
          "| --- | --- | --- | --- |"
        ];

  for (const row of rows) {
    lines.push(`| ${row.name} | ${row.root} | ${row.permissions} | ${row.functionText} |`);
  }

  return lines.join("\n");
}

export async function getDialogContent(kind, language = "zh") {
  if (kind === "installed-skills") return getInstalledSkillsReport(language);
  if (kind === "skills-guide") return getSkillsGuide(language);
  if (kind === "workflow-prompt") return getWorkflowPrompt(language);
  if (kind === "visual-workflow") return getVisualWorkflow(language);
  return getValidationPrompt(language);
}

function pathKey(env = process.env) {
  return Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
}

function mergePath(entries, env = process.env) {
  const key = pathKey(env);
  const existing = env[key] || "";
  const sep = path.delimiter;
  const seen = new Set();
  const parts = [...entries, ...existing.split(sep)]
    .filter(Boolean)
    .filter((entry) => {
      const normalized = entry.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  return { ...env, [key]: parts.join(sep) };
}

function buildEnv(extra = {}) {
  if (process.env.FEISHU_SETUP_PATH_OVERRIDE) {
    return { ...process.env, ...extra, [pathKey()]: process.env.FEISHU_SETUP_PATH_OVERRIDE };
  }

  const platform = targetPlatform();
  const common =
    platform === "win32"
      ? [
          "C:\\Program Files\\nodejs",
          path.join(process.env.APPDATA || "", "npm")
        ]
      : platform === "darwin"
        ? ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
        : ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];

  return mergePath(common, { ...process.env, ...extra });
}

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function skillRoots() {
  const home = homeDir();
  return [
    { label: ".agents", path: path.join(home, ".agents", "skills"), priority: 0 },
    { label: ".codex", path: path.join(home, ".codex", "skills"), priority: 1 }
  ];
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function formatCommandForLog(command, args) {
  const safeArgs = args.map((arg, index) => (args[index - 1] === "--device-code" ? "<redacted-device-code>" : arg));
  return [command, ...safeArgs].join(" ");
}

function redactObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const sensitive = new Set([
    "appid",
    "appsecret",
    "profile",
    "users",
    "username",
    "useropenid",
    "openid",
    "user_id",
    "open_id",
    "union_id",
    "device_code",
    "access_token",
    "refresh_token",
    "token",
    "scope"
  ]);

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (sensitive.has(key.toLowerCase())) {
      output[key] = "<redacted>";
    } else {
      output[key] = redactObject(item);
    }
  }
  return output;
}

function stripAnsi(text) {
  return text
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
    .replace(/\x9B[0-?]*[ -/]*[@-~]/g, "");
}

function sanitizeLogLine(line) {
  line = stripAnsi(line);
  const trimmed = line.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.stringify(redactObject(JSON.parse(trimmed)));
    } catch {
      // Fall through to regex redaction.
    }
  }

  return line
    .replace(/("(?:appId|appSecret|profile|users|userName|userOpenId|openId|scope|device_code|access_token|refresh_token|token)"\s*:\s*)"[^"]*"/gi, '$1"<redacted>"')
    .replace(/(Config file path:\s*).*/i, "$1<redacted>")
    .replace(/(device_code["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, "$1<redacted>")
    .replace(/(appSecret["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, "$1<redacted>")
    .replace(/(access_token["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, "$1<redacted>")
    .replace(/(refresh_token["']?\s*[:=]\s*["']?)[^"',\s}]+/gi, "$1<redacted>");
}

function quoteWindowsArg(value) {
  const text = String(value ?? "");
  if (!/[\s"&|<>()^]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function getSpawnCommand(command, args) {
  if (hostPlatform() !== "win32") {
    return { file: command, args };
  }

  const comspec = process.env.ComSpec || process.env.COMSPEC || "cmd.exe";
  const commandLine = [command, ...args].map(quoteWindowsArg).join(" ");
  return { file: comspec, args: ["/d", "/s", "/c", commandLine] };
}

function splitLines(text) {
  return text.replace(/\r/g, "").split("\n");
}

function decodeProcessChunk(chunk) {
  const utf8 = chunk.toString("utf8");
  if (hostPlatform() !== "win32" || !utf8.includes("\uFFFD")) {
    return utf8;
  }
  return new TextDecoder("gb18030").decode(chunk);
}

function trimUrl(url) {
  return url.replace(/[.,;)\]]+$/g, "");
}

function extractUrls(text) {
  return [...text.matchAll(URL_PATTERN)].map((match) => trimUrl(match[0]));
}

export function runCommand(command, args = [], options = {}) {
  const {
    cwd = process.cwd(),
    allowFailure = false,
    openDetectedUrls = false,
    onLog = () => {},
    onUrl = () => {},
    env = buildEnv()
  } = options;

  return new Promise((resolve, reject) => {
    onLog("");
    onLog(`> ${formatCommandForLog(command, args)}`);

    const spawnCommand = getSpawnCommand(command, args);
    const child = spawn(spawnCommand.file, spawnCommand.args, {
      cwd,
      env,
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const seenUrls = new Set();

    const handleChunk = (chunk, target) => {
      const text = decodeProcessChunk(chunk);
      if (target === "stdout") stdout += text;
      if (target === "stderr") stderr += text;

      for (const line of splitLines(text)) {
        if (!line) continue;
        onLog(sanitizeLogLine(line));
        if (!openDetectedUrls) continue;
        for (const url of extractUrls(line)) {
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          onLog("[URL] Setup or authorization link opened in browser.");
          onUrl(url);
        }
      }
    };

    child.stdout?.on("data", (chunk) => handleChunk(chunk, "stdout"));
    child.stderr?.on("data", (chunk) => handleChunk(chunk, "stderr"));

    child.on("error", (error) => {
      const result = { command: formatCommand(command, args), exitCode: -1, stdout: stdout.trim(), stderr: `${stderr}${error.message}`.trim() };
      if (allowFailure) {
        resolve(result);
      } else {
        reject(new Error(`Command failed to start: ${result.command}\n${error.message}`));
      }
    });

    child.on("close", (code) => {
      const result = { command: formatCommand(command, args), exitCode: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() };
      if (result.exitCode !== 0 && !allowFailure) {
        reject(new Error(`Command failed (${result.exitCode}): ${result.command}\n${result.stderr}\n${result.stdout}`));
        return;
      }
      resolve(result);
    });
  });
}

async function commandAvailable(command) {
  const check =
    hostPlatform() === "win32"
      ? ["where", [command]]
      : ["sh", ["-lc", `command -v ${command}`]];
  const result = await runCommand(check[0], check[1], { allowFailure: true, onLog: () => {} });
  return result.exitCode === 0;
}

async function installNodeIfMissing({ onLog, onUrl }) {
  if (await commandAvailable("node")) return;

  onLog("Node.js is missing.");

  const platform = targetPlatform();
  const assumeRoot = process.env.FEISHU_SETUP_ASSUME_ROOT === "1";

  if (platform === "win32" && (await commandAvailable("winget"))) {
    await runCommand("winget", ["install", "--id", "OpenJS.NodeJS.LTS", "--exact", "--accept-source-agreements", "--accept-package-agreements"], { onLog });
    return;
  }

  if (platform === "darwin" && (await commandAvailable("brew"))) {
    await runCommand("brew", ["install", "node"], { onLog });
    return;
  }

  if (platform === "linux" && (assumeRoot || (typeof process.getuid === "function" && process.getuid() === 0)) && (await commandAvailable("apt-get"))) {
    await runCommand("apt-get", ["update"], { onLog });
    await runCommand("apt-get", ["install", "-y", "nodejs", "npm"], { onLog });
    return;
  }

  const nodeUrl = "https://nodejs.org/";
  onLog(`[URL] ${nodeUrl}`);
  onUrl(nodeUrl);
  throw new Error("Node.js is missing. Install Node.js LTS, then run this setup again.");
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Could not parse JSON output.");
  }
}

function parseSkillNamesFromList(text) {
  const names = new Set();
  for (const match of text.matchAll(/\blark-[a-z0-9-]+\b/g)) {
    names.add(match[0]);
  }
  return [...names].sort();
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getOfficialLarkSkillNames({ cwd, onLog }) {
  onLog("Checking official Feishu AI Agent Skills list.");
  const result = await runCommand("npx", ["skills", "add", "larksuite/cli", "-g", "--list"], {
    cwd,
    onLog,
    allowFailure: true
  });

  if (result.exitCode === 0) {
    const parsed = parseSkillNamesFromList(`${result.stdout}\n${result.stderr}`);
    if (parsed.length > 0) {
      const canonical = new Set(LARK_SKILLS_FALLBACK);
      const recognized = parsed.filter((name) => canonical.has(name));
      const ignored = parsed.filter((name) => !canonical.has(name));
      onLog(`Official skills recognized: ${recognized.length}. Syncing canonical list: ${LARK_SKILLS_FALLBACK.length}`);
      if (ignored.length > 0) {
        onLog(`Skipped unsupported or deprecated skill names: ${ignored.join(", ")}`);
      }
      return [...LARK_SKILLS_FALLBACK];
    }
  }

  onLog(`Could not read official list. Using fallback list: ${LARK_SKILLS_FALLBACK.length}`);
  return [...LARK_SKILLS_FALLBACK];
}

async function scanInstalledLarkSkills(expectedNames) {
  const expected = new Set(expectedNames);
  const entries = [];

  for (const root of skillRoots()) {
    let children = [];
    try {
      children = await readdir(root.path, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const child of children) {
      if (!child.isDirectory()) continue;
      if (!child.name.startsWith("lark-")) continue;
      const fullPath = path.join(root.path, child.name);
      entries.push({
        name: child.name,
        root: root.path,
        rootLabel: root.label,
        rootPriority: root.priority,
        path: fullPath,
        expected: expected.has(child.name),
        hasSkillFile: await exists(path.join(fullPath, "SKILL.md"))
      });
    }
  }

  return entries;
}

function safeSkillPath(entry) {
  const root = path.resolve(entry.root);
  const target = path.resolve(entry.path);
  const relative = path.relative(root, target);
  return entry.name.startsWith("lark-") && relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function removeSkillEntry(entry, onLog, reason) {
  if (!safeSkillPath(entry)) {
    throw new Error(`Refusing to remove unsafe skill path for ${entry.name}.`);
  }
  await rm(entry.path, { recursive: true, force: true });
  onLog(`Removed ${reason}: ${entry.name} (${entry.rootLabel})`);
}

function chooseSkillToKeep(entries) {
  return [...entries].sort((a, b) => {
    if (a.hasSkillFile !== b.hasSkillFile) return a.hasSkillFile ? -1 : 1;
    if (a.rootPriority !== b.rootPriority) return a.rootPriority - b.rootPriority;
    return a.path.localeCompare(b.path);
  })[0];
}

async function cleanupDuplicateAndBrokenSkills(expectedNames, onLog) {
  const installed = await scanInstalledLarkSkills(expectedNames);
  const byName = new Map();

  for (const entry of installed) {
    if (!byName.has(entry.name)) byName.set(entry.name, []);
    byName.get(entry.name).push(entry);
  }

  let removed = 0;

  for (const [name, entries] of byName.entries()) {
    const brokenEntries = entries.filter((entry) => entry.expected && !entry.hasSkillFile);
    for (const entry of brokenEntries) {
      await removeSkillEntry(entry, onLog, "broken skill directory");
      removed += 1;
    }

    const validEntries = entries.filter((entry) => entry.expected && entry.hasSkillFile);
    if (validEntries.length > 1) {
      const keep = chooseSkillToKeep(validEntries);
      for (const entry of validEntries) {
        if (entry.path === keep.path) continue;
        await removeSkillEntry(entry, onLog, "duplicate skill copy");
        removed += 1;
      }
      onLog(`Kept canonical skill copy: ${name} (${keep.rootLabel})`);
    }
  }

  if (removed === 0) {
    onLog("No duplicate or broken Feishu skills found.");
  }
}

async function missingSkills(expectedNames) {
  const installed = await scanInstalledLarkSkills(expectedNames);
  const present = new Set(installed.filter((entry) => entry.expected && entry.hasSkillFile).map((entry) => entry.name));
  return expectedNames.filter((name) => !present.has(name));
}

async function installMissingLarkSkills({ cwd, onLog, missing }) {
  if (missing.length === 0) {
    onLog("Feishu AI Agent Skills are complete. Skipping install.");
    return;
  }

  onLog(`Missing Feishu skills: ${missing.length}`);
  onLog(`Missing list: ${missing.join(", ")}`);
  for (const name of missing) {
    onLog(`Installing missing skill: ${name}`);
    await runCommand("npx", ["skills", "add", "larksuite/cli", "-g", "-y", "--skill", name], {
      cwd,
      onLog
    });
  }
}

async function syncLarkSkills({ cwd, onLog }) {
  const expectedNames = await getOfficialLarkSkillNames({ cwd, onLog });
  onLog("Auditing installed Feishu AI Agent Skills.");
  await cleanupDuplicateAndBrokenSkills(expectedNames, onLog);

  const beforeInstallMissing = await missingSkills(expectedNames);
  await installMissingLarkSkills({ cwd, onLog, missing: beforeInstallMissing });

  await cleanupDuplicateAndBrokenSkills(expectedNames, onLog);
  const afterInstallMissing = await missingSkills(expectedNames);
  if (afterInstallMissing.length > 0) {
    throw new Error(`Feishu AI Agent Skills still missing after sync: ${afterInstallMissing.join(", ")}`);
  }

  onLog(`Feishu AI Agent Skills verified: ${expectedNames.length}/${expectedNames.length}`);
}

export async function runSetup({ workspace, onLog = () => {}, onUrl = () => {} } = {}) {
  const effectiveWorkspace = normalizeWorkspace(workspace);
  await mkdir(effectiveWorkspace, { recursive: true });

  onLog("Feishu CLI cross-platform setup started.");
  onLog("Workspace selected.");

  onLog("");
  onLog("PHASE 1 - Environment check and dependency install");

  onLog("");
  onLog("[1/12] Check Node.js");
  await installNodeIfMissing({ onLog, onUrl });
  await runCommand("node", ["--version"], { cwd: effectiveWorkspace, onLog });

  onLog("");
  onLog("[2/12] Check npm");
  if (!(await commandAvailable("npm"))) {
    throw new Error("npm is missing. Install Node.js with npm, then run this setup again.");
  }
  await runCommand("npm", ["--version"], { cwd: effectiveWorkspace, onLog });

  onLog("");
  onLog("[3/12] Check npx");
  if (!(await commandAvailable("npx"))) {
    throw new Error("npx is missing. Install a current Node.js/npm distribution, then run this setup again.");
  }
  await runCommand("npx", ["--version"], { cwd: effectiveWorkspace, onLog });

  onLog("");
  onLog("[4/12] Check Feishu CLI installation");
  if (await commandAvailable("lark-cli")) {
    onLog("lark-cli already exists. Skipping install.");
  } else {
    onLog("lark-cli is missing. Running official one-click install.");
    const installResult = await runCommand("npx", ["--yes", "@larksuite/cli@latest", "install"], {
      cwd: effectiveWorkspace,
      onLog,
      allowFailure: true
    });
    if (installResult.exitCode !== 0) {
      onLog("Official one-click install failed or was interrupted. Running npm fallback install.");
    }
  }

  if (!(await commandAvailable("lark-cli"))) {
    await runCommand("npm", ["install", "-g", "@larksuite/cli@latest"], { cwd: effectiveWorkspace, onLog });
  }

  onLog("");
  onLog("[5/12] Confirm Feishu CLI version");
  await runCommand("lark-cli", ["--version"], { cwd: effectiveWorkspace, onLog });

  onLog("");
  onLog("[6/12] Update lark-cli to latest");
  const updateResult = await runCommand("lark-cli", ["update"], { cwd: effectiveWorkspace, onLog, allowFailure: true });
  if (updateResult.exitCode !== 0) {
    onLog("lark-cli update failed or is unsupported here. Official/latest install already ran.");
  }

  onLog("");
  onLog("[7/12] Confirm Feishu CLI version after update");
  await runCommand("lark-cli", ["--version"], { cwd: effectiveWorkspace, onLog });

  onLog("");
  onLog("[8/12] Audit and sync Feishu AI Agent Skills");
  await syncLarkSkills({ cwd: effectiveWorkspace, onLog });

  onLog("");
  onLog("[9/12] Confirm existing CLI app config");
  const configResult = await runCommand("lark-cli", ["config", "show"], { cwd: effectiveWorkspace, onLog, allowFailure: true });
  if (configResult.exitCode !== 0) {
    onLog("No valid CLI app config found. Starting config init.");
    await runCommand("lark-cli", ["config", "init", "--new"], { cwd: effectiveWorkspace, onLog, onUrl, openDetectedUrls: true });
    await runCommand("lark-cli", ["config", "show"], { cwd: effectiveWorkspace, onLog });
  }

  onLog("");
  onLog("[10/12] Confirm current auth status");
  await runCommand("lark-cli", ["auth", "status"], { cwd: effectiveWorkspace, onLog, allowFailure: true });

  onLog("");
  onLog("PHASE 2 - Re-authorization");
  onLog("[11/12] Start recommended auth");
  const authStart = await runCommand("lark-cli", ["auth", "login", "--recommend", "--no-wait", "--json"], { cwd: effectiveWorkspace, onLog });
  const authPayload = parseJson(authStart.stdout);
  const verificationUrl = String(authPayload.verification_url || "");
  const deviceCode = String(authPayload.device_code || "");

  if (!verificationUrl || !deviceCode) {
    throw new Error("lark-cli did not return verification_url or device_code.");
  }

  onLog("Opening authorization URL:");
  onLog("[URL] Authorization link opened in browser.");
  onUrl(verificationUrl);

  onLog("");
  onLog("[12/12] Poll authorization result with device_code");
  await runCommand("lark-cli", ["auth", "login", "--device-code", deviceCode], { cwd: effectiveWorkspace, onLog });

  onLog("");
  onLog("Final verification: lark-cli auth status");
  const finalStatus = await runCommand("lark-cli", ["auth", "status"], { cwd: effectiveWorkspace, onLog });
  const summary = parseJson(finalStatus.stdout);

  if (summary.tokenStatus !== "valid" || summary.identity !== "user") {
    throw new Error(`Final auth verification did not pass: identity=${summary.identity}, tokenStatus=${summary.tokenStatus}`);
  }

  onLog("");
  onLog("SETUP_RESULT=SUCCESS");
  onLog(`Identity=${summary.identity}`);
  onLog(`TokenStatus=${summary.tokenStatus}`);

  return summary;
}
