FeishuSetup — 给零基础 mac 用户的快速上手指南

目标：让不懂技术的客户能从下载到启动，只需双击或执行最少命令完成测试。

1. 简短说明（给用户看的第一句话）

这是一个用于快速测试“Feishu CLI Setup”桌面安装器的压缩包。请按下列步骤操作：解压 → 双击启动器 → 按界面提示完成。若遇到系统安全提示，请按下面的“如果出现安全提示”部分操作。

2. 前提条件

- 你的电脑是 macOS（如 MacBook、iMac）。
- 有稳定网络（首次运行可能需要下载依赖）。
- 请只在确认来自可信源时运行此软件。

3. 下载与解压

- 下载收到的文件 `FeishuSetup.zip` 到你的“下载”文件夹或桌面。
- 双击 `FeishuSetup.zip` 解压，会得到一个 `FeishuSetup` 文件夹。

4. 启动（最简单，推荐）

- 双击 `FeishuSetup/start-feishu-cli-setup.command`。
- 如果能正常打开，程序会自动检查并继续下一步（可能会打开一个窗口或在终端显示安装进度）。

5. 如果系统提示“无法打开”或“来自未识别的开发者”

按以下任一简单方法操作（推荐按序尝试第一项）：

方法 A（最简单，图形界面）：
- 在 Finder 中找到文件 `start-feishu-cli-setup.command`。
- 右键（或按住 Control 键并点击）该文件，选择“打开”。
- 在弹出的对话框中点击“打开”。

方法 B（终端执行，适合复制粘贴命令）：
1) 打开“终端”应用（在 Launchpad 或 聚焦搜索中输入 Terminal 打开）。
2) 切换到包含 `start-feishu-cli-setup.command` 的目录，例如：

```bash
cd ~/Downloads/FeishuSetup
```
3) 赋可执行权限并运行：

```bash
chmod +x start-feishu-cli-setup.command
./start-feishu-cli-setup.command
```

方法 C（仅在你确认文件来源可信时使用，解除隔离属性）：

```bash
# 在包含该文件的目录下执行
xattr -d com.apple.quarantine start-feishu-cli-setup.command
./start-feishu-cli-setup.command
```

注意：解除隔离会影响系统对该文件的安全检查，仅在你确信文件来自可信来源时使用。

6. 运行后你会看到什么

- 如果 `app/FeishuCLI.app` 随包一起提供，程序会尝试打开该应用窗口。
- 否则脚本会用系统或随包的 Node 运行 `app/start.js`（这是一个测试占位脚本，会在终端打印信息）。
- 如果需要下载依赖（`npm install`），请耐心等待，安装完成后自动运行。

7. 常见问题与排查（提供给非技术人员）

- "双击后没有反应"：请用方法 B 在终端运行，这样能看到错误信息；把终端里最后 10 行复制给我们。
- "提示缺少 Node.js"：脚本会尝试使用系统已有的 Node。如提示缺少 Node，我们会引导你：
  - 打开浏览器访问 https://nodejs.org/ ，下载并安装 Node.js LTS，然后重试上述步骤。
- "安装卡住或下载失败"：确认网络连接，尤其是公司网络或代理可能限制访问 GitHub/npm；建议在家用网络或带 VPN 的环境下重试。

8. 如何卸载

- 关闭任何正在运行的 Feishu 窗口或安装程序。
- 删除解压得到的 `FeishuSetup` 文件夹即可（并删除你放入的 `FeishuCLI.app`，若有）。

9. 如何收集并反馈问题（非常重要）

当你遇到问题，请按以下步骤收集信息并发送给技术支持：

- 如果你是用终端运行，复制并粘贴终端中出现的所有文字（尤其是最后 10-20 行）。
- 描述你做了哪一步（例如：解压 → 双击 → 出现“来自未识别的开发者”提示）。
- 告诉我们你的 macOS 版本（苹果菜单 → 关于本机）。

10. 其它（zip 打包说明，若你需要自己打包）

在 macOS 上创建 zip：

```bash
cd path/to/dist
zip -r FeishuSetup.zip FeishuSetup
```

在 Windows PowerShell 创建 zip：

```powershell
Compress-Archive -Path .\dist\FeishuSetup\* -DestinationPath .\dist\FeishuSetup.zip
```

--

如果你愿意，我可以把这个 `FeishuSetup` 文件夹在当前仓库中压缩成 `dist/FeishuSetup.zip`（注意：我无法在此生成 macOS `.app` 或包含真实 Node 二进制的 runtime，压缩包将包含占位文件）。
