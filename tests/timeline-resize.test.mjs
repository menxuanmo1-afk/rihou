import assert from "node:assert/strict";
import { resizeTimelineSpan } from "../js/timeline-resize.js";

const short = { startMin: 600, endMin: 605 };

assert.deepEqual(
  resizeTimelineSpan(short, "end", 615, { lo: 0, hi: 1440, minSpan: 5, step: 5 }),
  { startMin: 600, endMin: 615 },
  "dragging the lower edge must never move the upper edge",
);

assert.deepEqual(
  resizeTimelineSpan(short, "start", 590, { lo: 0, hi: 1440, minSpan: 5, step: 5 }),
  { startMin: 590, endMin: 605 },
  "dragging the upper edge must never move the lower edge",
);

assert.deepEqual(
  resizeTimelineSpan(short, "end", 590, { lo: 0, hi: 1440, minSpan: 5, step: 5 }),
  { startMin: 600, endMin: 605 },
  "the lower edge cannot cross the upper edge",
);

assert.deepEqual(
  resizeTimelineSpan({ startMin: 600, endMin: 601 }, "end", 600, { lo: 0, hi: 1440, minSpan: 5, step: 5 }),
  { startMin: 600, endMin: 605 },
  "resizing a legacy one-minute block expands only the selected lower edge",
);

assert.deepEqual(
  resizeTimelineSpan(short, "start", 620, { lo: 0, hi: 1440, minSpan: 5, step: 5 }),
  { startMin: 600, endMin: 605 },
  "the upper edge cannot cross the lower edge",
);

assert.deepEqual(
  resizeTimelineSpan({ startMin: 600, endMin: 660 }, "end", 700, { lo: 540, hi: 675, minSpan: 5, step: 5 }),
  { startMin: 600, endMin: 675 },
  "the lower edge stops at the next block wall",
);

assert.deepEqual(
  resizeTimelineSpan({ startMin: 600, endMin: 660 }, "start", 500, { lo: 570, hi: 720, minSpan: 5, step: 5 }),
  { startMin: 570, endMin: 660 },
  "the upper edge stops at the previous block wall",
);

assert.deepEqual(
  resizeTimelineSpan({ startMin: 600, endMin: 660 }, "end", 663, { lo: 0, hi: 1440, minSpan: 5, step: 5 }),
  { startMin: 600, endMin: 665 },
  "dragging snaps consistently to five-minute marks",
);

assert.deepEqual(
  resizeTimelineSpan({ startMin: 600, endMin: 630 }, "start", 625, { lo: 0, hi: 1440, minSpan: 15, step: 5 }),
  { startMin: 615, endMin: 630 },
  "plan drafts retain their fifteen-minute minimum",
);

assert.deepEqual(
  resizeTimelineSpan({ startMin: 600, endMin: 630 }, "end", 605, { lo: 540, hi: 660, minSpan: 15, step: 5 }),
  { startMin: 600, endMin: 615 },
  "resizing an existing plan keeps its fifteen-minute minimum without moving the opposite edge",
);

console.log("timeline resize tests passed");
