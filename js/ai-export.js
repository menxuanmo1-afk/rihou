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
} from "./models.js?v=59";
import { loadAllDays, loadSettings } from "./store.js?v=59";

const REVIEW_PLAYBOOK = `请按下面流程复盘。禁止改成通用周报、鸡汤，或把复盘写成第二份统计表——摘要里的小时数 App 已经算过。你的价值在于：哪个时段在干什么、这个时段适不适合、会不会打乱节奏、哪项偏少/偏多、哪段空白可能忘了记。没有记录不要编。时间轴与文末 JSON 冲突时，以 JSON 的 \`summary.*.Min\` 和 \`days[].blocks\` 为准。不要把 JSON 整段贴回。

时间是本地 24 小时。\`startMin\`/\`endMin\` 从 0:00 起的分钟。\`SLEEP\`=睡觉，\`MEAL\`=吃饭，\`SCROLL\`=刷短视频，\`GAME\`=游戏。多种 \`kinds\` 的混合块时间均分；超过 30 分钟的混合块不算深度工作。工作日「无记录」≠ 休息（休息应出现睡觉/休息块）；空白要标「可能漏记」。自定义栏按摘要里的名字读。不要编造估值 \`$\` 或涨跌幅。科学依据只用「一般认为」「常见建议」，不要编论文名和精确百分比。

## 判断清单（每条都过一遍；没有就写「没有」。没过清单就动笔 = 不合格）

A. **消费时机**：醒后 2 小时内或午饭后刷短视频/游戏 = 最差（占意志力高峰；饭后刷视频还叠血糖和多巴胺，下午注意力容易废）。21:00 后少量 = 可接受放松。连续多天同一时段出现 = 固定坏习惯，不是偶然。
B. **投资/消费**：学生/创作者一周投资应至少是消费的 3 倍。短视频+游戏合计 ≥2.5 小时且挤学习或睡眠 = 玩太久。
C. **三栏**：点出主力栏和明显偏薄的栏。创作只堆在 1–2 天 = 爆发不是习惯；每天 ≥30 分钟更稳。健康栏一周 <2 小时 = 严重不足。某栏一周占比 <5% = 偏科。
D. **睡眠（最重要）**：把 SLEEP 块加总。大学生按每天 8–9 小时。连续 4 天均 <6 小时 = 过猛，建议减投入补觉；均 6–7 小时 = 临界欠债。入睡或起床日较差 >2 小时 = 节律紊乱。00:30 后睡、早上约 6 点起 = 用睡眠换产出，2–3 天会崩。4:00–5:00 是深睡窗口，睡得晚补不回这一段。
E. **吃饭**：理想一天 ≥2 顿 MEAL。每天第一餐/最后一餐时差 >1.5 小时 = 饮食不稳。醒后 1 小时内无吃饭 = 可能没吃早餐。最后一餐到睡觉应 ≥2 小时。
F. **运动**：一周 ≥3 次（每次 ≥20 分钟）或合计 ≥150 分钟。最佳 14:00–18:00（体温和肌力较高）。睡前 2 小时剧烈运动推迟入睡；饭后 30–60 分钟运动影响消化。
G. **深度块**：学习/功课/创作等单一投资事项连续 ≥60 分钟算 1 块。一天 ≥2 块 = 高效日；0 块 = 碎片日。两块之间应有 ≥15 分钟真休息（不是刷手机）。注意力恢复大约要 20–30 分钟。
H. **模式标签**：加仓 / 偷懒或空白 / 过猛 / 偏科 / 玩太久。没有就说没有，不要硬找。

## 输出（只准这三个大标题）

语气亲近，可以损一句。不要鸡汤，不要「加油你最棒」。建议必须落到具体钟点，并写清为什么这个时段适合或不适合。

### 1. 实际发生了什么
先用数字交代投资 / 消费 / 其余和三栏各多少（各一两句即可）。然后必须写出 2–3 条洞察，每条点到具体日期和钟点，例如：消费集中在放学后 17:00–19:30，这是最容易失控的窗口；创作只在周三周四，是囤着写不是每天写；均睡眠过短不是勤奋是自虐。本周要逐日扫，点出哪天空、哪天深、哪天碎。禁止只罗列每天干了什么。

### 2. 总结
有数据的维度各写一句，没有的跳过，全文不超过 6 句：睡眠（时长+规律：好/临界/差）、吃饭（固定/波动/乱）、运动（次数+时段）、深度工作（几天高效/几天碎片）、消费习惯（集中在几点、有没有占高价值时段）、偏科（哪一栏长期过薄）。

### 3. 建议
今日复盘 → 排明天（还早可补今晚）。本周复盘 → 排下一周，至少 3 个工作日的上午/下午/晚上。每条带时长，例如「明早 9:00–10:30 先学」。已经过猛就写休息睡觉；空白就写 20–40 分钟最小开工。每条必须带理由（为什么下午运动、为什么午饭后不要刷视频）。不要开一张不可能的课表。`;

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
