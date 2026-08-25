import { kindById, todayISO, addDays } from "./models.js?v=26";
import { loadAllDays } from "./store.js?v=26";

export const PAST_DAYS = 45;
export const FUTURE_DAYS = 45;
export const BASE_PRICE = 100;

export const ASSET_BOOKS = [
  { id: "all", kinds: null },
  { id: "mind", kinds: ["STUDY", "READ", "CLASS", "WORK"] },
  { id: "body", kinds: ["FITNESS", "SPORT"] },
  { id: "craft", kinds: ["CREATE"] },
  { id: "restore", kinds: ["MEAL", "REST", "SLEEP", "SHOWER"] },
];

const SUB_IDS = ["mind", "body", "craft", "restore"];
const P_MIN = 28;
const P_MAX = 520;

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
    const ids = Array.isArray(b.kinds) && b.kinds.length ? b.kinds : [b.kind || "OTHER"];
    const share = (Number(b.endMin) - Number(b.startMin)) / Math.max(1, ids.length);
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
  const table = days || {};
  const out = [];
  let iso = /^\d{4}-\d{2}-\d{2}$/.test(startISO) ? startISO : endISO;
  let guard = 0;
  for (; iso <= endISO && guard < 400; iso = addDays(iso, 1), guard += 1) {
    const blocks = table[iso]?.blocks;
    out.push({ iso, blocks: Array.isArray(blocks) ? blocks : [] });
  }
  return out;
}

/** 市价：投入上涨，荒废下跌，周末几乎走平。贵了以后涨得慢。 */
export function nextPrice(price, bookH, weekend, globalH) {
  let r;
  if (weekend) {
    r = bookH > 0 ? 0.005 : -0.003;
  } else if (bookH > 0) {
    r = 0.03 + Math.min(bookH, 4) * 0.015;
    const heat = Math.max(0, price - 140) / 140;
    r *= 1 / (1 + 1.15 * heat);
  } else if (globalH > 0) {
    r = -0.018;
  } else {
    r = -0.06;
  }
  return Math.min(P_MAX, Math.max(P_MIN, price * (1 + r)));
}

function chartLabels(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  if (lang === "en") {
    return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()]} ${m}/${d}`;
  }
  return `${m}/${d} 周${weekday(iso)}`;
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

function emptyBook(spec) {
  return {
    ...spec,
    totalH: 0,
    todayH: 0,
    price: BASE_PRICE,
    value: 0,
    series: [],
  };
}

function markDay(book, iso, hours, price, lang) {
  book.totalH += hours;
  book.price = price;
  book.value = book.totalH * book.price;
  book.series.push({
    iso,
    hours,
    price: book.price,
    value: book.value,
    label: chartLabels(iso, lang),
  });
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

export function buildPortfolio(state, now = new Date()) {
  const today = todayISO(now);
  const payload = state && typeof state === "object" && !Array.isArray(state)
    ? state
    : { days: loadAllDays(), settings: {} };
  const dayTable = payload.days || loadAllDays();
  const lang = payload.settings?.lang || "zh";
  const earliest = firstInvestISO(dayTable, today);
  const days = walkDays(earliest, today, dayTable);
  const subs = SUB_IDS.map((id) => emptyBook(ASSET_BOOKS.find((b) => b.id === id)));
  const all = emptyBook(ASSET_BOOKS[0]);
  let lastWaste = null;

  for (const day of days) {
    const globalH = allInvestHours(day.blocks);
    const weekend = isWeekend(day.iso);
    const isToday = day.iso === today;
    if (!isToday) {
      lastWaste = globalH <= 0 ? (weekend ? "weekend" : "weekday") : null;
    } else if (globalH > 0) {
      lastWaste = null;
    }

    for (const book of subs) {
      const h = hoursForKinds(day.blocks, book.kinds);
      if (isToday) book.todayH = h;
      const hadPosition = book.totalH > 0 || h > 0;
      let price = book.price;
      if (hadPosition) {
        if (isToday) {
          if (h > 0) price = nextPrice(book.price, h, weekend, globalH);
        } else {
          price = nextPrice(book.price, h, weekend, globalH);
        }
      }
      markDay(book, day.iso, h, price, lang);
    }

    all.todayH = globalH;
    all.totalH = subs.reduce((s, b) => s + b.totalH, 0);
    all.value = subs.reduce((s, b) => s + b.value, 0);
    all.price = all.totalH > 0 ? all.value / all.totalH : BASE_PRICE;
    all.series.push({
      iso: day.iso,
      hours: globalH,
      price: all.price,
      value: all.value,
      label: chartLabels(day.iso, lang),
    });
  }

  const books = { all, ...Object.fromEntries(subs.map((b) => [b.id, b])) };
  return {
    lastWaste,
    remainingMin: remainingMinutes(today, now),
    books,
    asset: all.value,
    multiplier: all.price / BASE_PRICE,
    streak: 0,
    broken: false,
    hadInvest: all.totalH > 0,
    series: all.series,
  };
}

function avgHours(slice) {
  if (!slice.length) return 0;
  return slice.reduce((s, p) => s + p.hours, 0) / slice.length;
}

function pace(series) {
  const recent = series.slice(-14);
  const wd = recent.filter((p) => !isWeekend(p.iso));
  const we = recent.filter((p) => isWeekend(p.iso));
  return {
    wd: avgHours(wd.slice(-5)),
    we: avgHours(we.slice(-4)),
    recentH: avgHours(series.slice(-7)),
    prevH: avgHours(series.slice(-14, -7)),
  };
}

export function forecastSeries(book) {
  const past = (book?.series || []).slice(-PAST_DAYS);
  const { wd, we, recentH, prevH } = pace(book?.series || []);
  const last = past[past.length - 1];
  let iso = last?.iso || todayISO();
  let price = book?.price || BASE_PRICE;
  let hours = book?.totalH || 0;
  const future = [];
  for (let i = 1; i <= FUTURE_DAYS; i++) {
    iso = addDays(iso, 1);
    const weekend = isWeekend(iso);
    const h = weekend ? we : wd;
    if (hours > 0 || h > 0) {
      price = nextPrice(price, h, weekend, h);
      hours += h;
    }
    future.push({
      iso,
      hours: h,
      price,
      value: hours * price,
      forecast: true,
      label: chartLabels(iso, "zh"),
    });
  }
  return { past, future, recentH, prevH };
}

function forecastAll(port) {
  const packs = SUB_IDS.map((id) => forecastSeries(port.books?.[id]));
  const past = port.books.all.series.slice(-PAST_DAYS);
  const future = packs[0].future.map((row, i) => ({
    iso: row.iso,
    forecast: true,
    value: packs.reduce((s, p) => s + p.future[i].value, 0),
    price: 0,
    hours: packs.reduce((s, p) => s + p.future[i].hours, 0),
    label: row.label,
  }));
  const { recentH, prevH } = pace(port.books.all.series);
  return { past, future, recentH, prevH };
}

export function packFor(book, port) {
  return book.id === "all" ? forecastAll(port) : forecastSeries(book);
}

export function bookEval(book, port) {
  const { recentH, prevH } = packFor(book, port);
  if (book.totalH <= 0.01) return "empty";
  const series = book.series;
  const nowV = series[series.length - 1]?.value || 0;
  const agoV = series[Math.max(0, series.length - 8)]?.value || 0;
  if (book.id === "all" && port.lastWaste === "weekday") return "waste";
  if (book.id === "all" && port.lastWaste === "weekend") return "weekend";
  if (nowV > agoV * 1.08 || recentH > prevH * 1.12) return "rising";
  if (nowV < agoV * 0.92 || (prevH > 0.05 && recentH < prevH * 0.88)) return "slow";
  return "flat";
}

export function formatMoney(n, compact = false) {
  const v = Math.max(0, n);
  if (compact || v >= 10000) {
    if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 1 : 1)}k`;
    return `$${Math.round(v)}`;
  }
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function formatPrice(n) {
  return `$${Math.round(Math.max(0, n))}/h`;
}

function formatAxisTick(n, maxY) {
  const v = Math.max(0, n);
  if (maxY >= 1000) return `${(v / 1000).toFixed(maxY >= 10000 ? 1 : 1)}k`;
  return `${Math.round(v)}`;
}

function yRange(vals) {
  const nums = vals.filter((n) => Number.isFinite(n));
  const hi = Math.max(1, ...(nums.length ? nums : [0]));
  const lo = nums.length ? Math.min(...nums) : 0;
  const pad = Math.max(40, (hi - lo) * 0.12);
  return {
    minY: Math.max(0, lo - pad),
    maxY: hi + Math.max(40, (hi - lo) * 0.1),
  };
}

function scaleFor(book, port) {
  const mine = packFor(book, port);
  const myVals = [...mine.past, ...mine.future].map((p) => p.value);
  if (book.id === "all") return { ...mine, ...yRange(myVals) };
  const pool = SUB_IDS.flatMap((id) => {
    const pack = packFor(port.books[id], port);
    return [...pack.past, ...pack.future].map((p) => p.value);
  });
  return { ...mine, ...yRange(pool) };
}

function pathFrom(points, x, y) {
  return points
    .map((p, i) => `${i ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
}

export function assetChartHtml(book, port, lang) {
  const { past, future, minY, maxY } = scaleFor(book, port);
  const leftPad = Math.max(0, PAST_DAYS - past.length);
  const pastPts = past.map((p, i) => ({ ...p, i: leftPad + i }));
  const futurePts = future.map((p, i) => ({ ...p, i: leftPad + past.length - 1 + i + 1 }));
  const n = PAST_DAYS + FUTURE_DAYS;
  const todayI = leftPad + past.length - 1;
  const W = 720;
  const H = 176;
  const padL = 4;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const span = Math.max(1, maxY - minY);
  const x = (i) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - minY) / span) * (H - padT - padB);
  const pastPath = pathFrom(pastPts, x, y);
  const join = pastPts[pastPts.length - 1];
  const futurePath = join
    ? `M${x(join.i).toFixed(1)},${y(join.value).toFixed(1)} ${futurePts
        .map((p) => `L${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`)
        .join(" ")}`
    : "";
  const todayX = x(Math.max(0, todayI));
  const todayLabel = lang === "en" ? "now" : "今天";
  const pastLabel = lang === "en" ? "past" : "已过";
  const nextLabel = lang === "en" ? "ahead" : "预测";
  const tickVals = [maxY, minY + span * (2 / 3), minY + span / 3, minY];
  const grids = tickVals
    .map((v) => `<line class="chart-grid" x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}"/>`)
    .join("");
  const ticks = tickVals.map((v) => formatAxisTick(v, maxY));
  const svg = `<svg class="asset-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${grids}
    <line class="chart-axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
    <line class="chart-today" x1="${todayX.toFixed(1)}" y1="${padT}" x2="${todayX.toFixed(1)}" y2="${H - padB}"/>
    <path class="chart-past" d="${pastPath}"/>
    <path class="chart-future mid" d="${futurePath}"/>
    <text class="chart-lab" x="${padL + 4}" y="${H - 6}">${pastLabel}</text>
    <text class="chart-lab mid" x="${todayX.toFixed(1)}" y="${H - 6}">${todayLabel}</text>
    <text class="chart-lab end" x="${W - padR - 4}" y="${H - 6}">${nextLabel}</text>
  </svg>`;
  return `<div class="chart-frame">
    <div class="y-axis" aria-hidden="true">
      <span class="y-unit">$</span>
      <div class="y-ticks">${ticks.map((lab) => `<span>${lab}</span>`).join("")}</div>
    </div>
    <div class="chart-wrap" id="asset-chart">${svg}</div>
  </div>`;
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
  return formatMoney(n);
}

export function assetChartSvg(port, _daily, _labels) {
  if (!port?.books?.all) return "";
  return assetChartHtml(port.books.all, port, "zh");
}
