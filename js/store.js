import { emptyDay, emptyHabits, DEFAULT_HABITS, todayISO } from "./models.js?v=15";

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

export function loadHabits() {
  const saved = loadSettings().habits;
  if (Array.isArray(saved) && saved.length > 0) return saved;
  return DEFAULT_HABITS.map((h) => ({ ...h }));
}

export function saveHabits(habits) {
  saveSettings({ ...loadSettings(), habits });
}

export function loadDay(date) {
  const all = readJson(DAYS, {});
  const saved = all[date];
  const blanks = emptyHabits(loadHabits());
  if (!saved) return { ...emptyDay(date), habits: blanks };
  return {
    date,
    blocks: Array.isArray(saved.blocks) ? saved.blocks : [],
    habits: { ...blanks, ...(saved.habits || {}) },
  };
}

export function saveDay(day) {
  const all = readJson(DAYS, {});
  all[day.date] = { blocks: day.blocks, habits: day.habits };
  writeJson(DAYS, all);
}

export function upsertBlock(day, block) {
  const kinds = Array.isArray(block.kinds) && block.kinds.length > 0
    ? block.kinds
    : [block.kind || "OTHER"];
  const normalized = {
    ...block,
    kinds,
    kind: kinds[0],
  };
  const next = {
    ...day,
    blocks: [...day.blocks.filter((b) => b.id !== normalized.id), normalized],
  };
  saveDay(next);
  return next;
}

export function removeBlock(day, id) {
  const next = { ...day, blocks: day.blocks.filter((b) => b.id !== id) };
  saveDay(next);
  return next;
}

export function toggleHabit(day, habitId) {
  const next = {
    ...day,
    habits: { ...day.habits, [habitId]: !day.habits[habitId] },
  };
  saveDay(next);
  return next;
}

export function loadSettings() {
  const saved = readJson(SETTINGS, {});
  const daily = Number(saved.dailyHours);
  return {
    promptEnabled: true,
    lastOffer: "",
    lang: "zh",
    ...saved,
    dailyHours: Number.isFinite(daily) ? Math.min(4, Math.max(0.5, daily)) : 1,
  };
}

export function loadAllDays() {
  return readJson(DAYS, {});
}

export function earliestDate() {
  const keys = Object.keys(readJson(DAYS, {}));
  if (keys.length === 0) return todayISO();
  return keys.sort()[0];
}

export function saveSettings(settings) {
  writeJson(SETTINGS, settings);
}

export function exportAll() {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      days: readJson(DAYS, {}),
      settings: loadSettings(),
    },
    null,
    2,
  );
}

export function importAll(raw) {
  const data = JSON.parse(raw);
  if (data.days) writeJson(DAYS, data.days);
  if (data.settings) writeJson(SETTINGS, { ...loadSettings(), ...data.settings });
}

export function alreadyOffered(stamp) {
  return loadSettings().lastOffer === stamp;
}

export function markOffered(stamp) {
  saveSettings({ ...loadSettings(), lastOffer: stamp });
}

export { todayISO };
