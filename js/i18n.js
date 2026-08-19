import { formatDuration } from "./models.js";
import { loadSettings } from "./store.js";

export function formatDurationI18n(minutes) {
  if (lang() !== "en") return formatDuration(minutes);
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const KIND = {
  STUDY: { zh: "学习", en: "Study" },
  READ: { zh: "读书", en: "Read" },
  FITNESS: { zh: "健身", en: "Fitness" },
  CREATE: { zh: "创作", en: "Create" },
  WORK: { zh: "功课", en: "Work" },
  MEAL: { zh: "吃饭", en: "Meal" },
  REST: { zh: "休息", en: "Rest" },
  CHORE: { zh: "整理", en: "Tidy" },
  COMMUTE: { zh: "通勤", en: "Commute" },
  SCROLL: { zh: "刷短视频", en: "Short video" },
  GAME: { zh: "游戏", en: "Games" },
  OTHER: { zh: "其他", en: "Other" },
};

const STR = {
  zh: {
    time: "时间",
    assetTab: "资产",
    logNow: "记到现在",
    today: "今天",
    thatDay: "这一天",
    hint: "长按空白处再向下拉，画出计划；拖上下边改时间，点框写内容。点色块改已有记录。",
    invest: "投资",
    consume: "消费",
    rest: "其余",
    hours24: "今天 24 小时",
    hoursThatDay: "这一天 24 小时",
    compound: "复利资产",
    principal: "今日本金",
    principalHint: "今天还没花掉的时间。到 24:00 清零。",
    todayInvest: "今日投资",
    totalInvest: "总投资",
    hiddenAsset: "隐形资产",
    "book.all": "总览",
    "book.mind": "学识",
    "book.body": "身体",
    "book.craft": "创作",
    "book.restore": "休养",
    evalEmpty: "这一栏还没有进账。本金还在。",
    evalRising: "近七日比之前更密，曲线在抬头。当下转化 ×{ratio}。",
    evalSlow: "近七日比之前疏了。资产还在，转化比 ×{ratio}。",
    evalFlat: "近七日几乎走平。转化比 ×{ratio}。",
    evalWaste: "最近一个工作日空仓。转化比降到 ×{ratio}，资产没有少。",
    evalWeekend: "周末按轻仓计。转化比微调到 ×{ratio}。",
    multiplier: "效率乘数",
    streak: "连续投入",
    streakDays: "{n} 天",
    broken: "已断签。明天起投入又变回 ×1.0。资产还在。",
    dailyPut: "每天投入",
    dailyPutHint: "拖动以预览未来。三条虚线是它的 0.5× / 1× / 2×。",
    todayMark: "今天",
    forkLow: "0.5×",
    forkMid: "1×",
    forkHigh: "2×",
    emptyChart: "还没有投资记录。记下一笔，曲线就会从这里长出来。",
    settings: "设置",
    language: "语言",
    langZh: "中文",
    langEn: "English",
    prompt: "整点提醒我记一笔",
    promptHint: "提醒你补上「上次到现在」。添加到主屏幕后，打开页面才会弹出。",
    export: "导出备份",
    import: "从备份导入",
    close: "关闭",
    save: "保存",
    cancel: "取消",
    deleteBlock: "删除这段",
    addPlan: "添加计划",
    editBlock: "改这一段",
    logTitle: "记到现在",
    sinceLast: "上次到现在",
    actual: "实际",
    plan: "计划",
    note: "备注（可空）",
    start: "开始",
    end: "结束",
    now: "此刻",
    pickOne: "先选至少一件事",
    mixOne: "整段都是这件事。结束时间可以改成只记其中几分钟。",
    mixMany: "记不清哪分钟换的事：这段会显示成渐变色块，打分时时间均分。",
    mixEmpty: "点一件或多件。学了半小时就去通勤：只改结束时间，或两件都点上做成渐变。",
    logHint: "默认从上次记录结束，记到此刻，精确到 1 分钟。整点只是提醒，不必记满一小时。",
    mixEdit: "多选表示这段里都做过，但记不清分界，时间轴上是渐变。",
    notifyBody: "{start}–{end}，精确到分钟，不必记满一小时。",
    notifyTitle: "记一笔：上次到现在",
    unclear: "（记不清分界）",
  },
  en: {
    time: "Time",
    assetTab: "Asset",
    logNow: "Log to now",
    today: "Today",
    thatDay: "That day",
    hint: "Long-press empty space and drag down to sketch a plan. Drag the edges to change time. Tap the box to add details. Tap a block to edit.",
    invest: "Invest",
    consume: "Spend",
    rest: "Rest",
    hours24: "Today, 24 hours",
    hoursThatDay: "That day, 24 hours",
    compound: "Compound asset",
    principal: "Today's capital",
    principalHint: "Hours still unspent today. It clears at midnight.",
    todayInvest: "Today's invest",
    totalInvest: "Total invest",
    hiddenAsset: "Hidden asset",
    "book.all": "All",
    "book.mind": "Mind",
    "book.body": "Body",
    "book.craft": "Craft",
    "book.restore": "Restore",
    evalEmpty: "Nothing in this book yet. The capital is still there.",
    evalRising: "The last seven days are denser. The curve is lifting. Conversion ×{ratio}.",
    evalSlow: "The last seven days thinned out. The asset stays. Conversion ×{ratio}.",
    evalFlat: "The last seven days are almost flat. Conversion ×{ratio}.",
    evalWaste: "A weekday was empty. Conversion fell to ×{ratio}. The asset did not drop.",
    evalWeekend: "Weekend counted as a light day. Conversion eased to ×{ratio}.",
    multiplier: "Efficiency",
    streak: "Streak",
    streakDays: "{n} days",
    broken: "Streak broken. From tomorrow, new input is ×1.0 again. The asset stays.",
    dailyPut: "Daily input",
    dailyPutHint: "Drag to preview the future. The three dashed lines are 0.5× / 1× / 2×.",
    todayMark: "Today",
    forkLow: "0.5×",
    forkMid: "1×",
    forkHigh: "2×",
    emptyChart: "No investment yet. Log one, and the curve will grow from here.",
    settings: "Settings",
    language: "Language",
    langZh: "中文",
    langEn: "English",
    prompt: "Hourly reminder to log",
    promptHint: "Nudge you to fill last → now. Alerts only while the page is open.",
    export: "Export backup",
    import: "Import backup",
    close: "Close",
    save: "Save",
    cancel: "Cancel",
    deleteBlock: "Delete this block",
    addPlan: "Add plan",
    editBlock: "Edit block",
    logTitle: "Log to now",
    sinceLast: "Since last log",
    actual: "Actual",
    plan: "Plan",
    note: "Note (optional)",
    start: "Start",
    end: "End",
    now: "Now",
    pickOne: "Pick at least one",
    mixOne: "This whole stretch is that. You can still end it after just a few minutes.",
    mixMany: "If you forgot the split, it shows as a gradient. Scoring splits the time evenly.",
    mixEmpty: "Pick one or more. Studied then commuted: change the end time, or pick both as a gradient.",
    logHint: "From the last log to now, to the minute. The hourly chime is only a reminder.",
    mixEdit: "Multi-select means you did all of these but forgot the boundary.",
    notifyBody: "{start}–{end}, to the minute. No need to fill a whole hour.",
    notifyTitle: "Log: last to now",
    unclear: "(unclear split)",
  },
};

export function lang() {
  return loadSettings().lang === "en" ? "en" : "zh";
}

export function t(key, vars = {}) {
  const table = STR[lang()] || STR.zh;
  let text = table[key] || STR.zh[key] || key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export function kindLabel(id) {
  return (KIND[id] || KIND.OTHER)[lang()];
}

export { KIND };
