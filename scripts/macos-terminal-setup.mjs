import { spawn } from "node:child_process";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getValidationPrompt, runSetup } from "./setup-core.mjs";

const workspace = process.env.FEISHU_SETUP_WORKSPACE || path.join(os.homedir(), "feishu-CLI");
const logPath = path.join(os.homedir(), "feishu-setup-run.log");

await mkdir(path.dirname(logPath), { recursive: true });
await writeFile(logPath, `Feishu setup started at ${new Date().toISOString()}${os.EOL}`, "utf8");

function writeLog(line = "") {
  console.log(line);
  appendFile(logPath, `${line}${os.EOL}`, "utf8").catch(() => {});
}

function openUrl(url) {
  writeLog(`Opening browser authorization page: ${url}`);
  return new Promise((resolve) => {
    const child = spawn("open", [url], {
      detached: true,
      stdio: "ignore"
    });
    child.on("error", () => resolve(false));
    child.on("close", () => resolve(true));
    child.unref();
  });
}

writeLog("Feishu Setup for macOS");
writeLog("");
writeLog("This setup will prepare lark-cli and Feishu/Lark AI Agent Skills on this Mac.");
writeLog("Use your own Feishu account in the browser authorization page when it opens.");
writeLog(`Workspace: ${workspace}`);
writeLog(`Log file: ${logPath}`);
writeLog("");

try {
  const summary = await runSetup({
    workspace,
    onLog: writeLog,
    onUrl: openUrl
  });

  writeLog("");
  writeLog("SETUP COMPLETE");
  writeLog(`identity=${summary.identity}`);
  writeLog(`tokenStatus=${summary.tokenStatus}`);
  writeLog("");
  writeLog("Read-only validation prompt:");
  writeLog(getValidationPrompt("zh"));
  process.exitCode = 0;
} catch (error) {
  writeLog("");
  writeLog("SETUP FAILED");
  writeLog(error?.message || String(error));
  writeLog("");
  writeLog("Please send the log file above to support if you need help.");
  process.exitCode = 1;
}
