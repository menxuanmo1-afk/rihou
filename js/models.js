export const Payoff = {
  DELAY: "DELAY",
  CARE: "CARE",
  INSTANT: "INSTANT",
  NEUTRAL: "NEUTRAL",
};

export const KINDS = [
  { id: "STUDY", label: "学习", payoff: Payoff.DELAY, bucket: "invest", color: "#E8A87C" },
  { id: "READ", label: "读书", payoff: Payoff.DELAY, bucket: "invest", color: "#7DCEA0" },
  { id: "CLASS", label: "上课", payoff: Payoff.DELAY, bucket: "invest", color: "#E8C07D" },
  { id: "FITNESS", label: "健身", payoff: Payoff.DELAY, bucket: "invest", color: "#7EB6D9" },
  { id: "SPORT", label: "运动", payoff: Payoff.DELAY, bucket: "invest", color: "#5BB798" },
  { id: "CREATE", label: "创作", payoff: Payoff.DELAY, bucket: "invest", color: "#C9A7EB" },
  { id: "WORK", label: "功课", payoff: Payoff.DELAY, bucket: "invest", color: "#E8C07D", hidden: true },
  { id: "MEAL", label: "吃饭", payoff: Payoff.CARE, bucket: "invest", color: "#E8C9A0" },
  { id: "REST", label: "休息", payoff: Payoff.CARE, bucket: "invest", color: "#B8B0A6" },
  { id: "SLEEP", label: "睡觉", payoff: Payoff.CARE, bucket: "invest", color: "#7B88A8" },
  { id: "SHOWER", label: "洗澡", payoff: Payoff.CARE, bucket: "invest", color: "#8EC5D6" },
  { id: "CHORE", label: "家务", payoff: Payoff.CARE, bucket: "other", color: "#A8C5B5" },
  { id: "COMMUTE", label: "通勤", payoff: Payoff.NEUTRAL, bucket: "other", color: "#8A9BA8" },
  { id: "DAZE", label: "发呆", payoff: Payoff.NEUTRAL, bucket: "other", color: "#7A7670" },
  { id: "SCROLL", label: "刷短视频", payoff: Payoff.INSTANT, bucket: "consume", color: "#E07A5F" },
  { id: "GAME", label: "游戏", payoff: Payoff.INSTANT, bucket: "consume", color: "#D67B7B" },
  { id: "OTHER", label: "其他", payoff: Payoff.NEUTRAL, bucket: "other", color: "#9AA8B5" },
];

export function pickerKinds(selected = []) {
  const base = KINDS.filter((k) => !k.hidden);
  for (const id of selected) {
    if (base.some((k) => k.id === id)) continue;
    const extra = KINDS.find((k) => k.id === id);
    if (extra) base.push(extra);
  }
  return base;
}

export const DEFAULT_HABITS = [
  { id: "BRUSH", label: "刷牙", points: 8, hint: "小事，但每天都做才算数" },
  { id: "SLEEP_BEFORE_11", label: "十一点前睡觉", points: 15, hint: "把明天上午连本带利还给你" },
  { id: "TIDY", label: "整理房间", points: 10, hint: "环境干净，注意力也干净" },
];

export function kindById(id) {
  return KINDS.find((k) => k.id === id) || KINDS[KINDS.length - 1];
}

export function blockKinds(block) {
  if (Array.isArray(block.kinds) && block.kinds.length > 0) return block.kinds;
  return block.kind ? [block.kind] : ["OTHER"];
}

export function blockLabel(block) {
  if (block.title) return block.title;
  const labels = blockKinds(block).map((id) => kindById(id).label);
  if (labels.length === 1) return labels[0];
  return `${labels.join(" / ")}`;
}

export function blockColors(block) {
  return blockKinds(block).map((id) => kindById(id).color);
}

export function gradientCss(colors) {
  if (colors.length === 0) return "#9AA8B5";
  if (colors.length === 1) return colors[0];
  const n = colors.length;
  const stops = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 100;
    const b = ((i + 1) / n) * 100;
    const hold = (b - a) * 0.1;
    stops.push(`${colors[i]} ${(a + hold).toFixed(1)}%`);
    stops.push(`${colors[i]} ${(b - hold).toFixed(1)}%`);
  }
  return `linear-gradient(180deg, ${stops.join(", ")})`;
}

export function lastActualEnd(day) {
  const actuals = (day.blocks || []).filter((b) => !b.isPlan);
  if (actuals.length === 0) return null;
  return Math.max(...actuals.map((b) => b.endMin));
}

export function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

/** 上次已经发生的实际记录结束点 → 现在。忽略还没到的色块。没有上次则从 6:00 起。 */
export function gapFromLastToNow(day, now = new Date()) {
  const endMin = nowMinutes(now);
  const actuals = (day.blocks || []).filter((b) => !b.isPlan && b.endMin <= endMin);
  const last = actuals.length === 0 ? null : Math.max(...actuals.map((b) => b.endMin));
  const startMin = last == null ? 6 * 60 : last;
  return { startMin, endMin };
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

export function emptyHabits(habitList = DEFAULT_HABITS) {
  return Object.fromEntries(habitList.map((h) => [h.id, false]));
}

export function emptyDay(date) {
  return { date, blocks: [], habits: emptyHabits() };
}

export function durationMin(block) {
  return Math.max(0, block.endMin - block.startMin);
}

export function overlaps(block, start, end) {
  return block.startMin < end && block.endMin > start;
}

export function minutesToHm(minutes) {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  if (clamped === 24 * 60) return "24:00";
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseHm(value) {
  const [h, m] = String(value).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

export function hmInputValue(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return minutesToHm(clamped);
}

export function formatDuration(minutes) {
  if (minutes <= 0) return "0分钟";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分`;
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return todayISO(date);
}

export function weekdayLabel(iso, language = "zh") {
  const [y, m, d] = iso.split("-").map(Number);
  const names = language === "en"
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return names[new Date(y, m - 1, d).getDay()];
}

export function dateTitle(iso, language = "zh") {
  const [, m, d] = iso.split("-");
  if (language === "en") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[Number(m) - 1]} ${Number(d)} ${weekdayLabel(iso, "en")}`;
  }
  return `${Number(m)}月${Number(d)}日 ${weekdayLabel(iso)}`;
}
