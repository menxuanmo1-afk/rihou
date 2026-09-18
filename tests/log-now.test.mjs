import assert from "node:assert/strict";
import { gapFromLastToNow, planRemainingAfter } from "../js/models.js";

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
  { startMin: 11 * 60, endMin: 11 * 60 + 30, overnight: false, coveringPlanId: "current" },
  "an already-finished plan remains the previous occupied boundary",
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

console.log("log-now plan adjustment tests passed");
