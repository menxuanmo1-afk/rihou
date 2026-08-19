import { kindById, todayISO, addDays } from "./models.js";

export const PAST_DAYS = 45;
export const FUTURE_DAYS = 45;

export const ASSET_BOOKS = [
  { id: "all", kinds: null },
  { id: "mind", kinds: ["STUDY", "READ", "WORK"] },
  { id: "body", kinds: ["FITNESS"] },
  { id: "craft", kinds: ["CREATE"] },
  { id: "restore", kinds: ["MEAL", "REST"] },
];

function isoWeekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isWeekend(iso) {
  const w = isoWeekday(iso);
  return w === 0 || w === 6;
}

function expanded(blocks) {
  const rows = [];
  for (const b of blocks || []) {
    if (b.isPlan) continue;
    const ids = b.kinds?.length ? b.kinds : [b.kind];
    const share = (b.endMin - b.startMin) / ids.length;
    for (const id of ids) rows.push({ kind: id, minutes: share });
  }
  return rows;
}

function hoursForKinds(blocks, kinds) {
  const rows = expanded(blocks);
  let min = 0;
  for (const row of rows) {
    const k = kindById(row.kind);
    if (k.bucket !== "invest") continue;
    if (!kinds || kinds.includes(row.kind)) min += row.minutes;
  }
  return min / 60;
}

function allInvestHours(blocks) {
  return hoursForKinds(blocks, null);
}

function weekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return ["日", "一", "二", "三", "四", "五", "六"][new Date(y, m - 1, d).getDay()];
}

function walkDays(startISO, endISO, days) {
  const out = [];
  for (let iso = startISO; iso <= endISO; iso = addDays(iso, 1)) {
    out.push({ iso, blocks: days[iso]?.blocks || [] });
  }
  return out;
}

/** 坚持越久比例越高；工作日荒废则降；周末轻降、不断条。 */
function nextRatio(ratio, streak, invested, weekend) {
  if (invested) {
    return { ratio: Math.min(2, ratio + 0.018), streak: streak + 1 };
  }
  if (weekend) {
    return { ratio: Math.max(1, ratio - 0.03), streak };
  }
  return { ratio: Math.max(1, ratio - 0.12), streak: 0 };
}

function chartLabels(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  if (lang === "en") {
    return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()]} ${m}/${d}`;
  }
  return `${m}/${d} 周${weekday(iso)}`;
}

function evalCode(recentH, prevH, totalH, lastWaste) {
  if (totalH <= 0.01) return "empty";
  if (lastWaste === "weekday") return "waste";
  if (lastWaste === "weekend") return "weekend";
  if (prevH < 0.05 && recentH > 0.05) return "rising";
  if (recentH > prevH * 1.12) return "rising";
  if (prevH > 0.05 && recentH < prevH * 0.88) return "slow";
  return "flat";
}

export function remainingMinutes(iso, now = new Date()) {
  if (iso !== todayISO(now)) return 0;
  return Math.max(0, 24 * 60 - (now.getHours() * 60 + now.getMinutes()));
}

function firstInvestISO(days, today) {
  const keys = Object.keys(days || {}).sort();
  for (const iso of keys) {
    if (iso > today) continue;
    if (allInvestHours(days[iso]?.blocks) > 0) return iso;
  }
  return today;
}

export function buildPortfolio(state, now = new Date()) {
  const today = todayISO(now);
  const earliest = firstInvestISO(state.days, today);
  const days = walkDays(earliest, today, state.days);
  const books = ASSET_BOOKS.map((book) => ({
    ...book,
    series: [],
    asset: 0,
    todayH: 0,
    totalH: 0,
  }));

  let ratio = 1;
  let streak = 0;
  let lastWaste = null;

  for (const day of days) {
    const investH = allInvestHours(day.blocks);
    const weekend = isWeekend(day.iso);
    const isToday = day.iso === today;
    if (isToday) {
      if (investH > 0) {
        const next = nextRatio(ratio, streak, true, weekend);
        ratio = next.ratio;
        streak = next.streak;
        lastWaste = null;
      }
    } else {
      const next = nextRatio(ratio, streak, investH > 0, weekend);
      ratio = next.ratio;
      streak = next.streak;
      lastWaste = investH <= 0 ? (weekend ? "weekend" : "weekday") : null;
    }
    for (const book of books) {
      const h = hoursForKinds(day.blocks, book.kinds);
      book.totalH += h;
      if (isToday) book.todayH = h;
      book.asset += h * ratio;
      book.series.push({
        iso: day.iso,
        hours: h,
        ratio,
        asset: book.asset,
        label: chartLabels(day.iso, state.settings.lang),
      });
    }
  }

  const byId = Object.fromEntries(books.map((b) => [b.id, b]));
  return {
    ratio,
    streak,
    lastWaste,
    remainingMin: remainingMinutes(today, now),
    books: byId,
  };
}

function avgHours(slice) {
  if (!slice.length) return 0;
  return slice.reduce((s, p) => s + p.hours, 0) / slice.length;
}

export function forecastSeries(book, ratio) {
  const past = book.series.slice(-PAST_DAYS);
  const recent = book.series.slice(-7);
  const prev = book.series.slice(-14, -7);
  const daily = avgHours(recent) * ratio;
  const last = past[past.length - 1];
  const lastISO = last?.iso || todayISO();
  const lastAsset = last?.asset || 0;
  const future = [];
  for (let i = 1; i <= FUTURE_DAYS; i++) {
    const iso = addDays(lastISO, i);
    future.push({
      iso,
      hours: daily,
      ratio,
      asset: lastAsset + daily * i,
      forecast: true,
      label: chartLabels(iso, "zh"),
    });
  }
  return {
    past,
    future,
    daily,
    recentH: avgHours(recent),
    prevH: avgHours(prev),
  };
}

export function bookEval(book, port) {
  const { recentH, prevH } = forecastSeries(book, port.ratio);
  const waste = book.id === "all" ? port.lastWaste : null;
  return evalCode(recentH, prevH, book.totalH, waste);
}

function pathFrom(points, x, y) {
  return points
    .map((p, i) => `${i ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.asset).toFixed(1)}`)
    .join(" ");
}

export function assetChartSvg(book, port, lang) {
  const { past, future } = forecastSeries(book, port.ratio);
  const leftPad = Math.max(0, PAST_DAYS - past.length);
  const pastPts = past.map((p, i) => ({ ...p, i: leftPad + i }));
  const futurePts = future.map((p, i) => ({ ...p, i: leftPad + past.length - 1 + i + 1 }));
  const n = PAST_DAYS + FUTURE_DAYS;
  const todayI = leftPad + past.length - 1;
  const allY = [...pastPts, ...futurePts].map((p) => p.asset);
  const maxY = Math.max(1, ...allY) * 1.08;
  const W = 720;
  const H = 168;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const x = (i) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - v / maxY) * (H - padT - padB);
  const pastPath = pathFrom(pastPts, x, y);
  const join = pastPts[pastPts.length - 1];
  const futurePath = join
    ? `M${x(join.i).toFixed(1)},${y(join.asset).toFixed(1)} ${futurePts
        .map((p) => `L${x(p.i).toFixed(1)},${y(p.asset).toFixed(1)}`)
        .join(" ")}`
    : "";
  const todayX = x(Math.max(0, todayI));
  const todayLabel = lang === "en" ? "now" : "今天";
  const pastLabel = lang === "en" ? "past" : "已过";
  const nextLabel = lang === "en" ? "ahead" : "预测";
  return `<svg class="asset-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <line class="chart-axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
    <line class="chart-today" x1="${todayX.toFixed(1)}" y1="${padT}" x2="${todayX.toFixed(1)}" y2="${H - padB}"/>
    <path class="chart-past" d="${pastPath}"/>
    <path class="chart-future mid" d="${futurePath}"/>
    <text class="chart-lab" x="${padL + 4}" y="${H - 6}">${pastLabel}</text>
    <text class="chart-lab mid" x="${todayX.toFixed(1)}" y="${H - 6}">${todayLabel}</text>
    <text class="chart-lab end" x="${W - padR - 4}" y="${H - 6}">${nextLabel}</text>
  </svg>`;
}

export function formatHours(h, lang) {
  const n = Math.max(0, h);
  const text = n >= 10 ? n.toFixed(0) : n.toFixed(1);
  return lang === "en" ? `${text}h` : `${text} 小时`;
}

export function formatRemain(min, lang) {
  const text = (Math.max(0, min) / 60).toFixed(1);
  return lang === "en" ? `${text}h` : `${text} 小时`;
}

export function formatAsset(n) {
  const v = Math.max(0, n);
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}
