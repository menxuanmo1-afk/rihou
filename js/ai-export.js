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
} from "./models.js?v=58";
import { loadAllDays, loadSettings } from "./store.js?v=58";

const REVIEW_PLAYBOOK = `请按下面的「分析流程」复盘这份人生记录仪导出，不要改用通用周报或鸡汤模板。不要编造记录里没有的事。不要把文末 JSON 整段贴回给用户。

## 分析流程

1. 先看范围是 **今日** 还是 **本周（周一至今天）**。
2. 以「逐日时间轴」为主阅读；用文末 JSON 核对分钟。两者冲突时以 JSON 的 \`summary.*.Min\` 和 \`days[].blocks\` 为准。

### 字段怎么理解

- **投资**：学习、读书、上课、功课、健身、运动、创作，以及吃饭/休息/睡觉/洗澡/社交等记在投资桶的事项。长期复利。
- **消费**：刷短视频、游戏。即时满足，拉低现价。
- **其余**：家务、通勤、发呆、其他。
- **学识 / 健康 / 创作**：三栏估值。自定义栏按摘要里的名字读。
- 导出里**没有**估值曲线和现价数字。不要编造 \`$\` 或涨跌幅。可以说「消费偏多，现价大概在折」这类方向，不要假装算过盘。

时间是本地 24 小时。\`startMin\`/\`endMin\` 是从 0:00 起的分钟。混合事项（多种 \`kinds\`）时间均分。

### 怎么判断

对照范围里的天数，看结构，不看宣言。

- **加仓**：投资明显高于相邻天，或某一栏（学识/健康/创作）明显更沉。
- **偷懒 / 空白**：工作日几乎无实际记录，或投资远低于消费。
- **过猛**：单日投资很长（大约 ≥6 小时）还挤掉睡眠/吃饭。建议里要写停，不要继续加码。
- **玩太久**：短视频+游戏大约 ≥2.5 小时，尤其挤掉学习或睡眠。
- **周末**：允许慢，但「无记录」和「休息」不是一回事。休息应出现在时间轴上。

本周复盘要逐日扫一遍，点出哪天空、哪天偏科，不要只报一周总数。

### 输出结构（按这个顺序，不要加别的大标题）

语气亲近，可以损一句，建议必须落到时段。不要鸡汤，不要「加油你最棒」。

1. **实际发生了什么**  
   用数字说话：投资 / 消费 / 其余各多少；三栏各多少；时间都堆在上午还是深夜。今日就写今天，本周先总后点名几天。
2. **加仓、偷懒、过猛**  
   各写清楚有还是没有。没有就说没有，不要硬找高潮。点到具体时段或事项。
3. **接下来怎么排**  
   - 今日复盘 → 排**明天**（若还早，也可以补今晚一截）。  
   - 本周复盘 → 排**下一周**，至少点出 3 个工作日的上午/下午/晚上各干什么。  
   - 每条建议带时长，例如「明早 9:00–10:30 先学，短视频放到晚上 9 点以后、不超过 40 分钟」。  
   - 已经过猛就写休息和睡觉；已经空白就写最小开工（20–40 分钟也算），不要开一张不可能的课表。`;

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

  const markdown = `<!-- rihou-export v1 -->
把这份文件发给任意 AI（手机豆包、ChatGPT、WorkBuddy 都可以），对它说「按文件里的流程分析」。

# 给 AI 的指令

范围：${rangeLabel}
导出时间：${exportedAt}

${REVIEW_PLAYBOOK}

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
