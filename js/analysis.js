import { kindById, durationMin, blockKinds, addDays, todayISO } from "./models.js";
import { loadDay, earliestDate } from "./store.js";

const DAY_MIN = 24 * 60;
const PAST_DAYS = 42;
const FUTURE_DAYS = 90;

function expanded(blocks) {
  const rows = [];
  for (const block of (blocks || []).filter((b) => !b.isPlan)) {
    const kinds = blockKinds(block);
    const dur = durationMin(block);
    const each = kinds.length ? dur / kinds.length : dur;
    for (const kind of kinds) {
      rows.push({ kind, minutes: each });
    }
  }
  return rows;
}

export function minutesByBucket(blocks) {
  let invest = 0;
  let consume = 0;
  let other = 0;
  for (const row of expanded(blocks)) {
    const bucket = kindById(row.kind).bucket || "other";
    if (bucket === "invest") invest += row.minutes;
    else if (bucket === "consume") consume += row.minutes;
    else other += row.minutes;
  }
  return { invest, consume, other };
}

export function multiplierForStreak(streak) {
  if (streak >= 100) return 2;
  if (streak >= 30) return 1.5;
  if (streak >= 7) return 1.2;
  return 1;
}

function eachIso(from, to) {
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function buildPortfolio(endIso = todayISO()) {
  const today = todayISO();
  const start = earliestDate();
  const from = start < endIso ? start : endIso;
  const days = eachIso(from, today < endIso ? endIso : today);

  let streak = 0;
  let asset = 0;
  let hadInvest = false;
  const series = [];

  for (const iso of days) {
    const { invest } = minutesByBucket(loadDay(iso).blocks);
    const hours = invest / 60;
    const isToday = iso === today;

    if (hours > 0) {
      streak += 1;
      hadInvest = true;
    } else if (!isToday) {
      streak = 0;
    }

    const multiplier = multiplierForStreak(streak);
    const value = hours * multiplier;
    asset += value;
    series.push({ iso, hours, value, asset, streak, multiplier });
  }

  const todayRow = series.find((d) => d.iso === today) || series[series.length - 1];
  const view = minutesByBucket(loadDay(endIso).blocks);
  const viewInvest = view.invest;
  const viewConsume = view.consume;
  const viewRest = Math.max(0, DAY_MIN - viewInvest - viewConsume);

  const broken = hadInvest && streak === 0;

  return {
    asset,
    streak: todayRow?.streak || 0,
    multiplier: todayRow?.multiplier || 1,
    series,
    broken,
    hadInvest,
    view: {
      investMin: viewInvest,
      consumeMin: viewConsume,
      restMin: viewRest,
    },
    todayHours: todayRow?.hours || 0,
  };
}

function fmt(n) {
  const v = Math.max(0, n);
  if (v >= 100) return v.toFixed(0);
  return v.toFixed(1);
}

export function formatAsset(n) {
  return fmt(n);
}

function xAt(i, n, left, width) {
  if (n <= 1) return left;
  return left + (i / (n - 1)) * width;
}

function yAt(value, max, top, height) {
  const m = max <= 0 ? 1 : max;
  return top + height - (value / m) * height;
}

export function assetChartSvg(portfolio, dailyHours, labels) {
  const pastAll = portfolio.series;
  const past = pastAll.slice(-PAST_DAYS);
  const nPast = Math.max(1, past.length);
  const n = nPast + FUTURE_DAYS;
  const w = 320;
  const h = 168;
  const left = 8;
  const right = 8;
  const top = 10;
  const bottom = 26;
  const innerW = w - left - right;
  const innerH = h - top - bottom;
  const todayIndex = nPast - 1;
  const startAsset = past[0]?.asset || 0;
  const nowAsset = portfolio.asset;
  const m = portfolio.multiplier;
  const lowH = dailyHours * 0.5;
  const midH = dailyHours;
  const highH = dailyHours * 2;

  const future = (hoursPerDay) => {
    const pts = [];
    for (let d = 0; d <= FUTURE_DAYS; d += 1) {
      pts.push(nowAsset + d * hoursPerDay * m);
    }
    return pts;
  };

  const fLow = future(lowH);
  const fMid = future(midH);
  const fHigh = future(highH);
  const yMax = Math.max(nowAsset, fHigh[fHigh.length - 1], 1);

  const pastPts = past.map((row, i) => {
    const x = xAt(i, n, left, innerW);
    const y = yAt(row.asset, yMax, top, innerH);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const toLine = (values) => values
    .map((value, d) => {
      const x = xAt(todayIndex + d, n, left, innerW);
      const y = yAt(value, yMax, top, innerH);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const todayX = xAt(todayIndex, n, left, innerW);
  const y0 = yAt(0, yMax, top, innerH);
  const startY = yAt(startAsset, yMax, top, innerH);

  return `<svg class="asset-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <line class="chart-axis" x1="${left}" y1="${y0}" x2="${w - right}" y2="${y0}" />
    <line class="chart-today" x1="${todayX}" y1="${top}" x2="${todayX}" y2="${y0}" />
    <polyline class="chart-past" fill="none" points="${pastPts.join(" ")}" />
    ${past.length === 1 ? `<circle class="chart-dot" cx="${todayX}" cy="${startY}" r="2.5" />` : ""}
    <polyline class="chart-future low" fill="none" points="${toLine(fLow)}" />
    <polyline class="chart-future mid" fill="none" points="${toLine(fMid)}" />
    <polyline class="chart-future high" fill="none" points="${toLine(fHigh)}" />
    <text class="chart-lab" x="${left}" y="${h - 8}">${escapeSvg(past[0]?.iso?.slice(5) || "")}</text>
    <text class="chart-lab mid" x="${todayX}" y="${h - 8}">${escapeSvg(labels.today)}</text>
    <text class="chart-lab end" x="${w - right}" y="${h - 8}">+${FUTURE_DAYS}d</text>
  </svg>`;
}

function escapeSvg(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}
