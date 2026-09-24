import assert from "node:assert/strict";
import {
  KIND_GROUP_PALETTES,
  colorForKind,
  groupForKind,
  groupPickerKinds,
  normalizeKindGroup,
} from "../js/native/kind-picker.js";

const kind = (id, extra = {}) => ({ id, ...extra });
assert.equal(groupForKind(kind("STUDY")), "invest");
assert.equal(groupForKind(kind("SLEEP")), "health");
assert.equal(groupForKind(kind("GAME")), "entertain");
assert.equal(groupForKind(kind("COMMUTE")), "other");
assert.equal(groupForKind(kind("CUS", { custom: true, book: "body" })), "health", "legacy body custom items migrate to health");
assert.equal(groupForKind(kind("CUS_DISC", { custom: true, label: "飞盘", book: "mind" })), "health", "飞盘 defaults to health");
assert.equal(groupForKind(kind("CUS", { custom: true }), { CUS: "entertain" }), "entertain");
assert.equal(groupForKind(kind("STUDY"), { STUDY: "other" }), "other", "built-ins can be reclassified in settings");
assert.equal(normalizeKindGroup("bad"), "invest");

const defaults = groupPickerKinds([kind("READ"), kind("CLASS"), kind("STUDY"), kind("CREATE")]);
assert.deepEqual(defaults[0].kinds.map((item) => item.id), ["STUDY", "CLASS", "READ", "CREATE"]);

const groups = groupPickerKinds(
  [kind("STUDY"), kind("READ"), kind("SLEEP"), kind("GAME"), kind("OTHER")],
  { READ: 8, STUDY: 2 },
);
assert.deepEqual(groups.find((group) => group.id === "invest").kinds.map((item) => item.id), ["READ", "STUDY"], "frequent items move forward inside their category");
assert.deepEqual(groups.map((group) => group.kinds[0]?.id), ["READ", "SLEEP", "GAME", "OTHER"]);

const manual = groupPickerKinds(
  [kind("STUDY"), kind("READ"), kind("DAZE")],
  { STUDY: 99 },
  {},
  { invest: ["READ", "STUDY"] },
  false,
);
assert.deepEqual(manual[0].kinds.map((item) => item.id), ["READ", "STUDY"], "manual order overrides usage");
assert.equal(manual.flatMap((group) => group.kinds).some((item) => item.id === "DAZE"), false, "发呆 is removed from the picker");

for (const group of groups) for (const item of group.kinds) {
  assert.match(colorForKind(item, group.id), /^#[0-9A-F]{6}$/i);
}
assert.equal(colorForKind(kind("CUS", { custom: true, color: KIND_GROUP_PALETTES.health[1] }), "health"), KIND_GROUP_PALETTES.health[1]);
assert(KIND_GROUP_PALETTES.invest.every((color) => !KIND_GROUP_PALETTES.health.includes(color)));
console.log("native grouped kind picker tests passed");
