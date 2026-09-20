// Optional browser regression: serve the repo, run ios:sync, then set BASE_URL
// and PLAYWRIGHT_MODULE (if Playwright isn't installed in this project).
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:5189";
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
const block = (id, startMin, endMin, isPlan = false, extra = {}) => ({ id, startMin, endMin, isPlan, kinds: ["STUDY"], kind: "STUDY", ...extra });
const cases = [
  { name: "past-plans", time: "2026-09-20T11:30:00+08:00", start: "10:00", end: "11:30", days: {
    "2026-09-20": { blocks: [block("actual", 540, 600), block("past", 600, 630, true, { todoId: "todo" }), block("past2", 630, 660, true), block("future", 720, 750, true)] },
  }, expected: { "2026-09-20": [[540, 600, false], [600, 690, false], [720, 750, true]] } },
  { name: "past-and-current", time: "2026-09-20T11:30:00+08:00", start: "10:00", end: "11:30", days: {
    "2026-09-20": { blocks: [block("actual", 540, 600), block("past", 600, 660, true), block("current", 660, 720, true), block("future", 780, 810, true)] },
  }, expected: { "2026-09-20": [[540, 600, false], [600, 690, false], [690, 720, true], [780, 810, true]] } },
  { name: "overnight", time: "2026-09-20T08:00:00+08:00", start: "23:00", end: "08:00", days: {
    "2026-09-19": { blocks: [block("actual", 1320, 1380), block("late", 1380, 1440, true)] },
    "2026-09-20": { blocks: [block("early", 420, 450, true), block("current", 450, 510, true)] },
  }, expected: { "2026-09-19": [[1320, 1380, false], [1380, 1440, false]], "2026-09-20": [[0, 480, false], [480, 510, true]] } },
  { name: "no-actual", time: "2026-09-20T11:30:00+08:00", start: "00:00", end: "11:30", days: {
    "2026-09-20": { blocks: [block("past", 600, 660, true)] },
  }, expected: { "2026-09-20": [[0, 690, false]] } },
];
try {
  for (const entry of ["/", "/www/"]) for (const fixture of cases) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: "Asia/Shanghai", serviceWorkers: "block" });
    // Do not send telemetry or any fixture data to external services.
    await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await context.addInitScript(({ days }) => {
      localStorage.setItem("rihou.days.v1", JSON.stringify(days));
      localStorage.setItem("rihou.settings.v1", JSON.stringify({ lang: "zh", todos: [{ id: "todo", text: "Test todo", done: false }] }));
    }, fixture);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date(fixture.time));
    await page.goto(base + entry);
    await page.locator("#start-time").waitFor(); // Opening the app offers the same recording sheet.
    assert.equal(await page.locator("#start-time").inputValue(), fixture.start, `${entry} ${fixture.name} initial start`);
    await page.locator("[data-close]").click();
    await page.locator("#sheet-bg.show").waitFor({ state: "hidden" });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("rihou.days.v1"))), fixture.days, "cancellation preserves plans");
    await page.locator('[data-act="log-now"]').click();
    assert.equal(await page.locator("#start-time").inputValue(), fixture.start);
    assert.equal(await page.locator("#end-time").inputValue(), fixture.end);
    // Time controls must also ignore plans, not only the initial range.
    await page.locator('[data-nudge="end,-5"]').click();
    await page.locator('[data-now="end"]').click();
    assert.equal(await page.locator("#end-time").inputValue(), fixture.end);
    await page.locator('#kind-row [data-kind="STUDY"]').click();
    await page.locator("[data-save]").click();
    await page.locator("#sheet-bg.show").waitFor({ state: "hidden" });
    const result = await page.evaluate(() => ({ days: JSON.parse(localStorage.getItem("rihou.days.v1")), settings: JSON.parse(localStorage.getItem("rihou.settings.v1")) }));
    for (const [date, expected] of Object.entries(fixture.expected)) {
      assert.deepEqual(result.days[date].blocks.map(b => [b.startMin, b.endMin, b.isPlan]), expected, `${entry} ${fixture.name} saved ${date}`);
    }
    assert.equal(result.settings.todos[0].done, false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${entry === "/" ? "web" : "native bundle"}: ${fixture.name}`);
    await context.close();
  }
} finally { await browser.close(); }
