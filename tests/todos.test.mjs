import assert from "node:assert/strict";
import {
  formatTodoDue,
  nearestOpenTodoSlot,
  normalizeTodos,
  sortTodos,
  todoCounts,
} from "../js/todos.js";

assert.equal(formatTodoDue("2026-09-18", "zh", "2026-09-18"), "今天");
assert.equal(formatTodoDue("2026-09-19", "zh", "2026-09-18"), "明天");
assert.equal(formatTodoDue("2026-09-20", "zh", "2026-09-18"), "后天");
assert.equal(formatTodoDue("2026-09-23", "zh", "2026-09-18"), "下周三");
assert.equal(formatTodoDue("2026-09-17", "zh", "2026-09-18"), "已逾期 · 9月17日");
assert.equal(formatTodoDue("2026-09-23", "en", "2026-09-18"), "Next Wed");

const todos = normalizeTodos([
  { id: "a", text: "  交作业  ", dueISO: "2026-09-18" },
  { id: "b", text: "买东西", done: true },
  { id: "bad", text: "   " },
]);
assert.equal(todos.length, 2);
assert.equal(todos[0].text, "交作业");
assert.deepEqual(todoCounts(todos, "2026-09-18"), { remaining: 1, today: 1 });
assert.deepEqual(sortTodos(todos).map((todo) => todo.id), ["a", "b"]);

const blocks = [{ id: "plan", startMin: 600, endMin: 660 }];
assert.deepEqual(
  nearestOpenTodoSlot(blocks, 615, 30, { lo: 540, hi: 720 }),
  { startMin: 660, endMin: 690 },
);
assert.deepEqual(
  nearestOpenTodoSlot([{ id: "all", startMin: 0, endMin: 1440 }], 600, 30),
  null,
);

console.log("todos tests passed");
