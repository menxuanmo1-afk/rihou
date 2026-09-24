# 人生记录仪协作规则

这是 `menxuanmo1-afk/rihou`。开始任何工作前，先完整阅读 `HANDOFF.md` 顶部的最新记录，再检查 `git status`、当前分支和远端状态。不要把旧聊天记录当成比仓库文档更可靠的现状。

## 产品与修改边界

- 默认只修改 Apple Store / Capacitor iOS 版本。除非用户在当前任务中明确要求同步网页版，否则不要改 `js/app.js`、`js/store.js`、网页资产/模拟投资/估值图或 GitHub Pages 行为。
- iOS 专用入口位于 `js/native/`，专用样式位于 `css/assistant.css`；原生资源通过 `npm run ios:sync` 打包进 Xcode 工程。
- 网页右侧资产/估值图必须保留。iPhone 右侧是 AI 助理，两条产品线不要合并。
- 先回应用户当前指定的小范围问题，不主动大改已确认的产品结构或文案。
- 保留用户和其他 AI 已有的修改。遇到未提交变更时先检查来源和重叠范围，不得擅自撤回、覆盖或清理。

## 数据、AI 与密钥

- 日记、计划、待办和偏好默认保存在设备本机。覆盖安装 App 前不得删除 App、清空容器或重置数据。
- DeepSeek 密钥只存在 Cloudflare Worker Secret 中；服务访问码只存在钥匙串或 App 本机设置中。任何密钥、访问码、令牌都不得写进仓库、聊天、前端或 IPA。
- Worker 地址和架构说明见 `cloud/coach/README.md`；真机验收见 `docs/native-assistant-acceptance.md`。
- 未经用户明确授权，不上传真实日记进行模型测试；服务端测试使用虚构记录。

## 完成一次已确认修改

1. 尽量添加或更新针对性测试。
2. 运行 `npm test`。
3. 原生改动运行 `npm run ios:sync`。
4. 运行 `git diff --check`，检查只改了任务范围内的文件。
5. 条件允许时使用 `ios/App/App.xcodeproj` 编译并覆盖安装到已连接的 MO-iPhone；覆盖安装，不卸载 App。
6. 更新 `HANDOFF.md` 顶部，写明范围、验证结果、构建号和仍需真机确认的事项。
7. 对用户已确认的修改，提交并推送 `origin/main`，不必等待用户再次说“推送”。不要把未确认方案或无关变更一起提交。

## 当前接续入口

- 最新状态以 `HANDOFF.md` 最上方条目为准。
- 新账号首次接手时阅读 `docs/new-account-handoff.md`。
- 常用验证命令：`npm test`、`npm run ios:sync`、`git diff --check`。
- Xcode 工程：`ios/App/App.xcodeproj`；Bundle ID：`com.xuanmo.liferecorder`。

与用户沟通时使用中文，先说结果与风险，再说必要的技术原因。真机视觉问题必须以用户手机截图或真机结果为准，桌面浏览器预览不能替代真机验收。
