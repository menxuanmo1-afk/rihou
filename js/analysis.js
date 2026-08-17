import { emptyDay, kindById, Payoff, durationMin, formatDuration, blockKinds } from "./models.js";
import { loadHabits } from "./store.js";

function expanded(blocks) {
  const rows = [];
  for (const block of blocks.filter((b) => !b.isPlan)) {
    const kinds = blockKinds(block);
    const dur = durationMin(block);
    const each = kinds.length ? dur / kinds.length : dur;
    for (const kind of kinds) {
      rows.push({ ...block, kind, minutes: each });
    }
  }
  return rows;
}

export function minutesOf(blocks, payoff) {
  return expanded(blocks)
    .filter((row) => kindById(row.kind).payoff === payoff)
    .reduce((sum, row) => sum + row.minutes, 0);
}

export function minutesOfKind(blocks, kindId) {
  return expanded(blocks)
    .filter((row) => row.kind === kindId)
    .reduce((sum, row) => sum + row.minutes, 0);
}

export function alignmentPercent(day) {
  const plans = day.blocks.filter((b) => b.isPlan);
  if (plans.length === 0) return 0;
  let overlap = 0;
  for (const plan of plans) {
    const planKinds = new Set(blockKinds(plan));
    for (const actual of day.blocks.filter((b) => !b.isPlan)) {
      const share = blockKinds(actual).some((k) => planKinds.has(k));
      if (!share) continue;
      const start = Math.max(plan.startMin, actual.startMin);
      const end = Math.min(plan.endMin, actual.endMin);
      overlap += Math.max(0, end - start);
    }
  }
  const planned = plans.reduce((sum, b) => sum + durationMin(b), 0) || 1;
  return Math.max(0, Math.min(100, Math.round((overlap * 100) / planned)));
}

export function unloggedMinutes(actuals, now, isToday) {
  const until = isToday ? now.getHours() * 60 + now.getMinutes() : 24 * 60;
  const windowStart = 7 * 60;
  const windowEnd = Math.max(windowStart, Math.min(until, 23 * 60));
  if (windowEnd <= windowStart) return 0;
  let covered = 0;
  for (const block of actuals) {
    const start = Math.max(block.startMin, windowStart);
    const end = Math.min(block.endMin, windowEnd);
    covered += Math.max(0, end - start);
  }
  return Math.max(0, windowEnd - windowStart - covered);
}

function longestDelayStretch(actuals) {
  const delay = actuals.filter((b) => blockKinds(b).some((k) => kindById(k).payoff === Payoff.DELAY));
  if (delay.length === 0) return null;
  const best = delay.reduce((a, b) => (durationMin(b) > durationMin(a) ? b : a));
  if (durationMin(best) < 40) return null;
  const label = best.title || blockKinds(best).map((id) => kindById(id).label).join(" / ");
  return `最长的一段「${label}」有 ${formatDuration(durationMin(best))}`;
}

function titleFor(awesome, delay, instant, day, habits) {
  const sleepId = habits.find((h) => h.label.includes("十一点") || h.id === "SLEEP_BEFORE_11")?.id;
  const tidyId = habits.find((h) => h.label.includes("整理") || h.id === "TIDY")?.id;
  const sleep = sleepId && day.habits[sleepId];
  const tidy = tidyId && day.habits[tidyId];
  if (delay >= 180 && instant < 40) return "延迟满足选手";
  if (delay >= 120 && sleep) return "把难的做完，再把明天交给清醒的自己";
  if (awesome >= 70 && tidy) return "今天的房间和大脑，都比昨天整齐";
  if (awesome >= 70) return "今天的你，比昨天更像自己想成为的人";
  if (delay > instant && delay >= 60) return "即时满足没有赢走这一天";
  if (delay === 0 && instant > 60) return "多巴胺先到了，成就还在路上";
  if (delay === 0) return "这一天还是空白信封";
  return "还在攒，已经比刷着过完一天强";
}

export function analyze(day = emptyDay(""), bingeBreaks = 0, now = new Date(), isToday = true) {
  const habits = loadHabits();
  const actuals = day.blocks.filter((b) => !b.isPlan);
  const delay = minutesOf(day.blocks, Payoff.DELAY);
  const care = minutesOf(day.blocks, Payoff.CARE);
  const instant = minutesOf(day.blocks, Payoff.INSTANT);
  const habitPoints = habits.reduce((sum, h) => sum + (day.habits[h.id] ? h.points : 0), 0);
  const alignment = alignmentPercent(day);
  const unlogged = unloggedMinutes(actuals, now, isToday);
  const longest = longestDelayStretch(actuals);
  const seeds = Math.floor(delay / 30);

  let index = 0;
  index += delay * 0.12;
  index += care * 0.05;
  index += habitPoints;
  index += Math.min(10, alignment / 10);
  if (bingeBreaks === 0 && delay >= 60) index += 8;
  index -= instant * 0.08;
  const awesome = Math.max(0, Math.min(100, Math.round(index)));

  const highlights = [];
  if (longest) highlights.push(longest);
  if (delay > instant && delay >= 30) {
    highlights.push(
      `延迟满足 ${formatDuration(delay)}，即时满足 ${formatDuration(instant)}。你把更多时间给了以后会感谢你的事。`,
    );
  } else if (instant > delay && instant >= 30) {
    highlights.push("即时满足今天占了上风。不是失败，是数据。下一小时可以扳回来。");
  }
  if (alignment >= 70) highlights.push(`计划和实际对上了 ${alignment}%。说到做到，本身就是一种延迟满足。`);
  else if (day.blocks.some((b) => b.isPlan)) {
    highlights.push(`计划和实际重合 ${alignment}%。计划不是用来愧疚的，是用来对照的。`);
  }
  for (const habit of habits) {
    if (day.habits[habit.id]) {
      const hint = habit.hint ? `。${habit.hint}` : "";
      highlights.push(`${habit.label}加了 ${habit.points} 分${hint}。`);
    }
  }
  const study = minutesOfKind(day.blocks, "STUDY");
  const read = minutesOfKind(day.blocks, "READ");
  const fitness = minutesOfKind(day.blocks, "FITNESS");
  if (study >= 60) highlights.push(`学习 ${formatDuration(study)}。不会立刻爽，但明天打开书的阻力会变小。`);
  if (read >= 30) highlights.push(`读了 ${formatDuration(read)}。短视频是预消化的刺激，书要把注意力自己煮熟。`);
  if (fitness >= 20) highlights.push(`身体也在记账：健身 ${formatDuration(fitness)}。`);
  if (care >= 30) highlights.push(`吃饭和休息 ${formatDuration(care)}，不是偷懒，是让延迟满足可持续。`);
  if (unlogged >= 120) highlights.push(`空白时段还有 ${formatDuration(unlogged)}。记下来，分析才不是空话。`);
  if (habitPoints === 0 && delay === 0) {
    highlights.push("日常加分可以自己改。做了就点一下，很小，但可见。");
  }

  let futureYield;
  if (delay < 20) {
    futureYield = "延迟满足像种子：这一小时看起来什么都没发生，一周后才会发芽。先记下一笔。";
  } else {
    futureYield = `今天种下 ${seeds} 颗半小时的种子。如果这不是偶发，而是一周七天：大约 ${formatDuration(delay * 7)}。一个月，是 ${formatDuration(delay * 30)}——一本读完的书，或一套做完的题。即时满足当场兑现，延迟满足按复利记账。`;
  }

  const summaryParts = [`厉害指数 ${awesome}。`];
  if (delay > 0) summaryParts.push(`你给未来的自己存了 ${formatDuration(delay)}。`);
  if (instant > 0) summaryParts.push(`即时满足占了 ${formatDuration(instant)}。`);
  if (care > 0) summaryParts.push("吃饭、休息、整理也算照顾自己。");
  if (habitPoints > 0) summaryParts.push(`习惯加了 ${habitPoints} 分。`);
  if (unlogged >= 90) summaryParts.push(`还有 ${formatDuration(unlogged)} 没记，整点提醒就是为这个来的。`);
  if (delay === 0 && instant === 0) {
    summaryParts.push("点「记到现在」，把上次记录到此刻填上。");
  }

  return {
    awesomeIndex: awesome,
    title: titleFor(awesome, delay, instant, day, habits),
    summary: summaryParts.join(" ").trim(),
    highlights: highlights.slice(0, 6),
    delayMinutes: delay,
    careMinutes: care,
    instantMinutes: instant,
    unloggedMinutes: unlogged,
    habitPoints,
    alignmentPercent: alignment,
    seeds,
    futureYield,
  };
}

export function weekStats(loadDay, endIso) {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const [y, m, d] = endIso.split("-").map(Number);
    const date = new Date(y, m - 1, d - i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const day = loadDay(iso);
    days.push({
      iso,
      delay: minutesOf(day.blocks, Payoff.DELAY),
      instant: minutesOf(day.blocks, Payoff.INSTANT),
    });
  }
  return {
    days,
    delayTotal: days.reduce((s, d) => s + d.delay, 0),
    activeDays: days.filter((d) => d.delay >= 30).length,
  };
}
