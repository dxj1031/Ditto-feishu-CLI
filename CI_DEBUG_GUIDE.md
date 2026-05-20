CI Debug Guide — FeishuSetup macOS testing

目的：说明如何使用和调试 GitHub Actions 上的 macOS 测试工作流，以及如何在本地复现关键检查。

1. 在 GitHub 上查看 Actions 日志

- 打开你的仓库页面 → Actions → 选择运行的工作流（例如：Test FeishuSetup on macOS）。
- 展开各个步骤（Steps）查看标准输出与错误（Console logs）。
- 在运行完成后，下载 Artifacts（页面右侧或底部），Artifact 名称为 `feishu-setup-release`，包含：
  - `FeishuSetup.zip`（自动生成的压缩包）
  - `start-run.log`（启动器运行日志）
  - `app-start.log`（app/start.js 日志）
  - `runtime-node-v.log`（bundled node -v 输出）
  - `directory-structure.log`（解压后目录结构）

2. 手动重新运行 workflow

- 在 Actions 页面找到对应运行，点击右上角的 “Re-run jobs” 或 “Re-run all jobs”。
- 或者在仓库页面 → Actions → 选择工作流 → Run workflow（手动触发），选择分支并运行。

3. 如何判断 CRLF 问题

- 在工作流日志中，会有一项检测：如果 `start-feishu-cli-setup.command` 包含 CRLF（\r）字符，会直接失败并输出错误消息：
  "ERROR: CRLF line endings detected in start-feishu-cli-setup.command"
- 在本地检查命令（macOS / Linux）：

```bash
if grep -q $'\r' start-feishu-cli-setup.command; then echo CRLF; else echo LF; fi
```

- 在 Windows PowerShell：

```powershell
Select-String -Pattern "`r`n" -Path .\start-feishu-cli-setup.command -SimpleMatch
```

4. 如何判断 UTF-8 BOM 问题

- 工作流使用 `xxd -p -l 3` 检查文件开头的三个字节是否为 `efbbbf`（UTF-8 BOM）。若发现 BOM，工作流会失败并输出错误。
- 本地检查：

```bash
xxd -p -l 3 start-feishu-cli-setup.command
```

如果输出 `efbbbf`，说明存在 BOM，需要去掉（在编辑器中另存为 UTF-8 无 BOM，或使用 `tail -c +4` 重写文件）。

5. 如何判断缺少 shebang

- 工作流检查文件第一行是否以 `#!` 开始。如果没有，会失败并输出第一行内容供排查。
- 本地检查：

```bash
head -n1 start-feishu-cli-setup.command
```

6. 如何判断 Node 架构错误（bundled runtime）

- 工作流会运行：

```bash
file runtime/node/bin/node
./runtime/node/bin/node -v
```

- `file` 命令输出示例：
  - `Mach-O 64-bit executable x86_64` → x86_64
  - `Mach-O 64-bit executable arm64` → arm64
  - `Mach-O universal binary with 2 architectures` → universal

- 常见问题：
  - 在 Apple Silicon (arm64) 机器上如果只有 x86_64-only 二进制，可能需要 Rosetta to run; CI runner may or may not have Rosetta enabled.
  - 如果 `./runtime/node/bin/node -v` 报 `bad CPU type in executable`，说明平台不匹配。

7. 如何判断 Apple Silicon 不兼容

- 在 Actions 日志里会有 `uname -m` 输出（例如 `x86_64` 或 `arm64`）。将该值与 `file` 输出对比，若 runner 是 `arm64` 而 node 二进制是 `x86_64`，则存在不兼容风险。

8. 本地复现 workflow（macOS）

- 在本地 macOS 机器上，按工作流步骤复现：

```bash
# 假设当前目录包含 dist/FeishuSetup.zip
mkdir workdir
unzip -o dist/FeishuSetup.zip -d workdir
cd workdir/FeishuSetup
# Run validations
grep -q $'\r' start-feishu-cli-setup.command && echo CRLF || echo LF
xxd -p -l 3 start-feishu-cli-setup.command
head -n1 start-feishu-cli-setup.command
chmod +x start-feishu-cli-setup.command
./start-feishu-cli-setup.command > ../start-run.log 2>&1 || true
# Node checks
if [ -x runtime/node/bin/node ]; then file runtime/node/bin/node; ./runtime/node/bin/node -v; fi
# Directory structure
if command -v tree >/dev/null 2>&1; then tree -a -L 5 . > ../directory-structure.log; else find . -print > ../directory-structure.log; fi
```

9. 失败时的快速排查清单

- 下载并查看 artifact 文件：`start-run.log`, `app-start.log`, `runtime-node-v.log`, `directory-structure.log`。
- 检查 `start-run.log` 中的第一处 `ERROR` 关键字并按日志线索排查。
- 如果是 CRLF/BOM/Shebang 问题，修复文本文件后重新打包提交。
- 如果是二进制架构不匹配，替换为 universal 或相应架构的 Node 二进制。

10. 其他建议

- 始终在 macOS（真实设备或 macOS CI）上做最终验证，尤其是 GUI 和 Gatekeeper 行为。
- 将关键的二进制/证书放入私有存储（GitHub Secrets / secure storage），不要直接提交到仓库。

--

如果你需要，我可以进一步：
- 在工作流中加入邮件通知（构建失败时自动发给指定邮件）；
- 把生成的 zip 直接发布为 GitHub Release 附件（需要额外权限）。
