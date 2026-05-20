FeishuSetup — macOS 交付包（最小可测试版）

目录结构（示例）:

FeishuSetup/
  start-feishu-cli-setup.command   # 双击或在终端运行
  app/
    FeishuCLI.app                 # 可选：Electron .app（若已有，放在这里）
    start.js                      # 占位启动脚本（如未打包 .app）
  runtime/
    node/                         # 可选：放入 Node 可执行运行时，例如 runtime/node/bin/node
  README_DELIVERY.md              # 本说明

使用说明（发给测试用户的简短版）:

1. 解压 `FeishuSetup.zip`。
2. 双击 `start-feishu-cli-setup.command`。

若系统提示无法打开：
- 右键文件 → 打开 → 再点击“打开”；或
- 在终端执行：

  chmod +x start-feishu-cli-setup.command
  ./start-feishu-cli-setup.command

仅在确认文件来源可信时，可执行：

  xattr -d com.apple.quarantine start-feishu-cli-setup.command

说明：
- 推荐把完整的 Electron `.app` 放在 `app/FeishuCLI.app`，这样双击会直接打开 GUI 窗口。
- 若不包含 `.app`，则可在 `runtime/node/bin/node` 放入 Node 二进制并由 `app/start.js` 启动（这是回退方案，主要用于测试）。
- 该交付包为未签名版本，macOS 可能会显示 Gatekeeper 警告；如需无提示安装，请使用代码签名与 Apple 公证。请仅在信任来源时执行上述绕过操作。

需要我把这个文件夹压缩为 `FeishuSetup.zip` 并放在 `dist/` 吗？如果需要我可以创建压缩命令示例供你在 macOS 上运行。