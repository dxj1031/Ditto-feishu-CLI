import assert from "node:assert/strict";
import path from "node:path";
import { normalizeWorkspace } from "../src/setup-core.mjs";

const root = path.parse(process.cwd()).root;
assert.equal(normalizeWorkspace(root), path.join(root, "feishu-CLI"));

const nested = path.join(root, "example-folder");
assert.equal(normalizeWorkspace(nested), path.resolve(nested));

if (process.platform === "win32") {
  assert.equal(normalizeWorkspace("C:\\"), "C:\\feishu-CLI");
  assert.equal(normalizeWorkspace("C:\\Work"), "C:\\Work");
}

console.log("WORKSPACE NORMALIZE TEST PASSED");
