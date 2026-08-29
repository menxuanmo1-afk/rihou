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
} from "./models.js?v=63";
import { loadAllDays, loadSettings } from "./store.js?v=63";

const REVIEW_SKILL = `严格按本文件输出。禁止通用周报、鸡汤长文。没有的事不要编。时间轴与 JSON 冲突时以 JSON 的 \`summary.*.Min\` 和 \`days[].blocks\` 为准。不要贴回 JSON。禁止联网、禁止知识库、禁止引用本文件以外的资料。工作日空白 ≠ 休息（可能漏记）。不要编估值 \`$\`。给用户看的句子必须把道理写出来，例如「午饭后刷视频，刚吃完血糖升高，再刷会让多巴胺阈值飙升，下午注意力直接废掉」。禁止写「对应 R1」「因为 R3」这类编号。

## 字段怎么理解

- **投资**：学习、读书、上课、功课、健身、运动、创作，以及吃饭/休息/睡觉/洗澡/社交等记在投资桶的事项。长期复利。
- **消费**：刷短视频、游戏。即时满足，拉低现价。
- **其余**：家务、通勤、发呆、其他。
- **学识 / 健康 / 创作**：三栏估值。自定义栏按导出摘要里的名字读。
- 导出里**没有**估值曲线和现价数字。不要编造 \`$\` 或涨跌幅。可以说「消费偏多，现价大概在折」这类方向，不要假装算过盘。

时间是本地 24 小时。\`startMin\`/\`endMin\` 是从 0:00 起的分钟。混合事项（多种 \`kinds\`）时间均分。

## 分析框架

对照范围里的天数，按以下维度逐项检查。**不要只报总数，要找出模式和异常。**

### A. 投资 / 消费 / 其余 结构
- 投资 vs 消费的比例。一周投资应 ≥ 消费的 3 倍（学生 / 创作者标准）。
- **消费出现时机**：在起床后 2 小时内或午饭后刷短视频 = 最差时机（抢占意志力高峰）。在晚上 9 点后刷 = 可接受放松。
- 消费是否连续多天同一时段出现 → 说明是固定坏习惯，不是偶发。

### B. 三栏分布
- 哪一栏是主力（通常学识），哪一栏明显偏薄。
- 创作栏是否集中在某 1–2 天 → 说明是爆发式而非习惯式。习惯式创作（每天 ≥30 分钟）长期产出更稳。
- 健康栏一周 <2 小时 → 严重不足。

### C. 睡眠分析（最重要）
- **睡眠时长**：用 JSON 中 \`SLEEP\` 块加总。成年人需 7–9 小时，青少年 / 大学生建议 8–9 小时。
  - 连续 4 天平均 <6 小时 → 过猛，建议里必须写"减少投资、补觉"。
  - 连续 4 天平均 6–7 小时 → 临界，长期会积累睡眠债。
- **睡眠一致性**：每天入睡时间和起床时间差应 <1 小时。
  - 入睡时间波动 >2 小时 → 昼夜节律紊乱，影响白天注意力和记忆力。
  - 熬夜到 00:30 之后 + 第二天 6 点起 → 典型"用睡眠换产出"，2–3 天后效率暴跌。
- **睡眠规律性知识**：人体核心体温最低点在凌晨 4–5 点，此时最深睡。晚睡不会"补"到这个窗口，只会减少总时长。

### D. 饮食节律
- 每天吃饭次数：理想 3 餐。记录中 \`MEAL\` 块每天应 ≥2 次。
- **吃饭时间是否固定**：每天第一餐和最后一餐的时间差应 <1.5 小时。波动大会扰乱代谢节律。
- 早餐（起床后 1 小时内）是否有记录 → 没有说明跳过早餐。
- 最后一餐到入睡的间隔：理想 ≥2 小时。太近影响睡眠质量。

### E. 运动时机
- 一周应有 ≥3 次运动（每次 ≥20 分钟），或 ≥150 分钟中等强度运动。
- **最佳运动时间**：下午 14:00–18:00 体温最高、肌肉力量和反应速度最佳。早上运动也可以，但需要更长热身。
- 睡前 2 小时内剧烈运动 → 会推迟入睡时间。
- 饭后 30–60 分钟内运动 → 影响消化。

### F. 深度工作块
- **深度工作**：连续 ≥60 分钟的单一投资事项（学习 / 功课 / 创作）。
- 一天中有 ≥2 个深度工作块 = 高效日；0 个 = 碎片化日。
- 注意力恢复需要 20–30 分钟。两个深度块之间应有 ≥15 分钟的真正休息（非刷手机）。
- 混合事项块（2+ kinds）>30 分钟 → 说明注意力在切换，不算深度工作。

### G. 模式判断（加仓 / 偷懒 / 过猛 / 偏科）
- **加仓**：投资明显高于相邻天，或某一栏明显更沉。
- **偷懒 / 空白**：工作日几乎无实际记录，或投资远低于消费。
- **过猛**：单日投资很长（大约 ≥6 小时）还挤掉睡眠/吃饭。
- **偏科**：某栏一周占比 <5%（如健康栏），且连续多周如此。
- **玩太久**：短视频+游戏大约 ≥2.5 小时，尤其挤掉学习或睡眠。

## 输出结构

语气亲近，可以损一句，建议必须落到时段。不要鸡汤，不要「加油你最棒」。
所有建议都要有科学依据，不要编造研究结论（可以说「研究表明」「一般建议」，不要引用具体论文名或百分比）。

### 1. 实际发生了什么

用数字说话：投资 / 消费 / 其余各多少；三栏各多少。
然后**挑 2–3 个最值得注意的模式**（不是报数，是洞察），例如：
- 「消费全部集中在下午放学后 17:00–19:30，说明这是你最容易失控的窗口」
- 「创作只在周三和周四有，其他天为零 — 不是每天写，是攒着写」
- 「四天睡眠加起来不到 11 小时，平均每天 2.7 小时，这不是过猛，是自我惩罚」

### 2. 总结

从以下维度各写一句话（有的就写，没有的跳过，不要硬凑）：

- **睡眠**：时长 + 一致性评价（好 / 临界 / 差）
- **饮食**：规律性评价（固定 / 有波动 / 不规律）
- **运动**：频率 + 时机评价
- **深度工作**：本周高效日几天、碎片化日几天
- **消费习惯**：集中在什么时段、是否占用了高价值时间
- **偏科**：哪一栏长期过薄

总结段落控制在 6 句以内，不要写成小作文。

### 3. 建议

- 今日复盘 → 排**明天**（若还早，也可以补今晚一截）。
- 本周复盘 → 排**下一周**，至少点出 3 个工作日的上午/下午/晚上各干什么。
- 每条建议带时长，例如「明早 9:00–10:30 先学，短视频放到晚上 9 点以后、不超过 40 分钟」。
- 已经过猛就写休息和睡觉；已经空白就写最小开工（20–40 分钟也算），不要开一张不可能的课表。
- **每条建议都要说明原因**，例如：
  - 「把运动放到下午 4 点，这个时段体温和肌肉力量最高，热身短、效果好」
  - 「短视频别在午饭后刷，刚吃完血糖升高，再刷短视频会让多巴胺阈值飙升，下午注意力直接废掉」
  - 「每天在同一时间吃早饭，身体会提前分泌胃酸和消化酶，到点就饿，比闹钟还准」

建议数量控制在 4–6 条。不要给一张满到溢出的课表。`;

const REVIEW_WEEK = `这是**本周**（周一至今天）。

${REVIEW_SKILL}`;

const REVIEW_TODAY = `这是**今日**。只看这一天。一周总量标准（投资 ≥ 消费 3 倍、健康栏一周 <2 小时、一周运动次数）不要拿来硬判今天；睡眠、吃饭、消费时机、深度块仍按当天检查。

${REVIEW_SKILL}`;

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
