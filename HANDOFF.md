# 人生记录仪 — 交给下一个 AI 的交接

> **2026-09-24 ChatGPT 新账号交接：** 已新增根目录 `AGENTS.md` 作为新任务自动发现的长期协作规则，并新增 `docs/new-account-handoff.md`，包含同一台 Mac / 换电脑两种接续方式、外部权限清单、禁止迁移的密钥与可直接粘贴的首条消息。无需导出或上传 Cursor JSONL，也不建议用整段聊天代替整理后的仓库交接。构建 10 已通过自动测试、手机尺寸交互测试和通用 iOS 签名编译；因 MO-iPhone 在安装时断开，尚未真机覆盖安装，必须在新账号接手后优先完成真机验收。

> **2026-09-24 iPhone 横向选择器黑条根因修复（仅原生）：** 对构建 9 真机截图取样后确认：弹窗底色约 `#1B2127`，横条约 `#101419`，对应 WKWebView 根背景；问题不是颜色变量，而是 `overflow-x:auto` 创建的独立滚动图层穿透了弹窗背景。构建 10 不再使用原生横向 overflow：每行改为普通裁切容器和内部 track，由 pointer 拖动改变位移；按钮点击、纵向弹窗滚动、右侧渐变提示和滑到末端后隐藏提示均保留。由于不再创建横向滚动图层，根背景无法穿透。App 构建号 10，网页运行代码未改动。

> **2026-09-24 iPhone 横向选择器黑条真机修复（仅原生）：** 构建 8 在桌面浏览器预览正常，但真机 WKWebView 仍会在有滚动提示的行生成整条深色合成层；由 `backdrop-filter` 与横向 momentum scroller 的合成组合触发。构建 9 完全移除 `backdrop-filter`、CSS mask 和旧式 `-webkit-overflow-scrolling:touch`，改用五段纯色透明渐变遮罩提示右侧内容，从结构上避免 iOS 生成黑色背景层。按钮中间尺寸保持不变，网页运行代码未改动。

> **2026-09-24 iPhone 事项选择器二次视觉修正（仅原生）：** 根据真机截图，将事项按钮从 12px / 28px 调整到介于原版和上一版之间的 13px / 32px。修复 WKWebView 将透明横向滚动层合成到深色底层而形成黑条的问题，滚动层现在与弹窗底色一致。右缘提示扩宽并通过多段透明渐变和遮罩让模糊逐步增强，消除清晰区与模糊区的硬分界。App 构建号 8，网页运行代码未改动。

> **2026-09-24 iPhone 事项选择器精修（仅原生）：** 四个分类标题放大、事项按钮缩小并去掉横向滚动区域黑底；每行右缘增加半透明渐变模糊提示，仅在右侧仍有内容时显示，滑到尽头自动消失。“飞盘”默认归入健康，“发呆”不再出现在选择器。设置新增“事项分类与排序”：内置和自定义事项都可改分类；可保留按使用频率自动排序，也可关闭后用上下按钮手动排序，偏好仅存本机。相关逻辑、交互与真机资源均已验证。App 构建号 7，网页运行代码未改动。

> **2026-09-24 保留外部 AI 的 6 项原生调整：** 用户确认保留此前另一 AI 的修改：Capacitor iOS 关闭自动 content inset；原生隐藏标题副标题；助理页锁定纵向滚动；原生 viewport 禁止缩放；WKWebView/UIScrollView 使用深色背景；时间页日期显示当前选中日，助理页日期显示今天且标题改为“昨日回顾”。其中副标题、滚动与 viewport 效果已迁到原生专用 CSS/打包步骤，网页入口保持原样。App 构建号 6。

> **2026-09-24 iPhone 事项分类（仅原生）：** 记录、计划和编辑表单中的事项选择器改为投资 / 健康 / 娱乐 / 其他四行，分类名固定、事项按钮可横滑；投资使用橙黄、健康使用绿蓝、娱乐使用红粉、其他使用灰色。默认顺序遵循产品分组，保存记录或计划后在本机累计使用次数，同一分类内高频事项自动前移。自定义事项创建/编辑时必须选择分类，只显示该分类的色板；旧自定义事项按原有 body→健康、其余→投资平滑迁移。偏好只存本机设置。320 / 393 / 430pt 三种手机宽度的排列、分类换色、边缘滚动和频次写入均通过交互测试；App 构建号 5。网页运行代码未改动。

> **2026-09-20 iPhone 底部导航修复（仅原生）：** “时间 / 助理”改为带时钟、星光图标的原生式双入口；每个入口整块半屏宽、56pt 高均可点击，并增加按压反馈和当前页可访问状态。底栏背景覆盖 iPhone 底部安全区，Xcode 窗口底色同步为深色，避免 Home 指示条周围露出白底；保留系统 Home 指示条本身。已在 320 / 393 / 430pt 三种手机宽度验证布局和边缘点击，现有全套自动测试通过。App 构建号升至 4；网页运行代码未改动。

> **2026-09-20 “记到现在”修复（本次明确授权同步网页和 App）：** 起点只取最近实际记录的结束时间，忽略已结束和当前计划；保存时覆盖记录区间内的所有计划，保留区间外的计划部分，支持跨午夜。循环计划仅跳过被完整覆盖的当天实例，待办不自动完成；原生仍保存原计划供复盘。普通编辑/边界拖动与网页估值逻辑不变。网页资源版本 v102 已在线核验；App 构建号 3，已同步至当前 Xcode 工程、通过签名编译并覆盖安装到 MO-iPhone。手机锁屏阻止自动启动，需用户解锁后打开。已做私有本机备份，更新前后日记和设置键校验一致。自动测试及网页/原生打包页面各 4 组交互回归通过（多条过期计划、过期+当前计划、跨午夜、无实际记录），均用虚构数据、禁止外发。此授权只针对本次修复，后续仍遵守原生优先边界。

> **2026-09-20 真机更新（优先于下文旧状态）：** 已把最新原生工程在 Xcode 打开、签名并覆盖安装到 MO-iPhone，版本 1.0 / 构建 2，启动成功；Apple Team `579A7LW9T4` 已写入当前工程。更新前 App 数据容器已备份至仓库外的本机私有文件夹，更新后日记键 `rihou.days.v1` 内容校验一致。当前 Xcode 工程是本仓库的 `ios/App/App.xcodeproj`，不是 `/Users/mathewm/Documents/程序/vibe-coding/日后/ios/App/App.xcodeproj`（该旧副本未覆盖，原有签名配置未提交）。待办、计划、AI 助理及通知均已随原生构建安装；AI 后端已接通，但手机端服务访问码仍待用户粘贴，上传授权必须由用户在 App 设置中确认。未提交 TestFlight、App Store 上传或审核。今后改原生后先执行 `npm run ios:sync` 再构建，GitHub 推送不能自动更新 Xcode 工程内的打包资源或手机上的 App。

> **2026-09-19 更新（优先于本文旧方案）：** 用户已授权实现并推送 iPhone 助理。原生已新增 `js/native/`、`css/assistant.css`、本地通知及 `cloud/coach/` 服务代码。Worker **已部署到 `https://rihou-coach.menxuanmo.workers.dev`，真实 DeepSeek 调用已接通**：用户已配置密钥与充值；两次虚构记录测试 HTTP 200，没有上传真实日记。首轮发现一处模型时长错误，现提供程序计算的时间事实，observation 直接从原始记录生成。独立访问码存于 Mac 钥匙串与 Cloudflare Secret，不索取或输出到聊天。原生地址已预填，AI 上传仍需用户主动同意；模拟器构建安装启动通过，MO-iPhone 暂不可用，等待连接解锁后配置并验收。当前模型为 `deepseek-flash`、非思考 JSON 输出；未做模型质量比较或大陆网络验证。详情见 [服务与部署说明](cloud/coach/README.md) 和 [真机验收清单](docs/native-assistant-acceptance.md)。
>
> 当前 UI：投资 / 昨晚睡眠 / 消费三行小计（小时小数格式），起床到起床；实际时间线整合亮点/问题及“查看深度分析”；计划与待办复盘压缩；今日建议支持多条作息提醒和到期待办采纳。无可见知识库、消息列表、“为什么选这个”或“安排依据”。顶部“设置”替换原生 AI 导出。计划提前10分钟本地通知，作息提醒依据刚结束的活动记录触发，不自动检测真实用餐。知识摘要仅在服务端。
>
> **最新硬边界：从现在起不改网页版文件。** 原生使用独立入口 `js/native/app.js` 和原生存储/待办适配；`js/app.js`、`js/store.js` 及网页估值文件完全保留原版本。原生打包排除估值与旧 AI 导出模块。下方“原生空白”“今日剩余”“上午/下午/晚上”等是历史交接，不是新的实现目标。用户要求后续每次改完自动提交推送；除非用户再次明确授权，不向网页同步功能或重构。

把这个文件和 GitHub 仓库一起给 GPT / Codex。**不要**去要 Cursor 的完整聊天记录，那些又长又吵，决策已经写在这里。

- 仓库：https://github.com/menxuanmo1-afk/rihou
- 网页（PWA）：https://menxuanmo1-afk.github.io/rihou/
- 用户：XUANMO（学生）。Apple 显示名 Xuanmo Men。Team ID `579A7LW9T4`。
- 今天（交接时）是 2026-09-10。iPhone 上已经能用 Xcode 跑通原生 App。右侧栏在 **iOS 里是空的**，网页仍是估值图。下一步还没写代码。

## 你是谁、先读什么

你在接着做这个项目。改完网页相关功能必须 `git commit` 并 `git push origin main`（GitHub Pages 约 1 分钟更新）。原生包还要 `npm run ios:sync` 再用 Xcode 装到手机。

先读：

1. 本文件
2. `js/app.js`（`isNativeApp()`、`achieveHtml()`）
3. `js/ai-export.js`、`js/analysis.js`、`js/store.js`
4. `skill/rihou-review/SKILL.md`
5. `capacitor.config.json`、`package.json`

## 产品是什么

本机日记：时间轴记下每个小时实际做了什么，分成投资 / 消费 / 其余。记录在 `localStorage`（`rihou.days.v1`、`rihou.settings.v1`），没有账号、没有自己的后端。

双轨：

| | GitHub Pages PWA | iOS Capacitor 包 |
| --- | --- | --- |
| 给谁 | 网页自己用 | 准备上 App Store |
| 右侧栏 | **资产 / 模拟投资 / 估值图，必须保留** | 空的，要做成 AI 助理工作台 |
| 热更新 | `git push` 即可 | 商店包不能靠加载 GitHub 网址（审核 4.2） |
| 检测 | 无 Capacitor | `window.Capacitor.isNativePlatform()`，`html.native-app` |

Bundle ID：`com.xuanmo.liferecorder`。工程：`ios/App/App.xcodeproj`。设备名 **MO-iPhone**。

**禁止：** 把网页右侧估值图删掉或改成助理（用户为此生过气）。禁止把 GitHub Pages URL 当商店 App 的内容来源。禁止把 LLM 密钥写进前端或 IPA。

## 已经做完的

- PWA 能记、能导出「AI分析」Markdown（`js/ai-export.js`），分析框架在 `skill/rihou-review/`。
- Capacitor iOS 工程；商店包去掉 GoatCounter；原生跳过 service worker。
- 真机已签名跑起来（Automatically manage signing，Team Xuanmo Men）。
- 原生右侧目前只有空 `achieve-empty` + 设置按钮。见 `js/app.js` 的 `achieveHtml()` native 分支。

## 下一步（已定案，直接做）

iPhone 右侧做成 **「昨日分析 + 今天计划」工作台**，不是对话框，也不是「今日 / 本周」两个平权页签。

### 本机、不调模型（页顶常驻）

- 今日剩余小时（已有 `remainingMinutes`）
- 今天投资小时、今天消费小时
- 不要叫「模拟投资」

### 模型文案，两个触发点

1. **昨日分析：** 早上起床后把「睡觉」记到时间轴上（跨夜补记，现有 `gapFromLastToNow` / `overnight`）。夜里临睡记下的「开始睡」不要触发生成。同一份昨天只打一次；改了昨天的块、指纹变了才再打。
2. **这周分析：** 本地周日 ≥ 14:00，第一次打开右侧时生成。平时不要空的「本周」页签。周报放在昨日下面，不替换工作台。

漏触发时空态：「记完睡觉后会出现昨日分析」，加一个很轻的手动重试。

### 昨日那一次调用要产出

- 昨天：一句话 + 上午/下午/晚上（亮点 / 问题）
- 今天：时间轴上已有的 **计划块原样列出**（钟点 + 名称）；AI 另写 **2–3 条今天建议**，已占时段不再派任务

### 周节律

本机扫最近 4–6 个同一星期几。同一约 2 小时窗口、同类消费或空白 **至少 3 次** 才带 `pattern`。0 条则请求里省略该字段；模型禁止写「每周三 / 往周 / 和上周比」。

### AI 架构（已选：DeepSeek + Cloudflare，两个都要）

```
iPhone → Cloudflare Worker（藏密钥）→ DeepSeek → 结构化 JSON 回手机
```

- DeepSeek 才是模型。Cloudflare Worker 只是免费小服务器，避免密钥进 IPA。
- 用户需要自己开 [DeepSeek API Key](https://platform.deepseek.com/) 和 [Cloudflare](https://dash.cloudflare.com/) 免费账号。实现时写 `cloud/coach/`，用环境变量放密钥，部署得到 `*.workers.dev`。App 只保存 Worker 地址。
- 强制 JSON，禁止自由长文。数字以本机 summary 为准，不许编 `$`。
- 没记录不调用。结果缓存 `localStorage`。失败可回退现有「AI分析」导出。
- 不做聊天、不做内购、不改网页资产页、不做 iCloud。

建议新文件 / 改动：`js/coach.js`；`achieveHtml()` native；`js/ai-export.js` 抽 `buildCoachPayload`；`css/app.css`、`js/i18n.js`（native 底栏「资产」→「助理」）；`cloud/coach/` Worker（`yesterday` / `week`）；`privacy.html`。

验收：网页估值图仍在；iPhone 三数字随记录变；补记睡觉后出昨日分析；无节律则文案无「每周三」；周六无周报，周日下午才有。

## 常用命令

```bash
python3 serve.py          # 本地网页
npm install
npm run ios:sync          # 网页打进 www 再 sync 进 iOS
npx cap open ios
```

缓存版本目前在脚本 query `?v=94` 和 `sw.js` 的 `VERSION`。改 JS/CSS 若要网页立刻更新，记得一起加版本号。

## 上架（还没做，别挡这一步）

Apple Developer 已买。App Store Connect 已有应用「人生记录仪」，SKU `liferecorder`。第一版商店：免费、无登录、无内购。审核忌「套壳网站」。隐私政策页还没有。工信部 APP 备案可并行，不阻塞 TestFlight。

## 明确不要做的

- 不要把 Cursor / 本文件之外的聊天当需求来源；以本文件为准。
- 不要接 OpenAI 密钥进前端；中国用户主模型用 DeepSeek。
- 不要做主题切换 / 浅色模式（做过，用户讨厌并已删）。
- 不要用 Xcode Cloud。不要 HealthKit。
- 用户规则：改 UI 后要在浏览器或真机验证；提交后 push `main`。
