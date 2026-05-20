# Feishu CLI Setup

Cross-platform window setup for Feishu/Lark CLI and AI Agent Skills.

## Start

Windows:

```powershell
.\start-feishu-cli-setup.cmd
```

macOS/Linux:

```bash
./start-feishu-cli-setup.sh
```

macOS double-click launcher:

```bash
./start-feishu-cli-setup.command
```

## Window

- Language: switch the UI and built-in prompts between Chinese and English.
- Workspace: choose a working folder. If a disk root is selected, the app uses a `feishu-CLI` subfolder.
- run: checks dependencies, installs or updates missing pieces, opens Feishu authorization in the browser, and verifies the final token.
- Copy last URL: copies the latest setup or authorization URL if needed.
- Skills guide: opens a short natural-language usage guide.
- Current skills: lists installed Feishu/Lark skills with name, detected permissions, and function.
- Workflow prompt: copies a template for turning natural language into a Feishu workflow.
- Visual workflow: opens a compact workflow map.
- Popups render Markdown for reading; copy buttons still copy the original source text.
- The completion dialog OK button only closes the dialog. Close the main window with the system window control.

## Install Behavior

- Node.js, npm, and npx are checked first. Missing Node.js is installed automatically when the platform has a supported package manager.
- `lark-cli` is reused when already present; otherwise the app runs the official CLI install and falls back to npm global install if needed.
- Feishu AI Agent Skills are synced by checking the official list, filling missing skills, and removing duplicate or broken local copies.
- Existing CLI app config is reused. If config is missing, the app starts `lark-cli config init --new`.
- Authorization uses `lark-cli auth login --recommend --no-wait --json`, opens the browser URL, polls the device code, and verifies `identity=user` plus `tokenStatus=valid`.

## Account And Privacy

The setup app does not choose or store a personal account. Feishu authorization uses whichever account is active in the system browser. If no Feishu account is logged in, Feishu controls the login or account creation flow.

The app does not upload telemetry and does not hard-code personal accounts, app secrets, tokens, open IDs, private paths, or keys. Window logs redact account identifiers, tokens, device codes, authorization URLs, scopes, and config paths before display.

## Validation Prompts

Chinese:

```text
请运行只读的飞书 CLI 预检。检查 `lark-cli --version`、`lark-cli config show` 和 `lark-cli auth status`。只汇报 CLI 版本、是否存在 app 配置、当前 identity、tokenStatus，以及是否可以开始使用飞书 Skills。不要创建、更新、删除、发送或修改任何飞书内容。
```

English:

```text
Run a read-only Feishu CLI preflight. Check `lark-cli --version`, `lark-cli config show`, and `lark-cli auth status`. Report the CLI version, whether app config exists, the current identity, tokenStatus, and whether Feishu Skills are ready to use. Do not create, update, delete, send, or modify anything in Feishu.
```

## macOS 打包与交付

最小交付（如果你要把源码发给客户）：

- `start-feishu-cli-setup.command`（mac 启动器，调用 `.sh`）
- `start-feishu-cli-setup.sh`（启动逻辑：检测 Node/npm/依赖并运行 `npm start`）
- `package.json`（定义 `start`、依赖与构建脚本）
- `src/` 目录（包含 `main.mjs`、`preload.cjs`、`setup-core.mjs` 以及 `renderer/` 子目录）
- `README.md`（本文件，包含运行与未签名说明）

推荐交付（用户体验更好）：已打包的 macOS `.app`（压缩为 `.zip` 或 `.dmg`），避免用户手动安装依赖与运行 `npm install`。

未签名 `.app` 的注意事项：

- 未签名或未公证（notarized）的应用仍然可以运行，但 macOS Gatekeeper 可能阻止打开并提示“无法验证开发者”。
- 客户打开未签名应用的常用方式：右键应用 → 打开，或在终端运行：

```bash
xattr -d com.apple.quarantine /path/to/FeishuCLI.app
```

- 更推荐的长期方案是使用 Apple Developer 帐号进行**代码签名与公证**，可以在 electron-builder 中配置自动签名与公证（需要在 macOS 上或 CI 提供证书与密码）。

如何运行（当你只发源码给客户）：

```bash
chmod +x start-feishu-cli-setup.command start-feishu-cli-setup.sh
./start-feishu-cli-setup.command
```

构建提示（在 macOS 上执行）：

- 快速生成 `.app`（无签名）：使用 `electron-packager` 在 macOS 上运行：

```bash
npm install --save-dev electron-packager
npx electron-packager . FeishuCLI --platform=darwin --arch=arm64,x64 --out=dist --overwrite
```

- 推荐发布流程：使用 `electron-builder` 生成 `dmg`/`zip` 并在有证书时执行签名与公证；签名/公证需 Apple Developer 账号。

重要说明：在 Windows 环境下**无法**生成 macOS `.app` 或完成 macOS 签名/公证。若你需要我在 CI（GitHub Actions）上配置自动构建，我可以帮你写工作流脚本（需要仓库 CI secrets 与 macOS runner）。

如需我生成一份发给客户的压缩交付包清单与单文件说明（可直接转发），我可以立刻创建并保存为 `DIST_FOR_CUSTOMER.md`。

## 在 CI 上自动签名与公证（可选）

如果你希望 GitHub Actions 自动为 `.app` 进行代码签名并提交 Apple 公证（notarization），请在仓库的 Settings → Secrets 中添加以下 Secrets：

- `CERT_P12`：开发者签名证书的 `.p12` 内容，使用 base64 编码后作为 secret（例如：`base64 cert.p12 | pbcopy` 然后粘贴）。
- `CERT_P12_PASSWORD`：导出 `.p12` 时设置的密码。
- `KEYCHAIN_PASSWORD`：在 CI 中创建临时 keychain 的密码（任意强密码）。
- `APPLE_API_KEY`：Apple API Key 的 `.p8` 文件内容，使用 base64 编码后作为 secret（`base64 AuthKey_ABC123.p8 | pbcopy`）。
- `APPLE_API_KEY_ID`：Apple API Key 的 Key ID（例如：`ABC123XYZ`）。
- `APPLE_API_ISSUER_ID`：Apple API Key 的 Issuer ID（在 App Store Connect 応用管理中可见）。

工作流行为：如果这些 Secrets 未设置，CI 会生成未签名的 `.app`（仍可下载并双击，但可能触发 Gatekeeper 警告）；如果提供了证书与 API Key，工作流将尝试把证书导入到临时 keychain，并让 `electron-builder` 对构建产物进行签名和公证。

安全提示：不要在公开仓库中直接提交证书或密钥文件，务必通过 GitHub Secrets 安全注入。签名与公证需要你拥有有效的 Apple Developer 账号。

