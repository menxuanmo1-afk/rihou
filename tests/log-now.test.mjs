import assert from "node:assert/strict";
import { gapFromLastToNow, planRemainingAfter, plansOutsideActualRange } from "../js/models.js";

const at1130 = new Date(2026, 8, 18, 11, 30);
const actual = { id: "actual", isPlan: false, startMin: 9 * 60, endMin: 10 * 60 };
const currentPlan = { id: "current", isPlan: true, startMin: 11 * 60, endMin: 12 * 60 };

assert.deepEqual(
  gapFromLastToNow({ blocks: [actual, currentPlan] }, at1130),
  { startMin: 10 * 60, endMin: 11 * 60 + 30, overnight: false, coveringPlanId: "current" },
  "logging to now must extend into the active plan",
);

assert.deepEqual(
  gapFromLastToNow({
    blocks: [
      actual,
      { id: "finished-plan", isPlan: true, startMin: 10 * 60, endMin: 11 * 60 },
      currentPlan,
    ],
  }, at1130),
  { startMin: 10 * 60, endMin: 11 * 60 + 30, overnight: false, coveringPlanId: "current" },
  "finished plans must not become the previous actual boundary",
);

assert.deepEqual(
  gapFromLastToNow({ blocks: [actual] }, at1130),
  { startMin: 10 * 60, endMin: 11 * 60 + 30, overnight: false, coveringPlanId: null },
  "ordinary logging behavior remains unchanged when no plan covers now",
);

assert.deepEqual(
  planRemainingAfter(currentPlan, 11 * 60 + 30),
  { ...currentPlan, startMin: 11 * 60 + 30 },
  "the active plan starts at the actual record end",
);

assert.equal(
  planRemainingAfter(currentPlan, 12 * 60),
  null,
  "a plan fully covered by the actual record has no remaining occurrence",
);

const finished = { id: "finished", isPlan: true, startMin: 600, endMin: 630, todoId: "todo" };
const second = { id: "second", isPlan: true, startMin: 630, endMin: 660 };
const future = { id: "future", isPlan: true, startMin: 720, endMin: 750 };
for (const plans of [[finished], [finished, second], [finished, second, future]]) {
  assert.equal(gapFromLastToNow({ blocks: [actual, ...plans] }, at1130).startMin, 600);
}
assert.equal(gapFromLastToNow({ blocks: [actual, currentPlan] }, new Date(2026, 8, 18, 12)).startMin, 600);
assert.equal(gapFromLastToNow({ blocks: [finished, second] }, at1130).startMin, 0);
assert.deepEqual(
  gapFromLastToNow({ blocks: [finished] }, at1130, { blocks: [
    { ...actual, startMin: 1320, endMin: 1380 },
    { ...finished, startMin: 1380, endMin: 1440 },
  ] }),
  { startMin: 1380, endMin: 690, overnight: true, coveringPlanId: null },
);
assert.equal(gapFromLastToNow({ blocks: [] }, at1130, { blocks: [finished] }).overnight, false);
assert.equal(gapFromLastToNow({ blocks: [actual, { ...actual, id: "new", startMin: 630, endMin: 660 }, currentPlan] }, at1130).startMin, 660);

const blocks = [actual, finished, second, currentPlan, future];
const original = structuredClone(blocks);
assert.deepEqual(plansOutsideActualRange(blocks, 600, 690), [actual, { ...currentPlan, startMin: 690 }, future]);
assert.deepEqual(blocks, original, "opening/cancelling a draft must not mutate stored plans");
assert.deepEqual(plansOutsideActualRange(blocks, 600, 720), [actual, future]);
assert.deepEqual(plansOutsideActualRange(blocks, 600, 600), blocks);
const spanning = { ...currentPlan, startMin: 580, endMin: 740, seriesId: "repeat", todoId: "todo" };
const split = plansOutsideActualRange([spanning], 600, 690);
assert.deepEqual(split.map(({ startMin, endMin, seriesId, todoId }) => ({ startMin, endMin, seriesId, todoId })), [
  { startMin: 580, endMin: 600, seriesId: "repeat", todoId: "todo" },
  { startMin: 690, endMin: 740, seriesId: "repeat", todoId: "todo" },
]);
assert.notEqual(split[0].id, split[1].id);

// Exercise both persistence adapters, including recurring plans after a reload.
globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); },
};
globalThis.window = new EventTarget();
const events = [];
window.addEventListener("rihou:store-changed", event => events.push(event.detail));
for (const path of ["../js/store.js", "../js/native/store.js"]) {
  const store = await import(path);
  localStorage.values.clear();
  events.length = 0;
  const date = "2026-09-18";
  store.saveSettings({
    todos: [{ id: "todo", text: "unchanged", done: false }],
    planSeries: [{ id: "repeat", startDate: date, freq: "daily", kinds: ["STUDY"], startMin: 630, endMin: 660 }],
  });
  store.saveDay({ date, blocks: [actual, finished, currentPlan, future] });
  const day = store.loadDay(date);
  const log = { id: "log", startMin: 600, endMin: 690, kind: "STUDY" };
  assert.ok(day.blocks.some(block => block.seriesId === "repeat"));
  store.upsertBlock(day, log, { consumePlans: true });
  const saved = store.loadDay(date);
  assert.deepEqual(saved.blocks.map(b => [b.id, b.startMin, b.endMin]), [
    ["actual", 540, 600], ["log", 600, 690], ["current", 690, 720], ["future", 720, 750],
  ], path);
  assert.equal(store.loadSettings().todos[0].done, false);
  assert.equal(store.loadDay("2026-09-19").blocks.filter(b => b.seriesId === "repeat").length, 1);
  if (path.includes("native")) assert.ok(events.findLast(e => e.date === date).previous.blocks.some(b => b.seriesId === "repeat"), "AI review retains the original planned occurrence");

  const partialDate = "2026-09-19";
  store.upsertBlock(store.loadDay(partialDate), { ...log, endMin: 645 }, { consumePlans: true });
  assert.equal(store.loadDay(partialDate).blocks.find(b => b.seriesId === "repeat").startMin, 645);
  const ordinaryDate = "2026-09-20";
  store.upsertBlock(store.loadDay(ordinaryDate), log);
  assert.equal(store.loadDay(ordinaryDate).blocks.find(b => b.seriesId === "repeat").startMin, 630, "ordinary editing keeps its existing plan behavior");
}

console.log("log-now range, multi-plan, overnight and both storage adapters passed");
