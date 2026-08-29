import {
  kindById,
  minutesToHm,
  todayISO,
  addDays,
  weekdayLabel,
  blockKinds,
  kindsForBook,
  listCustomBooks,
  CORE_BOOKS,
} from "./models.js?v=61";
import { loadAllDays, loadSettings } from "./store.js?v=61";

const REVIEW_SCIENCE = `作息规则（只准用下面这些，禁止联网搜索，禁止另编论文或百分比）：
R1 醒后 2 小时内或午饭后刷视频/游戏 = 占意志力高峰，最差。
R2 21:00 后少量消费 = 可接受放松。
R3 饭后马上刷视频：血糖升叠多巴胺，下午注意力容易废。
R4 大学生睡眠宜每天 8–9 小时；连续多天均 <6 小时 = 过猛欠债；入睡或起床日较差 >2 小时 = 节律乱。
R5 4:00–5:00 核心体温最低、深睡窗口，晚睡补不回这一段。
R6 单一学习/功课/创作连续 ≥60 分钟 = 深度块；两块之间要有 15–30 分钟真休息（不是刷手机）才能恢复注意。
R7 运动较宜 14:00–18:00（体温和肌力较高）；睡前 2 小时剧烈运动容易推迟入睡。
R8 末餐到睡觉宜 ≥2 小时；醒后 1 小时内无吃饭可能没吃早餐。`;

const REVIEW_SHARED = `严格按本文件输出。禁止通用周报、鸡汤长文、第二份统计表。摘要里的小时数不要再展开成大段。没有的事不要编。时间轴与 JSON 冲突时以 JSON 的 \`summary.*.Min\` 和 \`days[].blocks\` 为准。不要贴回 JSON。禁止联网、禁止知识库、禁止引用本文件以外的资料。

写短：每段最多两句；表格每格一句；禁止「洞察」小节。工作日空白 ≠ 休息（可能漏记）。不要编估值 \`$\`。

${REVIEW_SCIENCE}`;

const REVIEW_WEEK = `${REVIEW_SHARED}

这是**本周**（周一至今天）。只准三个大标题，最后加一段鼓励。

### 1. 实际发生了什么
开头最多四行数字：投资/消费/其余；各栏小时；睡眠合计（若有）。再写**一句**总述。然后必须用 Markdown 表格逐日扫，不要再写洞察或长评：

| 日 | 亮点 | 问题 |
| --- | --- | --- |
| 周一 | 一句，带时长 | 一句，带钟点；没有就写 — |

有记录的每一天一行。亮点写做成了什么；问题写时机差、过碎、漏记、挤睡眠等。格子里不要逗号串成一段。

### 2. 总结
从全周里**最多提炼 3 个问题**。用编号 1. 2. 3.。每条必须是：现象（哪天几点）+「对应 Rn」（n 为上面规则号）+ 半句机制。没有对应规则就不要写进总结。不够 3 个就少写并写「没有更多问题」。硬找不算。全周都稳就只写「没有问题」。

### 3. 建议
问题有几条，建议就几条，一一对应。每条两句：改什么（落到明天或下周某日的具体钟点）+「因为 Rn」。没有 Rn 的建议删掉。不要排满一周课表。

### 鼓励
最后 2–3 句，只夸表格里真实出现的亮点，不要空洞「加油你最棒」。`;

const REVIEW_TODAY = `${REVIEW_SHARED}

这是**今日**。只看这一天，不要拿「一周标准」硬套（例如不要因为今天没健身就判健康严重不足）。只准三个大标题，最后加一段鼓励。

### 1. 实际发生了什么
开头最多三行数字：投资/消费/其余；有的栏；睡眠（若有）。再写**一句**总述。然后必须用 Markdown 表格，不要洞察、不要按时段写成散文：

| 时段 | 亮点 | 问题 |
| --- | --- | --- |
| 上午 | 一句 | 一句或 — |
| 下午 | 一句 | 一句或 — |
| 晚上 | 一句 | 一句或 — |

无记录的时段写「可能漏记」或 —。格子一句。

### 2. 总结
只提炼 **1 或 2 个**今天最要紧的问题。每条必须是：现象（几点）+「对应 Rn」+ 半句机制。没有对应规则就不要写。没有就写「没有问题」。禁止凑满三条。不要用一周总量（例如本周运动次数）来判今天。

### 3. 建议
问题有几条，建议就几条，针对今晚或明天。每条两句：做什么（带钟点）+「因为 Rn」。已经过猛就写睡觉，不要加码。

### 鼓励
最后 2 句，只夸今天真实做成的事。`;

const BOOK_LABEL = {
  mind: "学识",
  body: "健康",
  craft: "创作",
};

function mondayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, delta);
}

function datesIn(startISO, endISO) {
  const out = [];
  for (let iso = startISO, n = 0; iso <= endISO && n < 14; iso = addDays(iso, 1), n += 1) {
    out.push(iso);
  }
  return out;
}

function hoursText(minutes) {
  const min = Math.max(0, Number(minutes) || 0);
  if (min < 3) return "0 小时";
  const h = min / 60;
  return `${h >= 10 ? h.toFixed(0) : h.toFixed(1)} 小时`;
}

function expandActual(blocks) {
  const rows = [];
  for (const b of blocks || []) {
    if (b.isPlan) continue;
    const ids = blockKinds(b);
    const span = Math.max(0, Number(b.endMin) - Number(b.startMin));
    if (span <= 0 || !ids.length) continue;
    const share = span / ids.length;
    for (const id of ids) rows.push({ kind: id, minutes: share });
  }
  return rows;
}

function bucketMinutes(rows) {
  let invest = 0;
  let consume = 0;
  let other = 0;
  for (const row of rows) {
    const bucket = kindById(row.kind).bucket || "other";
    if (bucket === "invest") invest += row.minutes;
    else if (bucket === "consume") consume += row.minutes;
    else other += row.minutes;
  }
  return { invest, consume, other };
}

function bookMinutes(rows, bookId) {
  const allowed = new Set(kindsForBook(bookId));
  return rows.reduce((sum, row) => sum + (allowed.has(row.kind) ? row.minutes : 0), 0);
}

function kindMinutes(rows) {
  const map = {};
  for (const row of rows) {
    map[row.kind] = (map[row.kind] || 0) + row.minutes;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([id, minutes]) => ({
      id,
      label: kindById(id).label,
      minutes: Math.round(minutes),
    }))
    .filter((row) => row.minutes > 0);
}

function slimBlock(block) {
  return {
    startMin: Number(block.startMin) || 0,
    endMin: Number(block.endMin) || 0,
    kinds: blockKinds(block),
    title: block.title || "",
    isPlan: Boolean(block.isPlan),
  };
}

function dayPayload(iso, saved) {
  const blocks = Array.isArray(saved?.blocks) ? saved.blocks.map(slimBlock) : [];
  return { date: iso, blocks };
}

function timelineLine(block) {
  const when = `${minutesToHm(block.startMin)}–${minutesToHm(block.endMin)}`;
  const kinds = blockKinds(block).map((id) => kindById(id).label).join(" / ");
  const title = String(block.title || "").trim();
  const plan = block.isPlan ? "计划 " : "";
  return title ? `- ${plan}${when} ${kinds}　${title}` : `- ${plan}${when} ${kinds}`;
}

function bookList() {
  return [
    ...CORE_BOOKS.map((id) => ({ id, label: BOOK_LABEL[id] || id })),
    ...listCustomBooks().map((b) => ({ id: b.id, label: b.label || b.id })),
  ];
}

export function buildAiExport(range) {
  loadSettings();
  const today = todayISO();
  const start = range === "week" ? mondayOf(today) : today;
  const end = today;
  const all = loadAllDays();
  const isos = datesIn(start, end);
  const days = {};
  const actualRows = [];
  const timeline = [];

  for (const iso of isos) {
    const payload = dayPayload(iso, all[iso]);
    days[iso] = payload;
    const wd = weekdayLabel(iso, "zh");
    const actuals = payload.blocks.filter((b) => !b.isPlan).sort((a, b) => a.startMin - b.startMin);
    const plans = payload.blocks.filter((b) => b.isPlan).sort((a, b) => a.startMin - b.startMin);
    const lines = [`### ${iso} ${wd}`];
    if (!actuals.length && !plans.length) {
      lines.push("- （无记录）");
    } else {
      for (const b of actuals) lines.push(timelineLine(b));
      for (const b of plans) lines.push(timelineLine(b));
    }
    timeline.push(lines.join("\n"));
    actualRows.push(...expandActual(payload.blocks));
  }

  const totals = bucketMinutes(actualRows);
  const books = bookList().map((book) => ({
    ...book,
    minutes: Math.round(bookMinutes(actualRows, book.id)),
  }));
  const byKind = kindMinutes(actualRows);
  const rangeLabel = range === "week" ? `本周（${start} 周一至 ${end}）` : `今日（${today}）`;
  const exportedAt = new Date().toISOString();
  const filename = range === "week" ? `rihou-week-${start}.md` : `rihou-today-${today}.md`;

  const bookSummary = books
    .map((b) => `- ${b.label}：${hoursText(b.minutes)}`)
    .join("\n");
  const kindSummary = byKind.length
    ? byKind.map((k) => `- ${k.label}：${hoursText(k.minutes)}`).join("\n")
    : "- （没有实际记录）";

  const json = {
    format: "rihou-export",
    version: 1,
    range: range === "week" ? "week" : "today",
    start,
    end,
    exportedAt,
    summary: {
      investMin: Math.round(totals.invest),
      consumeMin: Math.round(totals.consume),
      otherMin: Math.round(totals.other),
      books: Object.fromEntries(books.map((b) => [b.id, { label: b.label, minutes: b.minutes }])),
      kinds: byKind,
    },
    days,
  };

  const playbook = range === "week" ? REVIEW_WEEK : REVIEW_TODAY;
  const markdown = `<!-- rihou-export v1 -->
把这份文件发给任意 AI（手机豆包、ChatGPT、WorkBuddy 都可以），对它说「按文件里的流程分析」。

# 给 AI 的指令

范围：${rangeLabel}
导出时间：${exportedAt}

${playbook}

---

## 摘要

- 投资：${hoursText(totals.invest)}
- 消费（短视频 / 游戏）：${hoursText(totals.consume)}
- 其余：${hoursText(totals.other)}

### 按栏

${bookSummary}

### 按事项

${kindSummary}

## 逐日时间轴

${timeline.join("\n\n")}

## 原始 JSON

\`\`\`json
${JSON.stringify(json, null, 2)}
\`\`\`
`;

  return { filename, markdown };
}
