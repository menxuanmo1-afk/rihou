import { emptyDay, todayISO, foldExclusive, insertExclusive, setCustomKinds, setCustomBooks, uid, planOccursOn } from "./models.js?v=87";

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
  const day = saved ? { date, ...blocksOnly(saved) } : emptyDay(date);
  return hydrateDayPlans(date, day);
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
    isPlan: false,
  };
  const next = {
    ...day,
    blocks: insertExclusive(day.blocks, normalized),
  };
  saveDay(next);
  return next;
}

export function upsertPlan(day, block) {
  const kinds = Array.isArray(block.kinds) && block.kinds.length > 0
    ? block.kinds
    : [block.kind || "OTHER"];
  const start = Math.min(Number(block.startMin), Number(block.endMin));
  const end = Math.max(Number(block.startMin), Number(block.endMin));
  if (end - start < 1) return day;
  const plan = {
    id: block.id || uid(),
    isPlan: true,
    startMin: start,
    endMin: end,
    kinds,
    kind: kinds[0],
    title: String(block.title || ""),
    seriesId: block.seriesId || null,
  };
  const next = {
    ...day,
    blocks: [...(day.blocks || []).filter((b) => b.id !== plan.id), plan],
  };
  saveDay(next);
  return next;
}

export function removeBlock(day, id) {
  const next = { ...day, blocks: day.blocks.filter((b) => b.id !== id) };
  saveDay(next);
  return next;
}

function dropUnusedSettings(obj) {
  if (!obj || typeof obj !== "object") return {};
  const { habits: _h, promptEnabled: _p, lastOffer: _o, appearance: _a, accent: _c, ...rest } = obj;
  return rest;
}

export function loadSettings() {
  const saved = dropUnusedSettings(readJson(SETTINGS, {}));
  const daily = Number(saved.dailyHours);
  setCustomBooks(saved.customBooks);
  setCustomKinds(saved.customKinds);
  const customBooks = setCustomBooks(saved.customBooks);
  const customKinds = setCustomKinds(saved.customKinds);
  return {
    lang: "zh",
    customKinds: [],
    customBooks: [],
    ...saved,
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
    out[iso] = hydrateDayPlans(iso, { date: iso, ...blocksOnly(day) });
  }
  return out;
}

function normalizePlanSeries(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && s.id && Array.isArray(s.kinds) && s.kinds.length);
}

function planSkipMap() {
  const raw = loadSettings().planSkip;
  return raw && typeof raw === "object" ? { ...raw } : {};
}

export function loadPlanSeries() {
  return normalizePlanSeries(loadSettings().planSeries);
}

export function savePlanSeries(list) {
  saveSettings({ ...loadSettings(), planSeries: normalizePlanSeries(list) });
}

export function skipPlanOccurrence(seriesId, iso) {
  if (!seriesId || !iso) return;
  const skip = planSkipMap();
  skip[`${seriesId}:${iso}`] = true;
  saveSettings({ ...loadSettings(), planSkip: skip });
}

export function clearFuturePlanInstances(seriesId, fromIso) {
  if (!seriesId) return;
  const all = readJson(DAYS, {});
  let changed = false;
  for (const [iso, day] of Object.entries(all)) {
    if (iso < fromIso) continue;
    const blocks = Array.isArray(day?.blocks) ? day.blocks : [];
    const next = blocks.filter((b) => !(b.isPlan && b.seriesId === seriesId));
    if (next.length !== blocks.length) {
      all[iso] = { blocks: foldExclusive(next) };
      changed = true;
    }
  }
  if (changed) writeJson(DAYS, all);
}

function hydrateDayPlans(iso, day) {
  const series = loadPlanSeries();
  if (!series.length) return day;
  const skip = planSkipMap();
  const claimed = new Set();
  for (const b of day.blocks || []) {
    if (b.seriesId) claimed.add(b.seriesId);
    if (b.fromSeriesId) claimed.add(b.fromSeriesId);
  }
  const extra = [];
  for (const s of series) {
    if (!planOccursOn(s, iso)) continue;
    if (skip[`${s.id}:${iso}`]) continue;
    if (claimed.has(s.id)) continue;
    extra.push({
      id: `${s.id}-${iso}`,
      isPlan: true,
      seriesId: s.id,
      startMin: Number(s.startMin) || 0,
      endMin: Number(s.endMin) || 0,
      kinds: [...s.kinds],
      kind: s.kinds[0],
      title: String(s.title || ""),
    });
  }
  if (!extra.length) return day;
  return { ...day, blocks: [...day.blocks, ...extra] };
}

export function earliestDate() {
  const keys = Object.keys(readJson(DAYS, {}));
  if (keys.length === 0) return todayISO();
  return keys.sort()[0];
}

export function saveSettings(settings) {
  writeJson(SETTINGS, dropUnusedSettings(settings));
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
    writeJson(SETTINGS, { ...loadSettings(), ...dropUnusedSettings(data.settings) });
  }
}

export { todayISO };
