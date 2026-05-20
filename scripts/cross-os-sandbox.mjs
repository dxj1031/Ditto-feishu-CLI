import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LARK_SKILLS_FALLBACK, runSetup } from "../src/setup-core.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sandboxRoot = path.resolve(projectRoot, ".sandbox", "cross-os");
const hostWin = process.platform === "win32";

const mode = process.argv[2];
if (mode === "--tool") {
  await runTool(process.argv[3], process.argv[4], process.argv[5], process.argv.slice(6));
  process.exit(process.exitCode ?? 0);
}

const scenarios = [
  { name: "blank", node: false, lark: false, config: false, auth: false, skills: false },
  { name: "node-only", node: true, lark: false, config: false, auth: false, skills: false },
  { name: "lark-no-config", node: true, lark: true, config: false, auth: false, skills: false },
  { name: "config-no-auth", node: true, lark: true, config: true, auth: false, skills: true },
  { name: "ready", node: true, lark: true, config: true, auth: true, skills: true },
  { name: "duplicate-skills", node: true, lark: true, config: true, auth: true, skills: true, duplicateSkills: true },
  { name: "broken-skills", node: true, lark: true, config: true, auth: true, skills: true, brokenSkills: true }
];

for (const platform of ["win32", "darwin", "linux"]) {
  for (const scenario of scenarios) {
    await runPlatformSandbox(platform, scenario);
  }
}

console.log("CROSS-OS SANDBOX PASSED");

async function runPlatformSandbox(platform, scenario) {
  const root = path.join(sandboxRoot, platform, scenario.name);
  const bin = path.join(root, "bin");
  const workspace = path.join(root, "workspace");
  const logLines = [];
  const urls = [];

  await rm(root, { recursive: true, force: true });
  await mkdir(bin, { recursive: true });
  await mkdir(workspace, { recursive: true });
  await mkdir(path.join(root, "home", "AppData", "Roaming"), { recursive: true });
  await mkdir(path.join(root, "home", "AppData", "Local"), { recursive: true });
  await mkdir(path.join(root, "state"), { recursive: true });

  const packageManager = platform === "win32" ? "winget" : platform === "darwin" ? "brew" : "apt-get";
  await writeTool(bin, packageManager, root, platform);
  await seedScenario(root, platform, scenario);

  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    FEISHU_SETUP_PLATFORM_OVERRIDE: platform,
    FEISHU_SETUP_ASSUME_ROOT: platform === "linux" ? "1" : "",
    FEISHU_SETUP_PATH_OVERRIDE: buildSandboxPath(bin),
    FEISHU_SANDBOX_ROOT: root,
    USERPROFILE: path.join(root, "home"),
    APPDATA: path.join(root, "home", "AppData", "Roaming"),
    LOCALAPPDATA: path.join(root, "home", "AppData", "Local"),
    HOME: path.join(root, "home"),
    TMP: path.join(root, "temp"),
    TEMP: path.join(root, "temp")
  });

  try {
    const summary = await runSetup({
      workspace,
      onLog: (line) => logLines.push(line),
      onUrl: (url) => urls.push(url)
    });

    await writeFile(path.join(root, "sandbox.log"), logLines.join(os.EOL), "utf8");

    if (summary.identity !== "user" || summary.tokenStatus !== "valid") {
      throw new Error(`${platform} summary invalid: ${JSON.stringify(summary)}`);
    }

    if (urls.some((url) => url.includes("github.com"))) {
      throw new Error(`${platform}/${scenario.name} opened an ordinary GitHub/Skills link.`);
    }

    const sawConfigUrl = urls.some((url) => url.includes("/sandbox/config"));
    const sawAuthUrl = urls.some((url) => url.includes("/sandbox/auth"));
    if (!scenario.config && !sawConfigUrl) {
      throw new Error(`${platform}/${scenario.name} did not open config URL. URLs: ${urls.join(", ")}`);
    }
    if (scenario.config && sawConfigUrl) {
      throw new Error(`${platform}/${scenario.name} opened config URL even though config was preseeded.`);
    }
    if (!sawAuthUrl) {
      throw new Error(`${platform}/${scenario.name} did not open auth URL. URLs: ${urls.join(", ")}`);
    }

    const logText = logLines.join("\n");
    const packageManagerRan = logText.includes(`[sandbox ${platform} ${packageManager}]`);
    const larkInstallRan = logText.includes("official Feishu CLI install");

    if (scenario.node && packageManagerRan) {
      throw new Error(`${platform}/${scenario.name} ran ${packageManager} even though node was preseeded.`);
    }
    if (scenario.lark && larkInstallRan) {
      throw new Error(`${platform}/${scenario.name} installed lark-cli even though it was preseeded.`);
    }

    await assertSkillState(root, platform, scenario);

    console.log(`[${platform}/${scenario.name}] ok; opened URLs: ${urls.join(", ")}`);
  } catch (error) {
    await writeFile(path.join(root, "sandbox.log"), logLines.join(os.EOL), "utf8");
    throw error;
  } finally {
    process.env = previousEnv;
  }
}

async function seedScenario(root, platform, scenario) {
  if (scenario.node) {
    await installNodeShims(root, platform);
  }
  if (scenario.lark) {
    await installLarkCliShim(root, platform);
  }
  if (scenario.skills) {
    await installSandboxSkills(root, platform, LARK_SKILLS_FALLBACK);
  }
  if (scenario.duplicateSkills) {
    await installSandboxSkills(root, platform, LARK_SKILLS_FALLBACK, ".codex");
  }
  if (scenario.brokenSkills) {
    await rm(path.join(root, "home", ".agents", "skills", "lark-calendar", "SKILL.md"), { force: true });
  }
  if (scenario.config) {
    await writeFile(path.join(root, "state", "config.ok"), "ok", "utf8");
  }
  if (scenario.auth) {
    await writeFile(path.join(root, "state", "auth.ok"), "ok", "utf8");
  }
}

async function installSandboxSkills(root, platform, names, rootLabel = ".agents") {
  const skillsRoot = path.join(root, "home", rootLabel, "skills");
  await mkdir(skillsRoot, { recursive: true });
  for (const name of names) {
    const skillDir = path.join(skillsRoot, name);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n# ${name} ${platform} sandbox\n`, "utf8");
  }
}

async function assertSkillState(root, platform, scenario) {
  const roots = [
    path.join(root, "home", ".agents", "skills"),
    path.join(root, "home", ".codex", "skills")
  ];
  const counts = new Map();

  for (const skillsRoot of roots) {
    let children = [];
    try {
      children = await readdir(skillsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (!child.isDirectory() || !child.name.startsWith("lark-")) continue;
      counts.set(child.name, (counts.get(child.name) || 0) + 1);
    }
  }

  const missing = LARK_SKILLS_FALLBACK.filter((name) => !counts.has(name));
  const duplicated = [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`${platform}/${scenario.name} skills missing after sync: ${missing.join(", ")}`);
  }
  if (duplicated.length > 0) {
    throw new Error(`${platform}/${scenario.name} duplicate skills remain after sync: ${duplicated.join(", ")}`);
  }
}

function buildSandboxPath(bin) {
  if (hostWin) {
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    return [
      bin,
      path.join(systemRoot, "System32"),
      systemRoot,
      path.join(systemRoot, "System32", "Wbem"),
      path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0")
    ].join(path.delimiter);
  }

  return [bin, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(path.delimiter);
}

async function writeTool(bin, name, root, platform) {
  const nodePath = process.execPath;
  const ext = hostWin ? ".cmd" : "";
  const file = path.join(bin, `${name}${ext}`);
  const script = hostWin
    ? `@echo off\r\n"${nodePath}" "${__filename}" --tool "${name}" "${root}" "${platform}" %*\r\nexit /b %ERRORLEVEL%\r\n`
    : `#!/usr/bin/env bash\n"${nodePath}" "${__filename}" --tool "${name}" "${root}" "${platform}" "$@"\n`;
  await writeFile(file, script, "utf8");
  if (!hostWin) {
    await import("node:fs/promises").then((fs) => fs.chmod(file, 0o755));
  }
}

async function runTool(tool, root, platform, args) {
  const bin = path.join(root, "bin");
  const state = path.join(root, "state");
  await mkdir(bin, { recursive: true });
  await mkdir(state, { recursive: true });

  if (["winget", "brew", "apt-get"].includes(tool)) {
    console.log(`[sandbox ${platform} ${tool}] ${args.join(" ")}`);
    if (tool === "apt-get" && args[0] === "update") {
      console.log(`[sandbox ${platform} apt-get] update completed`);
      return;
    }
    await installNodeShims(root, platform);
    console.log(`[sandbox ${platform}] node/npm/npx shims installed`);
    return;
  }

  if (tool === "node") {
    if (args[0] === "--version") {
      console.log(`v24.99.0-${platform}-sandbox`);
      return;
    }
    throw new Error(`[sandbox ${platform} node] unsupported args: ${args.join(" ")}`);
  }

  if (tool === "npm") {
    if (args[0] === "--version") {
      console.log(`11.99.0-${platform}-sandbox`);
      return;
    }
    if (args[0] === "install" && args[1] === "-g" && args[2] === "@larksuite/cli@latest") {
      console.log(`[sandbox ${platform} npm] fallback lark-cli install`);
      await installLarkCliShim(root, platform);
      return;
    }
    throw new Error(`[sandbox ${platform} npm] unsupported args: ${args.join(" ")}`);
  }

  if (tool === "npx") {
    if (args[0] === "--version") {
      console.log(`11.99.0-${platform}-sandbox`);
      return;
    }
    if (args[0] === "--yes" && args[1] === "@larksuite/cli@latest" && args[2] === "install") {
      console.log(`[sandbox ${platform} npx] official Feishu CLI install`);
      console.log("[sandbox npx] ordinary info link, must not auto-open: https://github.com/larksuite/cli");
      await installLarkCliShim(root, platform);
      return;
    }
    if (args[0] === "skills" && args[1] === "add" && args.includes("--list")) {
      console.log(`[sandbox ${platform} npx] Found ${LARK_SKILLS_FALLBACK.length} skills`);
      for (const skill of LARK_SKILLS_FALLBACK) {
        console.log(`  ${skill}`);
      }
      console.log("  deprecated/reference names that must be ignored: lark-calendar-schedule-meeting lark-cli lark-whiteboard-cli");
      return;
    }
    if (args[0] === "skills" && args[1] === "add") {
      const skillIndex = args.indexOf("--skill");
      const names = skillIndex >= 0 ? args.slice(skillIndex + 1).filter((arg) => !arg.startsWith("-")) : LARK_SKILLS_FALLBACK;
      if (skillIndex >= 0 && names.length !== 1) {
        throw new Error(`[sandbox ${platform} npx] expected exactly one --skill value, got: ${names.join(" ")}`);
      }
      const unsupported = names.filter((name) => !LARK_SKILLS_FALLBACK.includes(name));
      if (unsupported.length > 0) {
        throw new Error(`[sandbox ${platform} npx] unsupported skill names: ${unsupported.join(", ")}`);
      }
      console.log(`[sandbox ${platform} npx] AI Agent Skills installed: ${names.length}`);
      console.log("[sandbox npx] ordinary skills link, must not auto-open: https://github.com/larksuite/cli/tree/main/skills");
      await installSandboxSkills(root, platform, names);
      return;
    }
    throw new Error(`[sandbox ${platform} npx] unsupported args: ${args.join(" ")}`);
  }

  if (tool === "lark-cli") {
    await runLarkCli(root, platform, args);
    return;
  }

  throw new Error(`Unknown sandbox tool: ${tool}`);
}

async function installNodeShims(root, platform) {
  const bin = path.join(root, "bin");
  await writeTool(bin, "node", root, platform);
  await writeTool(bin, "npm", root, platform);
  await writeTool(bin, "npx", root, platform);
}

async function installLarkCliShim(root, platform) {
  await writeTool(path.join(root, "bin"), "lark-cli", root, platform);
}

async function runLarkCli(root, platform, args) {
  const state = path.join(root, "state");
  const configOk = path.join(state, "config.ok");
  const authOk = path.join(state, "auth.ok");

  if (args[0] === "--version") {
    console.log(`lark-cli version 99.0.0-${platform}-sandbox`);
    return;
  }

  if (args[0] === "update") {
    console.log(`[sandbox ${platform} lark-cli] update completed`);
    return;
  }

  if (args[0] === "config" && args[1] === "show") {
    if (await exists(configOk)) {
      console.log(JSON.stringify({ appId: `sandbox_${platform}`, appSecret: "****", brand: "feishu", lang: "zh", profile: "sandbox", users: "Sandbox User (ou_sandbox)", workspace: "sandbox" }));
      return;
    }
    console.error(`[sandbox ${platform} lark-cli] no config yet`);
    process.exitCode = 1;
    return;
  }

  if (args[0] === "config" && args[1] === "init") {
    console.log(`[sandbox ${platform} lark-cli] open this config URL:`);
    console.log(`https://open.feishu.cn/${platform}/sandbox/config`);
    await writeFile(configOk, "ok", "utf8");
    return;
  }

  if (args[0] === "auth" && args[1] === "status") {
    if (await exists(authOk)) {
      console.log(JSON.stringify({ appId: `sandbox_${platform}`, brand: "feishu", defaultAs: "auto", expiresAt: "2099-01-01T00:00:00Z", grantedAt: "2099-01-01T00:00:00Z", identity: "user", refreshExpiresAt: "2099-01-08T00:00:00Z", scope: "sandbox_scope offline_access", tokenStatus: "valid", userName: "Sandbox User", userOpenId: "ou_sandbox" }));
      return;
    }
    console.log(JSON.stringify({ appId: `sandbox_${platform}`, brand: "feishu", identity: "user", tokenStatus: "missing" }));
    process.exitCode = 1;
    return;
  }

  if (args[0] === "auth" && args[1] === "login" && args[2] === "--recommend") {
    console.log(JSON.stringify({ verification_url: `https://accounts.feishu.cn/${platform}/sandbox/auth`, device_code: `SANDBOX-${platform.toUpperCase()}` }));
    return;
  }

  if (args[0] === "auth" && args[1] === "login" && args[2] === "--device-code") {
    if (args[3] === `SANDBOX-${platform.toUpperCase()}`) {
      await writeFile(authOk, "ok", "utf8");
      console.log(`[sandbox ${platform} lark-cli] auth completed`);
      return;
    }
    console.error(`[sandbox ${platform} lark-cli] invalid device code`);
    process.exitCode = 1;
    return;
  }

  console.error(`[sandbox ${platform} lark-cli] unsupported args: ${args.join(" ")}`);
  process.exitCode = 1;
}

async function exists(file) {
  try {
    await import("node:fs/promises").then((fs) => fs.access(file));
    return true;
  } catch {
    return false;
  }
}
