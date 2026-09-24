# 人生记录仪：ChatGPT 新账号交接指南

## 结论

项目代码、历史决策、构建方式和下一步都已经放进 GitHub 仓库。新账号不需要导入整段旧聊天，也不要导出或上传 Cursor 的 JSONL 记录。最稳妥的接续方式是让新账号打开同一个本地仓库，并先读 `AGENTS.md` 与 `HANDOFF.md`。

旧账号的聊天列表、账号记忆、连接授权和设置不会因为打开同一仓库而自动出现在新账号中。它们与代码仓库是两套数据。

## 在同一台 Mac 上接续

1. 等当前修改已经推送、仓库状态干净后，再退出旧 ChatGPT 账号。
2. 用新账号登录 ChatGPT 桌面版。
3. 新建本地项目，选择：
   `/Users/mathewm/Documents/ChatGPT/人生记录仪/rihou`
4. 如果界面要求选择主目录，把 `rihou` 设为 primary folder。
5. 新建任务，粘贴下方“首条消息”。
6. 如果要使用 GitHub 云端能力，在新账号中重新授权 GitHub；仅使用本机项目时，代码仍然在原目录，Mac 上现有的 Git/Xcode 环境不会因为更换 ChatGPT 账号而自动删除。

OpenAI 的项目说明指出，本地项目可以直接连接电脑上的代码目录，并会自动发现主目录中的 `AGENTS.md`。因此本仓库中的交接规则会成为新任务的长期上下文：<https://learn.chatgpt.com/docs/projects>

## 换电脑时接续

1. 在新电脑安装 Git、Node.js、Xcode 和 ChatGPT 桌面版。
2. 克隆 `https://github.com/menxuanmo1-afk/rihou.git`。
3. 在 ChatGPT 桌面版把克隆后的 `rihou` 文件夹添加为本地项目。
4. 安装依赖后运行 `npm test` 和 `npm run ios:sync`。
5. 在 Xcode 中重新确认 Apple Developer 签名。不要复制或提交证书私钥、DeepSeek 密钥、Cloudflare 令牌或服务访问码。

## 新账号需要重新确认的外部权限

- **GitHub：** 如果使用 ChatGPT 的 GitHub 连接器，需要在新账号重新授权 `menxuanmo1-afk/rihou`。本机 Git 凭据是否仍可用取决于这台 Mac 的钥匙串，与 ChatGPT Plus 账号不是同一件事。
- **Xcode / Apple Developer：** 同一台 Mac 通常保留原有 Xcode 登录和开发证书；换电脑需要重新登录并签名。
- **DeepSeek 与 Cloudflare：** 这是独立账号，不随 ChatGPT 账号迁移。现有 Worker 和 Secret 不需要因为更换 ChatGPT 账号而重建。
- **服务访问码：** 不要贴进聊天。继续保存在 Mac 钥匙串或 iPhone App 设置中。
- **Plus：** 新账号已有 Plus 即可；旧账号订阅、聊天、记忆和自定义设置不会自动合并到新账号。

## 新账号首条消息

> 接着做“人生记录仪”。本地仓库是 `/Users/mathewm/Documents/ChatGPT/人生记录仪/rihou`，GitHub 是 `menxuanmo1-afk/rihou`。先完整阅读根目录 `AGENTS.md` 和 `HANDOFF.md` 最上方的最新记录，再检查 `git status` 与 `origin/main`。默认只修改 Apple Store 的 iPhone 版，不要改网页版资产/估值图。保留现有修改和用户数据，密钥不准进入仓库、聊天或 App。当前最新是构建 10 的事项选择器黑条根因修复：已通过自动测试和通用 iOS 签名编译，但因为手机当时断开，仍需连接 MO-iPhone 后覆盖安装并用真机截图验收。用户确认的改动完成后自动测试、更新交接、提交并推送 `origin/main`。

## 第一次接手时应该看到的状态

- 分支：`main`
- 远端：`origin` → `https://github.com/menxuanmo1-afk/rihou.git`
- Xcode 工程：`ios/App/App.xcodeproj`
- Bundle ID：`com.xuanmo.liferecorder`
- 当前原生构建号：10
- 最新黑条修复已通过 `npm test`、手机尺寸交互测试和通用 iOS 签名编译。
- 构建 10 尚未安装到真机；连接 MO-iPhone 后必须先覆盖安装验证，不能把桌面预览当成真机结论。

## 不需要迁移的内容

- 不需要上传旧账号全部聊天记录。
- 不需要上传 Cursor JSONL。
- 不需要把 DeepSeek API Key、Cloudflare Secret 或服务访问码放进项目文件。
- 不需要重新部署已经正常工作的 Worker，除非服务本身出现问题或用户明确要求更换。
