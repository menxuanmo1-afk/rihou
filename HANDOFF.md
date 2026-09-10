# 人生记录仪 — 交给下一个 AI 的交接

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
