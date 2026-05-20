import { runCommand } from "../src/setup-core.mjs";

const commands = [
  ["node", ["--version"], false],
  ["npm", ["--version"], false],
  ["npx", ["--version"], false],
  ["lark-cli", ["--version"], false],
  ["lark-cli", ["config", "show"], true],
  ["lark-cli", ["auth", "status"], true]
];

for (const [command, args, allowFailure] of commands) {
  const result = await runCommand(command, args, {
    allowFailure,
    onLog: (line) => console.log(line)
  });
  if (result.exitCode !== 0 && !allowFailure) {
    throw new Error(`Smoke test failed: ${result.command}`);
  }
}

console.log("SMOKE TEST PASSED");
