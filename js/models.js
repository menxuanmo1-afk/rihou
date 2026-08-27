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
  { id: "SOCIAL", label: "社交", payoff: Payoff.CARE, bucket: "invest", color: "#E6A4C4" },
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

const CUSTOM_MAX = 12;
const CUSTOM_LABEL_MAX = 8;
const CUSTOM_BOOK_MAX = 6;

export const KIND_COLORS = [
  "#E8A87C", "#7DCEA0", "#E8C07D", "#7EB6D9", "#5BB798",
  "#C9A7EB", "#E6A4C4", "#8EC5D6", "#E07A5F", "#9AA8B5",
];

export const CORE_BOOKS = ["mind", "body", "craft"];

export const BOOK_KIND_MAP = {
  mind: ["STUDY", "READ", "CLASS", "WORK"],
  body: ["FITNESS", "SPORT"],
  craft: ["CREATE"],
};

let customKinds = [];
let customBooks = [];

function bookFromLegacyLike(like) {
  if (BOOK_KIND_MAP.mind.includes(like)) return "mind";
  if (BOOK_KIND_MAP.body.includes(like)) return "body";
  if (BOOK_KIND_MAP.craft.includes(like)) return "craft";
  return CORE_BOOKS[0];
}

function validColor(color) {
  return KIND_COLORS.includes(color) ? color : KIND_COLORS[0];
}

function leftoverKindIds() {
  const core = new Set([...BOOK_KIND_MAP.mind, ...BOOK_KIND_MAP.body, ...BOOK_KIND_MAP.craft]);
  return KINDS.filter((k) => !k.hidden && !core.has(k.id)).map((k) => k.id);
}

function resolveBookId(raw) {
  if (CORE_BOOKS.includes(raw)) return raw;
  if (customBooks.some((b) => b.id === raw)) return raw;
  return CORE_BOOKS[0];
}

export function normalizeCustomBooks(list) {
  if (!Array.isArray(list)) return [];
  const allowed = new Set([...leftoverKindIds(), ...customKinds.map((c) => c.id)]);
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    if (!raw || !raw.id) continue;
    const label = String(raw.label || "").trim().slice(0, CUSTOM_LABEL_MAX);
    if (!label || seen.has(label) || CORE_BOOKS.includes(raw.id)) continue;
    seen.add(label);
    const kinds = [...new Set((Array.isArray(raw.kinds) ? raw.kinds : []).map(String).filter((id) => allowed.has(id)))];
    out.push({ id: String(raw.id), label, kinds });
    if (out.length >= CUSTOM_BOOK_MAX) break;
  }
  return out;
}

export function setCustomBooks(list) {
  customBooks = normalizeCustomBooks(list);
  return customBooks;
}

export function listCustomBooks() {
  return customBooks;
}

export function normalizeCustomKinds(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    if (!raw || !raw.id) continue;
    const label = String(raw.label || "").trim().slice(0, CUSTOM_LABEL_MAX);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const book = raw.book && raw.book !== "custom" && raw.book !== "restore"
      ? resolveBookId(raw.book)
      : bookFromLegacyLike(raw.like);
    out.push({
      id: String(raw.id),
      label,
      color: validColor(raw.color),
      book,
    });
    if (out.length >= CUSTOM_MAX) break;
  }
  return out;
}

export function setCustomKinds(list) {
  customKinds = normalizeCustomKinds(list);
  return customKinds;
}

export function listCustomKinds() {
  return customKinds;
}

function customAsKind(c) {
  const proto = { mind: "STUDY", body: "FITNESS", craft: "CREATE" }[c.book] || "OTHER";
  const base = KINDS.find((k) => k.id === proto) || KINDS[KINDS.length - 1];
  return {
    ...base,
    id: c.id,
    label: c.label,
    color: c.color || base.color,
    custom: true,
    book: resolveBookId(c.book),
    bucket: "invest",
    payoff: Payoff.DELAY,
  };
}

export function kindsForBook(bookId) {
  const base = BOOK_KIND_MAP[bookId];
  if (base) {
    const extras = customKinds.filter((c) => c.book === bookId).map((c) => c.id);
    return [...base, ...extras];
  }
  const book = customBooks.find((b) => b.id === bookId);
  if (!book) return [];
  const auto = customKinds.filter((c) => c.book === bookId).map((c) => c.id);
  return [...new Set([...book.kinds, ...auto])];
}

export function customBookCandidates(bookId = "") {
  const builtins = leftoverKindIds().map((id) => kindById(id));
  const extras = customKinds.filter((c) => bookId && c.book === bookId).map(customAsKind);
  return [...builtins, ...extras];
}

export function listValuationBooks() {
  return [
    ...CORE_BOOKS.map((id) => ({ id, core: true })),
    ...customBooks.map((b) => ({ id: b.id, label: b.label, core: false })),
  ];
}

export function pickerKinds(selected = []) {
  const builtins = KINDS.filter((k) => !k.hidden);
  const otherAt = builtins.findIndex((k) => k.id === "OTHER");
  const head = otherAt >= 0 ? builtins.slice(0, otherAt + 1) : builtins;
  const tail = otherAt >= 0 ? builtins.slice(otherAt + 1) : [];
  const merged = [...head, ...customKinds.map(customAsKind), ...tail];
  for (const id of selected) {
    if (merged.some((k) => k.id === id)) continue;
    merged.push(kindById(id));
  }
  return merged;
}

export { CUSTOM_MAX, CUSTOM_LABEL_MAX, CUSTOM_BOOK_MAX };

export const DEFAULT_HABITS = [
  { id: "BRUSH", label: "刷牙", points: 8, hint: "小事，但每天都做才算数" },
  { id: "SLEEP_BEFORE_11", label: "十一点前睡觉", points: 15, hint: "把明天上午连本带利还给你" },
  { id: "TIDY", label: "整理房间", points: 10, hint: "环境干净，注意力也干净" },
];

export function kindById(id) {
  const custom = customKinds.find((c) => c.id === id);
  if (custom) return customAsKind(custom);
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
    const hold = (b - a) * 0.3;
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

/** 上次已经发生的实际记录结束点 → 现在。忽略还没到的色块。没有上次则从 0:00 起。 */
export function gapFromLastToNow(day, now = new Date()) {
  const endMin = nowMinutes(now);
  const actuals = (day.blocks || []).filter((b) => !b.isPlan && b.endMin <= endMin);
  const last = actuals.length === 0 ? null : Math.max(...actuals.map((b) => b.endMin));
  const startMin = last == null ? 0 : last;
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

export function actualAtMinute(blocks, minute, exceptId) {
  return (blocks || []).find(
    (b) => !b.isPlan && b.id !== exceptId && b.startMin <= minute && minute < b.endMin,
  ) || null;
}

export function emptySpan(blocks, origin, exceptId, loBound, hiBound) {
  if (actualAtMinute(blocks, origin, exceptId)) return null;
  let lo = loBound;
  let hi = hiBound;
  for (const b of blocks || []) {
    if (b.isPlan || b.id === exceptId) continue;
    if (b.endMin <= origin) lo = Math.max(lo, b.endMin);
    else if (b.startMin >= origin) hi = Math.min(hi, b.startMin);
    else return null;
  }
  if (hi - lo < 1) return null;
  return { startMin: lo, endMin: hi };
}

function subtractRange(block, cutStart, cutEnd) {
  if (block.endMin <= cutStart || block.startMin >= cutEnd) return [block];
  const pieces = [];
  if (block.startMin < cutStart) {
    pieces.push({ ...block, endMin: cutStart });
  }
  if (block.endMin > cutEnd) {
    const right = { ...block, startMin: cutEnd };
    if (pieces.length) right.id = uid();
    pieces.push(right);
  }
  return pieces.filter((p) => p.endMin - p.startMin >= 1);
}

/** Place an actual block so each minute belongs to at most one record. Later block wins the overlap. */
export function insertExclusive(blocks, incoming) {
  const start = Math.min(Number(incoming.startMin), Number(incoming.endMin));
  const end = Math.max(Number(incoming.startMin), Number(incoming.endMin));
  if (end - start < 1) return (blocks || []).filter((b) => b.id !== incoming.id);
  const placed = { ...incoming, startMin: start, endMin: end, isPlan: false };
  const next = [];
  for (const b of blocks || []) {
    if (b.id === placed.id) continue;
    if (b.isPlan) {
      next.push(b);
      continue;
    }
    next.push(...subtractRange(b, start, end));
  }
  next.push(placed);
  next.sort((a, b) => a.startMin - b.startMin);
  return next;
}

export function foldExclusive(blocks) {
  let out = [];
  for (const b of blocks || []) {
    if (b.isPlan) out.push(b);
    else out = insertExclusive(out, b);
  }
  return out;
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
