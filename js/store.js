import { emptyDay, todayISO, foldExclusive, insertExclusive, setCustomKinds, setCustomBooks } from "./models.js?v=50";

const DAYS = "rihou.days.v1";
const SETTINGS = "rihou.settings.v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function blocksOnly(day) {
  return { blocks: foldExclusive(Array.isArray(day?.blocks) ? day.blocks : []) };
}

export function loadDay(date) {
  const all = readJson(DAYS, {});
  const saved = all[date];
  if (!saved) return emptyDay(date);
  return { date, ...blocksOnly(saved) };
}

export function saveDay(day) {
  const all = readJson(DAYS, {});
  all[day.date] = blocksOnly(day);
  const cleaned = {};
  for (const [iso, saved] of Object.entries(all)) {
    cleaned[iso] = blocksOnly(saved);
  }
  writeJson(DAYS, cleaned);
}

export function upsertBlock(day, block) {
  const kinds = Array.isArray(block.kinds) && block.kinds.length > 0
    ? block.kinds
    : [block.kind || "OTHER"];
  const { clipStart: _cs, clipEnd: _ce, ...rest } = block;
  const normalized = {
    ...rest,
    kinds,
    kind: kinds[0],
  };
  const next = {
    ...day,
    blocks: insertExclusive(day.blocks, normalized),
  };
  saveDay(next);
  return next;
}

export function removeBlock(day, id) {
  const next = { ...day, blocks: day.blocks.filter((b) => b.id !== id) };
  saveDay(next);
  return next;
}

export function loadSettings() {
  const saved = readJson(SETTINGS, {});
  const { habits: _habits, ...rest } = saved && typeof saved === "object" ? saved : {};
  const daily = Number(rest.dailyHours);
  setCustomBooks(rest.customBooks);
  setCustomKinds(rest.customKinds);
  const customBooks = setCustomBooks(rest.customBooks);
  const customKinds = setCustomKinds(rest.customKinds);
  return {
    promptEnabled: true,
    lastOffer: "",
    lang: "zh",
    customKinds: [],
    customBooks: [],
    ...rest,
    customKinds,
    customBooks,
    dailyHours: Number.isFinite(daily) ? Math.min(4, Math.max(0.5, daily)) : 1,
  };
}

export function loadCustomKinds() {
  return loadSettings().customKinds;
}

export function saveCustomKinds(list) {
  const prev = loadSettings();
  const next = setCustomKinds(list);
  const customBooks = setCustomBooks(prev.customBooks);
  saveSettings({ ...prev, customKinds: next, customBooks });
  return next;
}

export function saveCustomBooks(list) {
  const prev = loadSettings();
  const next = setCustomBooks(list);
  const allowed = new Set(["mind", "body", "craft", ...next.map((b) => b.id)]);
  const customKinds = setCustomKinds(prev.customKinds.map((c) => (
    allowed.has(c.book) ? c : { ...c, book: "mind" }
  )));
  saveSettings({ ...prev, customBooks: next, customKinds });
  return next;
}

export function loadAllDays() {
  const all = readJson(DAYS, {});
  const out = {};
  for (const [iso, day] of Object.entries(all)) {
    out[iso] = blocksOnly(day);
  }
  return out;
}

export function earliestDate() {
  const keys = Object.keys(readJson(DAYS, {}));
  if (keys.length === 0) return todayISO();
  return keys.sort()[0];
}

export function saveSettings(settings) {
  const { habits: _habits, ...rest } = settings && typeof settings === "object" ? settings : {};
  writeJson(SETTINGS, rest);
}

export function exportAll() {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      days: loadAllDays(),
      settings: loadSettings(),
    },
    null,
    2,
  );
}

export function importAll(raw) {
  const data = JSON.parse(raw);
  if (data.days) {
    const folded = {};
    for (const [iso, day] of Object.entries(data.days)) {
      folded[iso] = blocksOnly(day);
    }
    writeJson(DAYS, folded);
  }
  if (data.settings) {
    const { habits: _habits, ...rest } = data.settings;
    writeJson(SETTINGS, { ...loadSettings(), ...rest });
  }
}

export function alreadyOffered(stamp) {
  return loadSettings().lastOffer === stamp;
}

export function markOffered(stamp) {
  saveSettings({ ...loadSettings(), lastOffer: stamp });
}

export { todayISO };
