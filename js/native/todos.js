import { uid } from "../models.js?v=102";
import { loadSettings, saveSettings } from "./store.js?v=102";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDueISO(value) {
  const due = String(value || "").trim();
  return ISO_DATE.test(due) ? due : "";
}

export function normalizeTodo(todo) {
  if (!todo || typeof todo !== "object") return null;
  const text = String(todo.text || "").trim();
  if (!text) return null;
  const done = Boolean(todo.done);
  return {
    id: String(todo.id || uid()),
    text,
    dueISO: cleanDueISO(todo.dueISO),
    done,
    createdAt: String(todo.createdAt || new Date().toISOString()),
    completedAt: done ? String(todo.completedAt || new Date().toISOString()) : null,
  };
}

export function normalizeTodos(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.flatMap((item) => {
    const todo = normalizeTodo(item);
    if (!todo || seen.has(todo.id)) return [];
    seen.add(todo.id);
    return [todo];
  });
}

export function loadTodos() {
  return normalizeTodos(loadSettings().todos);
}

function persistTodos(list) {
  const todos = normalizeTodos(list);
  saveSettings({ ...loadSettings(), todos });
  return todos;
}

export function addTodo({ text, dueISO = "" }) {
  const todo = normalizeTodo({
    id: uid(),
    text,
    dueISO,
    done: false,
    createdAt: new Date().toISOString(),
  });
  if (!todo) return loadTodos();
  return persistTodos([...loadTodos(), todo]);
}

export function updateTodo(id, patch) {
  const current = loadTodos();
  const next = current.map((todo) => {
    if (todo.id !== id) return todo;
    return normalizeTodo({ ...todo, ...patch, id: todo.id }) || todo;
  });
  return persistTodos(next);
}

export function setTodoDone(id, done) {
  return updateTodo(id, {
    done: Boolean(done),
    completedAt: done ? new Date().toISOString() : null,
  });
}

export function todoCounts(list, todayISO) {
  const active = normalizeTodos(list).filter((todo) => !todo.done);
  return {
    remaining: active.length,
    today: active.filter((todo) => todo.dueISO === todayISO).length,
  };
}

function isoDayNumber(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  if (!year || !month || !day) return NaN;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

const ZH_WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
const EN_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatTodoDue(dueISO, locale = "zh", today) {
  const due = cleanDueISO(dueISO);
  const base = cleanDueISO(today);
  if (!due || !base) return "";
  const delta = isoDayNumber(due) - isoDayNumber(base);
  const [year, month, day] = due.split("-").map(Number);
  const dueWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const [, baseMonth, baseDay] = base.split("-").map(Number);
  const baseYear = Number(base.slice(0, 4));
  const baseWeekday = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay)).getUTCDay();
  const dueWeekStart = isoDayNumber(due) - ((dueWeekday + 6) % 7);
  const baseWeekStart = isoDayNumber(base) - ((baseWeekday + 6) % 7);
  const sameWeek = dueWeekStart === baseWeekStart;
  if (locale === "en") {
    if (delta < 0) return `Overdue · ${month}/${day}`;
    if (delta === 0) return "Today";
    if (delta === 1) return "Tomorrow";
    if (delta === 2) return "In 2 days";
    if (delta <= 7) return `${sameWeek ? "This" : "Next"} ${EN_WEEKDAY[dueWeekday]}`;
    return `${month}/${day}`;
  }
  if (delta < 0) return `已逾期 · ${month}月${day}日`;
  if (delta === 0) return "今天";
  if (delta === 1) return "明天";
  if (delta === 2) return "后天";
  if (delta <= 7) return `${sameWeek ? "这周" : "下周"}${ZH_WEEKDAY[dueWeekday]}`;
  return `${month}月${day}日`;
}

export function sortTodos(list) {
  return normalizeTodos(list).sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueISO && b.dueISO && a.dueISO !== b.dueISO) return a.dueISO.localeCompare(b.dueISO);
    if (a.dueISO !== b.dueISO) return a.dueISO ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function overlaps(blocks, startMin, endMin, ignoreId) {
  return (blocks || []).some((block) => (
    block?.id !== ignoreId
    && Number(block.startMin) < endMin
    && Number(block.endMin) > startMin
  ));
}

export function nearestOpenTodoSlot(blocks, preferredStart, duration = 30, {
  lo = 0,
  hi = 24 * 60,
  step = 5,
  ignoreId = null,
} = {}) {
  const span = Math.max(step, Math.round(Number(duration) / step) * step);
  const first = Math.ceil(Number(lo) / step) * step;
  const last = Math.floor((Number(hi) - span) / step) * step;
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return null;
  const preferred = Math.max(first, Math.min(last, Math.round(Number(preferredStart) / step) * step));
  const candidates = [];
  for (let start = first; start <= last; start += step) candidates.push(start);
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || b - a);
  const startMin = candidates.find((start) => !overlaps(blocks, start, start + span, ignoreId));
  return startMin == null ? null : { startMin, endMin: startMin + span };
}
