import {
  pickerKinds,
  uid,
  kindById,
  minutesToHm,
  parseHm,
  hmInputValue,
  todayISO,
  addDays,
  dateTitle,
  blockKinds,
  blockColors,
  gradientCss,
  gapFromLastToNow,
  lastActualEnd,
  nowMinutes,
  actualAtMinute,
  emptySpan,
  KINDS,
  listCustomKinds,
  CUSTOM_MAX,
  CUSTOM_LABEL_MAX,
  CUSTOM_BOOK_MAX,
  KIND_COLORS,
  listValuationBooks,
  listCustomBooks,
  customBookCandidates,
} from "./models.js?v=45";
import {
  loadDay,
  upsertBlock,
  removeBlock,
  loadSettings,
  saveSettings,
  exportAll,
  importAll,
  alreadyOffered,
  markOffered,
  loadAllDays,
  loadCustomKinds,
  saveCustomKinds,
  saveCustomBooks,
} from "./store.js?v=45";
import {
  ASSET_BOOKS,
  BASE_PRICE,
  buildPortfolio,
  bookAt,
  assetChartHtml,
  formatMoney,
  formatPrice,
  formatHours,
  formatRemain,
  remainingMinutes,
  bookEval,
} from "./analysis.js?v=45";
import { t, lang, kindLabel, formatDurationI18n } from "./i18n.js?v=45";

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_H = 56;

const state = {
  date: todayISO(),
  day: loadDay(todayISO()),
  tab: "time",
  book: "all",
  planDraft: null,
  slide: "",
};

const gesture = {
  kind: null,
  pointerId: null,
  originMin: 0,
  startX: 0,
  startY: 0,
  lastY: 0,
  timer: 0,
  suppressClick: false,
  suppressTimer: 0,
  windowBound: false,
  clipStart: 0,
  clipEnd: 0,
};

const LONG_PRESS_MS = 420;
const PRESS_MOVE_PX = 18;
const PLAN_SNAP = 5;
const PLAN_MIN = 15;
const DAY_SWIPE_PX = 56;
const DAY_AXIS_PX = 14;

const daySwipe = {
  pointerId: null,
  startX: 0,
  startY: 0,
  dx: 0,
  axis: null,
};

function currentDay() {
  state.day = loadDay(state.date);
  return state.day;
}

function bookLabel(id) {
  if (id === "all" || id === "mind" || id === "body" || id === "craft") return t(`book.${id}`);
  return listCustomBooks().find((b) => b.id === id)?.label || t("customKind");
}

function report() {
  const known = new Set(["all", "mind", "body", "craft", ...listCustomBooks().map((b) => b.id)]);
  if (!known.has(state.book)) state.book = "all";
  return buildPortfolio({
    days: loadAllDays(),
    settings: loadSettings(),
  });
}

function render() {
  try {
    renderApp();
  } catch (err) {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `<section class="panel achieve-wrap" style="padding:24px">
        <p>页面刚才卡住了，再打开一次就好。</p>
        <p class="muted">${String(err && err.message ? err.message : err)}</p>
      </section>`;
    }
  }
}

function renderApp() {
  loadCustomKinds();
  currentDay();
  const app = document.getElementById("app");
  const isToday = state.date === todayISO();
  const slide = state.slide;
  state.slide = "";
  let r;
  try {
    r = report();
  } catch {
    r = { remainingMin: remainingMinutes(todayISO()), books: { all: { todayH: 0, totalH: 0, value: 0, price: BASE_PRICE, series: [] } } };
  }
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const onAsset = state.tab === "achieve";
  const showTime = wide || state.tab === "time";
  const showAchieve = wide || onAsset;
  document.documentElement.lang = lang() === "en" ? "en" : "zh-CN";
  let achieve = "";
  if (showAchieve) {
    try {
      achieve = achieveHtml(r);
    } catch {
      achieve = `<p class="muted">估值页暂时画不出来。</p>`;
    }
  }
  const book = r.books?.[state.book] || r.books?.all;
  const snap = bookAt(book, state.date);
  const investLabel = isToday ? t("todayInvest") : t("thatDayInvest");
  const headerIsInvest = !isToday;
  const headerGloss = headerIsInvest ? "todayInvest" : "principal";
  const headerLabel = headerIsInvest ? investLabel : t("principal");
  const headerVal = headerIsInvest ? formatHours(snap.dayH, lang()) : formatRemain(r.remainingMin, lang());
  app.innerHTML = `
    <header class="top">
      <div class="date-nav">
        <button class="btn" data-act="prev">‹</button>
        <div>
          <h1>${dateTitle(state.date, lang())}</h1>
          <div class="sub"><button type="button" class="gloss-inline" data-act="gloss" data-gloss="${headerGloss}">${headerLabel}</button> ${headerVal}</div>
        </div>
        <button class="btn" data-act="next">›</button>
      </div>
      <div class="top-actions">
        ${isToday ? `<button class="btn log-now" data-act="log-now">${t("logNow")}</button>` : `<button class="btn" data-act="today">${t("today")}</button>`}
      </div>
    </header>
    <div class="main ${slide ? `in-${slide}` : ""}" id="day-stage">
      ${showTime ? `<section class="panel timeline-wrap">
        <div class="hint">${t("hint")}</div>
        ${timelineHtml()}
      </section>` : ""}
      ${showAchieve ? `<section class="panel achieve-wrap">
        ${achieve}
      </section>` : ""}
    </div>
    <nav class="tabs">
      <button class="${state.tab === "time" ? "on" : ""}" data-act="tab-time">${t("time")}</button>
      <button class="${state.tab === "achieve" ? "on" : ""}" data-act="tab-achieve">${t("assetTab")}</button>
    </nav>
  `;
  bindApp();
  scrollToNow();
  pinFrame();
}

function timelineHtml() {
  const hours = END_HOUR - START_HOUR;
  const height = hours * HOUR_H;
  const now = new Date();
  const isToday = state.date === todayISO();
  const nowMin = nowMinutes(now);
  const nowTop = ((nowMin - START_HOUR * 60) / 60) * HOUR_H;
  const showNow = isToday && nowMin >= START_HOUR * 60 && nowMin < END_HOUR * 60;

  const hourRows = Array.from({ length: hours }, (_, i) => {
    const hour = START_HOUR + i;
    return `<div class="hour-row" data-hour="${hour}"><span class="hour-label">${String(hour).padStart(2, "0")}:00</span></div>`;
  }).join("");

  const blocks = (state.day.blocks || [])
    .filter((block) => !block.isPlan && block.endMin > block.startMin)
    .map((block) => blockHtml(block))
    .join("");

  return `<div class="timeline" id="timeline">
    <div class="track" id="track" style="height:${height}px">
      ${hourRows}
      ${blocks}
      ${showNow ? `<div class="now-line" style="top:${nowTop}px"></div>` : ""}
      ${planDraftHtml()}
    </div>
  </div>`;
}

function blockHtml(block) {
  const visStart = Math.max(block.startMin, START_HOUR * 60);
  const visEnd = Math.min(block.endMin, END_HOUR * 60);
  if (visEnd <= visStart) return "";
  const { top, h } = blockGeom(block.startMin, block.endMin);
  const colors = blockColors(block);
  const mixed = colors.length > 1;
  const name = liveBlockLabel(block);
  const ink = mixed || luminance(colors[0]) <= 0.55 ? "#F4EDE4" : "#0F1419";
  const style = [
    `top:${top}px`,
    `height:${h}px`,
    `background:${gradientCss(colors)}`,
    `color:${ink}`,
  ].join(";");
  return `<div class="block actual${mixed ? " mix" : ""}" data-id="${block.id}" style="${style}">
        ${name}${h > 28 ? `<div class="when">${minutesToHm(block.startMin)}–${minutesToHm(block.endMin)}</div>` : ""}
      </div>`;
}

function blockGeom(startMin, endMin) {
  const visStart = Math.max(startMin, START_HOUR * 60);
  const visEnd = Math.min(endMin, END_HOUR * 60);
  const top = ((visStart - START_HOUR * 60) / 60) * HOUR_H;
  const h = Math.max(8, ((visEnd - visStart) / 60) * HOUR_H);
  return { top, h };
}

function snapPlanMin(minutes) {
  const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, minutes));
  return Math.round(clamped / PLAN_SNAP) * PLAN_SNAP;
}

function minutesFromClientY(clientY) {
  const track = document.getElementById("track");
  if (!track) return START_HOUR * 60;
  const y = clientY - track.getBoundingClientRect().top;
  return snapPlanMin(START_HOUR * 60 + (y / HOUR_H) * 60);
}

function planDraftHtml() {
  const d = state.planDraft;
  if (!d) return "";
  const { top, h } = blockGeom(d.startMin, d.endMin);
  return `<div class="plan-draft${h < 44 ? " tight" : ""}" id="plan-draft" style="top:${top}px;height:${h}px">
    <div class="handle top" data-handle="start"></div>
    <div class="draft-body">
      <div class="when">${minutesToHm(d.startMin)}–${minutesToHm(d.endMin)}</div>
      <div class="draft-hint">${t("draftHint")}</div>
    </div>
    <button type="button" class="draft-x" data-draft-dismiss aria-label="取消">×</button>
    <div class="handle bottom" data-handle="end"></div>
  </div>`;
}

function draftClip() {
  return {
    lo: state.planDraft?.clipStart ?? gesture.clipStart ?? START_HOUR * 60,
    hi: state.planDraft?.clipEnd ?? gesture.clipEnd ?? END_HOUR * 60,
  };
}

function setDraftRange(startMin, endMin) {
  let a = snapPlanMin(startMin);
  let b = snapPlanMin(endMin);
  if (b < a) [a, b] = [b, a];
  const { lo, hi } = draftClip();
  a = Math.max(lo, Math.min(a, hi));
  b = Math.max(lo, Math.min(b, hi));
  if (b < a) [a, b] = [b, a];
  const minLen = Math.min(PLAN_MIN, Math.max(1, hi - lo));
  if (b - a < minLen) b = Math.min(hi, a + minLen);
  if (b - a < minLen) a = Math.max(lo, b - minLen);
  if (b - a < 1) return;
  state.planDraft = {
    id: state.planDraft?.id || uid(),
    isPlan: false,
    kinds: state.planDraft?.kinds || ["STUDY"],
    title: state.planDraft?.title || "",
    startMin: a,
    endMin: b,
    clipStart: lo,
    clipEnd: hi,
  };
}

function setDraftEdge(which, minutes) {
  const d = state.planDraft;
  if (!d) return;
  const t = snapPlanMin(minutes);
  const lo = d.clipStart ?? START_HOUR * 60;
  const hi = d.clipEnd ?? END_HOUR * 60;
  const minLen = Math.min(PLAN_MIN, Math.max(1, hi - lo));
  if (which === "start") {
    d.startMin = Math.max(lo, Math.min(t, d.endMin - minLen));
  } else {
    d.endMin = Math.min(hi, Math.max(t, d.startMin + minLen));
  }
}

function paintDraft() {
  const d = state.planDraft;
  const track = document.getElementById("track");
  if (!d || !track) return;
  let el = document.getElementById("plan-draft");
  if (!el) {
    track.insertAdjacentHTML("beforeend", planDraftHtml());
    el = document.getElementById("plan-draft");
  }
  const { top, h } = blockGeom(d.startMin, d.endMin);
  el.style.top = `${top}px`;
  el.style.height = `${h}px`;
  el.classList.toggle("tight", h < 44);
  const when = el.querySelector(".when");
  if (when) when.textContent = `${minutesToHm(d.startMin)}–${minutesToHm(d.endMin)}`;
}

function clearPlanDraft() {
  state.planDraft = null;
  document.getElementById("plan-draft")?.remove();
}

function openPlanFromDraft() {
  const d = state.planDraft;
  if (!d) return;
  openEditor({
    id: d.id,
    isPlan: false,
    kinds: [...(d.kinds || ["STUDY"])],
    kind: (d.kinds || ["STUDY"])[0],
    title: d.title || "",
    startMin: d.startMin,
    endMin: d.endMin,
  });
}

function armSuppressClick() {
  gesture.suppressClick = true;
  window.clearTimeout(gesture.suppressTimer);
  gesture.suppressTimer = window.setTimeout(() => {
    gesture.suppressClick = false;
  }, 500);
}

function bindWindowGesture() {
  if (gesture.windowBound) return;
  gesture.windowBound = true;
  window.addEventListener("pointermove", onTimelinePointerMove);
  window.addEventListener("pointerup", onTimelinePointerUp);
  window.addEventListener("pointercancel", onTimelinePointerUp);
}

function unbindWindowGesture() {
  if (!gesture.windowBound) return;
  gesture.windowBound = false;
  window.removeEventListener("pointermove", onTimelinePointerMove);
  window.removeEventListener("pointerup", onTimelinePointerUp);
  window.removeEventListener("pointercancel", onTimelinePointerUp);
}

function resetGesture() {
  if (gesture.timer) {
    clearTimeout(gesture.timer);
    gesture.timer = 0;
  }
  gesture.kind = null;
  gesture.pointerId = null;
  unbindWindowGesture();
  const timeline = document.getElementById("timeline");
  timeline?.classList.remove("drawing");
}

function liveBlockLabel(block) {
  if (block.title) return block.title;
  const labels = blockKinds(block).map((id) => kindLabel(id));
  if (labels.length === 1) return labels[0];
  return labels.join(" / ");
}

function luminance(hex) {
  const n = (hex || "#888888").replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function achieveHtml(r) {
  const L = lang();
  const book = r.books?.[state.book] || r.books?.all;
  if (!book) return `<p class="muted">${t("evalEmpty")}</p>`;
  const snap = bookAt(book, state.date);
  const isToday = state.date === todayISO();
  const investLabel = isToday ? t("todayInvest") : t("thatDayInvest");
  const chips = [
    ...ASSET_BOOKS.map((item) => {
      const on = item.id === book.id ? "on" : "";
      return `<button type="button" class="book-chip ${on}" data-act="book" data-book="${item.id}">${bookLabel(item.id)}</button>`;
    }),
    ...listCustomBooks().map((item) => {
      const on = item.id === book.id ? "on" : "";
      return `<button type="button" class="book-chip ${on}" data-act="book" data-book="${escapeAttr(item.id)}">${escapeAttr(item.label)}</button>`;
    }),
    `<button type="button" class="book-chip add" data-act="add-book">${t("customKind")}</button>`,
  ].join("");
  const evalKey = {
    empty: "evalEmpty",
    waste: "evalWaste",
    weekend: "evalWeekend",
    rising: "evalRising",
    slow: "evalSlow",
    flat: "evalFlat",
  }[bookEval(book, r)] || "evalFlat";
  const valueKey = book.id === "all" ? "totalValuation" : "valuation";
  const price = formatPrice(snap.price);
  const hero = isToday
    ? `<button type="button" class="muted asset-kicker gloss-hit" data-act="gloss" data-gloss="principal">${t("principal")}</button>
    <button type="button" class="asset-num gloss-hit" data-act="gloss" data-gloss="principal">${formatRemain(r.remainingMin, L)}</button>`
    : `<button type="button" class="muted asset-kicker gloss-hit" data-act="gloss" data-gloss="todayInvest">${investLabel}</button>
    <button type="button" class="asset-num gloss-hit" data-act="gloss" data-gloss="todayInvest">${formatHours(snap.dayH, L)}</button>`;
  const investTicker = `<button type="button" class="ticker gloss-hit" data-act="gloss" data-gloss="todayInvest">
        <div class="lab">${investLabel}</div>
        <div class="val">${formatHours(snap.dayH, L)}</div>
      </button>`;
  return `
    ${hero}
    <div class="tickers${isToday ? "" : " pair"}">
      ${isToday ? investTicker : ""}
      <button type="button" class="ticker gloss-hit" data-act="gloss" data-gloss="totalInvest">
        <div class="lab">${t("totalInvest")}</div>
        <div class="val">${formatHours(snap.totalH, L)}</div>
      </button>
      <button type="button" class="ticker gloss-hit" data-act="gloss" data-gloss="${valueKey}">
        <div class="lab">${t(valueKey)}</div>
        <div class="val">${formatMoney(snap.value)}</div>
        <div class="ratio-tag">${price}</div>
      </button>
    </div>
    <div class="book-row">${chips}</div>
    ${assetChartHtml(book, r, L, state.date)}
    <p class="eval-line">${t(evalKey, { price })}</p>
    <button class="ghost settings-link" data-act="settings">${t("settings")}</button>
  `;
}

function bindApp() {
  document.querySelectorAll("[data-act]").forEach((el) => {
    el.addEventListener("click", onAction);
  });
  bindTimeline(document.getElementById("timeline"));
  bindDaySwipe(document.getElementById("day-stage"));
}

function bindTimeline(timeline) {
  if (!timeline) return;

  timeline.addEventListener("click", (event) => {
    if (gesture.suppressClick) {
      gesture.suppressClick = false;
      event.preventDefault();
      return;
    }
    if (event.target.closest("[data-draft-dismiss]") || event.target.closest("[data-handle]")) return;
    if (event.target.closest("#plan-draft")) {
      openPlanFromDraft();
      return;
    }
    const block = event.target.closest("[data-id]");
    if (block) {
      const found = state.day.blocks.find((b) => b.id === block.dataset.id);
      if (found && !found.isPlan) openEditor(found);
    }
  });

  timeline.addEventListener("pointerdown", onTimelinePointerDown);
  timeline.addEventListener("pointermove", onTimelinePointerMove);
  timeline.addEventListener("pointerup", onTimelinePointerUp);
  timeline.addEventListener("pointercancel", onTimelinePointerUp);
  timeline.addEventListener("contextmenu", (event) => event.preventDefault());
  timeline.addEventListener("touchmove", (event) => {
    if (gesture.kind === "stretch" || gesture.kind === "resize-start" || gesture.kind === "resize-end") {
      event.preventDefault();
    }
  }, { passive: false });
}

function onTimelinePointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const timeline = event.currentTarget;
  if (event.target.closest("[data-draft-dismiss]")) {
    event.preventDefault();
    armSuppressClick();
    clearPlanDraft();
    return;
  }
  const handle = event.target.closest("[data-handle]");
  if (handle && state.planDraft) {
    event.preventDefault();
    gesture.kind = handle.dataset.handle === "start" ? "resize-start" : "resize-end";
    gesture.pointerId = event.pointerId;
    armSuppressClick();
    timeline.classList.add("drawing");
    bindWindowGesture();
    timeline.setPointerCapture(event.pointerId);
    return;
  }
  if (event.target.closest("#plan-draft") || event.target.closest("[data-id]")) return;

  gesture.pointerId = event.pointerId;
  gesture.originMin = minutesFromClientY(event.clientY);
  gesture.startX = event.clientX;
  gesture.startY = event.clientY;
  gesture.lastY = event.clientY;
  gesture.kind = "press";
  gesture.timer = window.setTimeout(() => {
    gesture.timer = 0;
    if (gesture.kind !== "press" || gesture.pointerId !== event.pointerId) return;
    gesture.kind = "stretch";
    armSuppressClick();
    const hit = actualAtMinute(state.day.blocks, gesture.originMin);
    if (hit) {
      resetGesture();
      openEditor(hit);
      return;
    }
    const span = emptySpan(
      state.day.blocks,
      gesture.originMin,
      state.planDraft?.id,
      START_HOUR * 60,
      END_HOUR * 60,
    );
    if (!span || span.endMin - span.startMin < 1) {
      resetGesture();
      return;
    }
    gesture.clipStart = span.startMin;
    gesture.clipEnd = span.endMin;
    timeline.classList.add("drawing");
    bindWindowGesture();
    try {
      timeline.setPointerCapture(event.pointerId);
    } catch {
      /* Safari may ignore capture before move */
    }
    const nowMin = minutesFromClientY(gesture.lastY);
    setDraftRange(gesture.originMin, nowMin === gesture.originMin ? gesture.originMin + PLAN_MIN : nowMin);
    paintDraft();
    navigator.vibrate?.(12);
  }, LONG_PRESS_MS);
}

function onTimelinePointerMove(event) {
  if (gesture.pointerId != null && event.pointerId !== gesture.pointerId) return;
  gesture.lastY = event.clientY;
  if (gesture.kind === "press") {
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.hypot(dx, dy) > PRESS_MOVE_PX) resetGesture();
    return;
  }
  if (gesture.kind === "stretch") {
    setDraftRange(gesture.originMin, minutesFromClientY(event.clientY));
    paintDraft();
    return;
  }
  if (gesture.kind === "resize-start" && state.planDraft) {
    setDraftEdge("start", minutesFromClientY(event.clientY));
    paintDraft();
    return;
  }
  if (gesture.kind === "resize-end" && state.planDraft) {
    setDraftEdge("end", minutesFromClientY(event.clientY));
    paintDraft();
  }
}

function onTimelinePointerUp(event) {
  if (gesture.pointerId != null && event.pointerId !== gesture.pointerId) return;
  if (gesture.kind === "press") {
    resetGesture();
    return;
  }
  if (gesture.kind === "stretch" || gesture.kind === "resize-start" || gesture.kind === "resize-end") {
    armSuppressClick();
    paintDraft();
    resetGesture();
  }
}

function onAction(event) {
  const act = event.currentTarget.dataset.act;
  if (act === "prev") {
    goDate(addDays(state.date, -1), "right");
  } else if (act === "next") {
    goDate(addDays(state.date, 1), "left");
  } else if (act === "today") {
    const dir = state.date < todayISO() ? "left" : "right";
    goDate(todayISO(), dir);
  } else if (act === "log-now") {
    currentDay();
    let range = gapFromLastToNow(state.day);
    if (range.endMin <= range.startMin) {
      range = {
        startMin: Math.max(START_HOUR * 60, range.endMin - 1),
        endMin: Math.max(range.endMin, START_HOUR * 60 + 1),
      };
    }
    openRecordSheet(range);
  } else if (act === "tab-time") {
    state.tab = "time";
    render();
  } else if (act === "tab-achieve") {
    state.tab = "achieve";
    render();
  } else if (act === "book") {
    const id = event.currentTarget.dataset.book || "all";
    const userBook = listCustomBooks().some((b) => b.id === id);
    if (userBook && state.book === id) {
      openCustomBookSheet(id);
      return;
    }
    state.book = id;
    render();
  } else if (act === "add-book") {
    openCustomBookSheet();
  } else if (act === "gloss") {
    openGloss(event.currentTarget.dataset.gloss || "principal");
  } else if (act === "settings") {
    openSettingsSheet();
  } else if (act === "export") {
    download("rihou-backup.json", exportAll());
  } else if (act === "import") {
    pickFile((text) => {
      importAll(text);
      render();
    });
  }
}

function goDate(iso, dir) {
  if (iso === state.date) return;
  state.date = iso;
  state.slide = dir || "";
  clearPlanDraft();
  render();
}

function sheetOpen() {
  return document.getElementById("sheet-bg")?.classList.contains("show");
}

function resetDaySwipe(stage) {
  daySwipe.pointerId = null;
  daySwipe.axis = null;
  daySwipe.dx = 0;
  if (stage) {
    stage.style.transform = "";
    stage.style.transition = "";
  }
}

function bindDaySwipe(stage) {
  if (!stage) return;
  stage.addEventListener("pointerdown", onDaySwipeDown);
  stage.addEventListener("pointermove", onDaySwipeMove);
  stage.addEventListener("pointerup", onDaySwipeUp);
  stage.addEventListener("pointercancel", onDaySwipeUp);
}

function onDaySwipeDown(event) {
  if (sheetOpen()) return;
  if (event.button && event.button !== 0) return;
  if (event.target.closest("button, input, textarea, .book-row, .sheet")) return;
  daySwipe.pointerId = event.pointerId;
  daySwipe.startX = event.clientX;
  daySwipe.startY = event.clientY;
  daySwipe.dx = 0;
  daySwipe.axis = null;
}

function onDaySwipeMove(event) {
  if (daySwipe.pointerId !== event.pointerId) return;
  if (gesture.kind === "stretch" || gesture.kind === "resize-start" || gesture.kind === "resize-end") {
    resetDaySwipe(document.getElementById("day-stage"));
    return;
  }
  const dx = event.clientX - daySwipe.startX;
  const dy = event.clientY - daySwipe.startY;
  if (!daySwipe.axis) {
    if (Math.hypot(dx, dy) < DAY_AXIS_PX) return;
    daySwipe.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
  }
  if (daySwipe.axis !== "x") return;
  event.preventDefault();
  resetGesture();
  daySwipe.dx = dx;
  const stage = document.getElementById("day-stage");
  if (stage) {
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    stage.style.transition = "none";
    stage.style.transform = `translateX(${dx}px)`;
  }
}

function onDaySwipeUp(event) {
  if (daySwipe.pointerId !== event.pointerId) return;
  const stage = document.getElementById("day-stage");
  const dx = daySwipe.dx;
  const axis = daySwipe.axis;
  resetDaySwipe(stage);
  if (axis !== "x" || Math.abs(dx) < DAY_SWIPE_PX) {
    if (stage) {
      stage.style.transition = "transform 0.22s ease";
      stage.style.transform = "";
    }
    return;
  }
  goDate(addDays(state.date, dx < 0 ? 1 : -1), dx < 0 ? "left" : "right");
}

function scrollToNow() {
  if (state.planDraft) return;
  const timeline = document.getElementById("timeline");
  if (!timeline) return;
  if (state.date === todayISO()) {
    const last = lastActualEnd(state.day);
    const focus = last == null ? nowMinutes() : last;
    const hour = Math.max(START_HOUR, Math.floor(focus / 60) - 1);
    timeline.scrollTop = (hour - START_HOUR) * HOUR_H;
    return;
  }
  const first = (state.day.blocks || [])
    .filter((b) => !b.isPlan)
    .sort((a, b) => a.startMin - b.startMin)[0];
  const focus = first ? first.startMin : 8 * 60;
  timeline.scrollTop = Math.max(0, (focus / 60 - START_HOUR - 1) * HOUR_H);
}


function kindRowHtml(draft) {
  const chips = pickerKinds(draft.kinds).map((k) => {
    const on = draft.kinds.includes(k.id) ? "on" : "";
    const del = k.custom
      ? `<span class="chip-x" data-del-kind="${escapeAttr(k.id)}">×</span>`
      : "";
    const swatch = k.custom
      ? `<span class="chip-dot" style="background:${escapeAttr(k.color)}"></span>`
      : "";
    return `<button type="button" class="chip-h ${on}" data-kind="${escapeAttr(k.id)}">${swatch}${escapeAttr(kindLabel(k.id))}${del}</button>`;
  }).join("");
  return `${chips}<button type="button" class="chip-h add" data-add-custom>${t("customKind")}</button>`;
}

function bindKindRow(root, draft, refresh, keepOne, reopen) {
  const row = root.querySelector("#kind-row");
  if (!row) return;
  row.querySelectorAll("[data-kind]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (event.target.closest("[data-del-kind]")) return;
      const id = el.dataset.kind;
      if (draft.kinds.includes(id)) {
        draft.kinds = draft.kinds.filter((k) => k !== id);
        if (keepOne && draft.kinds.length === 0) draft.kinds = [id];
      } else {
        draft.kinds = [...draft.kinds, id];
      }
      refresh();
    });
  });
  row.querySelectorAll("[data-del-kind]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = el.dataset.delKind;
      saveCustomKinds(listCustomKinds().filter((c) => c.id !== id));
      draft.kinds = draft.kinds.filter((k) => k !== id);
      refresh();
    });
  });
  row.querySelector("[data-add-custom]")?.addEventListener("click", () => {
    const titleEl = root.querySelector("#title");
    if (titleEl) draft.title = titleEl.value;
    openCustomKindSheet({
      onDismiss: reopen || refresh,
      onCreated(id) {
        if (!draft.kinds.includes(id)) draft.kinds.push(id);
      },
    });
  });
}

function customKindHtml(form) {
  const colors = KIND_COLORS.map((color) => {
    const on = color === form.color ? "on" : "";
    return `<button type="button" class="color-dot ${on}" data-color="${escapeAttr(color)}" style="background:${escapeAttr(color)}"></button>`;
  }).join("");
  const books = listValuationBooks().map((item) => {
    const on = item.id === form.book ? "on" : "";
    const label = item.core ? t(`book.${item.id}`) : item.label;
    return `<button type="button" class="chip-h ${on}" data-val-book="${escapeAttr(item.id)}">${escapeAttr(label)}</button>`;
  }).join("");
  return `
    <div class="mini-card">
      <h2>${t("customKind")}</h2>
      <p class="muted">${t("customName")}</p>
      <input class="field" id="custom-name" maxlength="${CUSTOM_LABEL_MAX}" placeholder="${escapeAttr(t("customName"))}" value="${escapeAttr(form.name)}" />
      <p class="muted">${t("customColor")}</p>
      <div class="row" id="custom-colors">${colors}</div>
      <p class="muted">${t("customBook")}</p>
      <div class="row" id="custom-books">${books}</div>
      <div class="mini-actions">
        <button type="button" class="ghost" data-custom-cancel>${t("cancel")}</button>
        <button type="button" class="primary" data-custom-ok>${t("customOk")}</button>
      </div>
    </div>
  `;
}

function openCustomKindSheet({ onDismiss, onCreated }) {
  const form = { name: "", color: KIND_COLORS[0], book: "mind" };
  const bind = (root) => {
    const nameEl = root.querySelector("#custom-name");
    nameEl?.focus();
    root.querySelectorAll("[data-color]").forEach((el) => {
      el.addEventListener("click", () => {
        form.color = el.dataset.color;
        root.querySelectorAll("[data-color]").forEach((x) => {
          x.classList.toggle("on", x.dataset.color === form.color);
        });
      });
    });
    root.querySelectorAll("[data-val-book]").forEach((el) => {
      el.addEventListener("click", () => {
        form.book = el.dataset.valBook;
        root.querySelectorAll("[data-val-book]").forEach((x) => {
          x.classList.toggle("on", x.dataset.valBook === form.book);
        });
      });
    });
    root.querySelector("[data-custom-cancel]")?.addEventListener("click", onDismiss);
    root.querySelector("[data-custom-ok]")?.addEventListener("click", () => {
      const name = (nameEl?.value || "").trim().slice(0, CUSTOM_LABEL_MAX);
      if (!name) {
        nameEl?.focus();
        return;
      }
      const builtin = KINDS.filter((k) => !k.hidden).find((k) => kindLabel(k.id) === name || k.label === name);
      if (builtin) {
        onCreated?.(builtin.id);
        onDismiss();
        return;
      }
      const hit = listCustomKinds().find((c) => c.label === name);
      if (hit) {
        onCreated?.(hit.id);
        onDismiss();
        return;
      }
      const ok = root.querySelector("[data-custom-ok]");
      if (listCustomKinds().length >= CUSTOM_MAX) {
        if (ok) ok.textContent = t("customFull");
        return;
      }
      const id = `CUS_${uid().replace(/-/g, "").slice(0, 10)}`;
      saveCustomKinds([...listCustomKinds(), {
        id,
        label: name,
        color: form.color,
        book: form.book,
      }]);
      onCreated?.(id);
      onDismiss();
    });
  };
  showSheet(customKindHtml(form), bind, { mini: true, onDismiss });
}

function customBookHtml(form, picked, locked) {
  const chips = customBookCandidates(form.id).map((k) => {
    const isLocked = locked.has(k.id);
    const on = isLocked || picked.has(k.id) ? "on" : "";
    const swatch = `<span class="chip-dot" style="background:${escapeAttr(k.color)}"></span>`;
    return `<button type="button" class="chip-h ${on}" data-pick="${escapeAttr(k.id)}" ${isLocked ? "data-locked" : ""}>${swatch}${escapeAttr(kindLabel(k.id))}</button>`;
  }).join("");
  return `
    <div class="mini-card">
      <h2>${form.id ? escapeAttr(form.name || t("customKind")) : t("customKind")}</h2>
      <p class="muted">${t("customBookName")}</p>
      <input class="field" id="book-name" maxlength="${CUSTOM_LABEL_MAX}" placeholder="${escapeAttr(t("customBookName"))}" value="${escapeAttr(form.name)}" />
      <p class="muted">${t("customPick")}</p>
      <div class="row" id="custom-book-picks">${chips}</div>
      <div class="mini-actions">
        <button type="button" class="ghost" data-custom-cancel>${t("cancel")}</button>
        <button type="button" class="primary" data-custom-ok>${t("customOk")}</button>
      </div>
      ${form.id ? `<button type="button" class="danger" data-custom-delete>${t("customBookDelete")}</button>` : ""}
    </div>
  `;
}

function openCustomBookSheet(editId) {
  const existing = editId ? listCustomBooks().find((b) => b.id === editId) : null;
  const form = { id: existing?.id || "", name: existing?.label || "" };
  const picked = new Set(existing?.kinds || []);
  const locked = new Set(listCustomKinds().filter((c) => c.book === form.id).map((c) => c.id));
  const bind = (root) => {
    const nameEl = root.querySelector("#book-name");
    nameEl?.focus();
    root.querySelectorAll("[data-pick]").forEach((el) => {
      el.addEventListener("click", () => {
        if (el.hasAttribute("data-locked")) return;
        const id = el.dataset.pick;
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
        el.classList.toggle("on", picked.has(id));
      });
    });
    root.querySelector("[data-custom-cancel]")?.addEventListener("click", closeSheet);
    root.querySelector("[data-custom-ok]")?.addEventListener("click", () => {
      const name = (nameEl?.value || "").trim().slice(0, CUSTOM_LABEL_MAX);
      if (!name) {
        nameEl?.focus();
        return;
      }
      const reserved = new Set(["总览", "学识", "健康", "创作", "自定义", "All", "Mind", "Health", "Craft", "Custom"]);
      if (reserved.has(name) || listCustomBooks().some((b) => b.label === name && b.id !== form.id)) {
        nameEl.focus();
        return;
      }
      const ok = root.querySelector("[data-custom-ok]");
      if (!form.id && listCustomBooks().length >= CUSTOM_BOOK_MAX) {
        if (ok) ok.textContent = t("customBookFull");
        return;
      }
      const kinds = [...picked];
      if (form.id) {
        saveCustomBooks(listCustomBooks().map((b) => (b.id === form.id ? { ...b, label: name, kinds } : b)));
        state.book = form.id;
      } else {
        const id = `CBK_${uid().replace(/-/g, "").slice(0, 10)}`;
        saveCustomBooks([...listCustomBooks(), { id, label: name, kinds }]);
        state.book = id;
      }
      closeSheet();
      render();
    });
    root.querySelector("[data-custom-delete]")?.addEventListener("click", () => {
      saveCustomBooks(listCustomBooks().filter((b) => b.id !== form.id));
      if (state.book === form.id) state.book = "all";
      closeSheet();
      render();
    });
  };
  showSheet(customBookHtml(form, picked, locked), bind, { mini: true });
}

function openRecordSheet(range, extra = {}) {
  const draft = {
    id: extra.id || uid(),
    isPlan: false,
    kinds: extra.kinds ? [...extra.kinds] : [],
    title: extra.title || "",
    startMin: range.startMin,
    endMin: Math.max(range.startMin + 1, range.endMin),
  };
  if (draft.endMin <= draft.startMin) draft.endMin = draft.startMin + 1;
  showSheet(recordHtml(draft), (root) => bindRecord(root, draft));
}

function recordHtml(draft) {
  const preview = draft.kinds.length
    ? `<div class="mix-preview" id="mix-box" style="background:${gradientCss(draft.kinds.map((id) => kindById(id).color))}"></div>
       <p class="muted" id="mix-hint">${draft.kinds.length === 1 ? t("mixOne") : t("mixMany")}</p>`
    : `<div class="mix-preview" id="mix-box" style="display:none"></div><p class="muted" id="mix-hint">${t("mixEmpty")}</p>`;

  return `
    <div class="sheet">
      <h2>${lastActualEnd(state.day) == null ? t("logTitle") : t("sinceLast")}</h2>
      <p class="muted">${t("logHint")}</p>
      ${timeFields(draft)}
      <div class="row" id="kind-row">${kindRowHtml(draft)}</div>
      ${preview}
      <input class="field" id="title" placeholder="${escapeAttr(t("note"))}" value="${escapeAttr(draft.title)}" />
      <button class="primary" data-save>${t("save")}</button>
      <button class="ghost" data-close>${t("cancel")}</button>
    </div>
  `;
}

function timeFields(draft) {
  return `
    <div class="time-field">
      <span>${t("start")}</span>
      <div class="time-controls">
        <button class="btn" data-nudge="start,-5">−5</button>
        <button class="btn" data-nudge="start,-1">−1</button>
        <input type="time" id="start-time" value="${hmInputValue(draft.startMin)}" />
        <button class="btn" data-nudge="start,1">+1</button>
        <button class="btn" data-nudge="start,5">+5</button>
      </div>
    </div>
    <div class="time-field">
      <span>${t("end")}</span>
      <div class="time-controls">
        <button class="btn" data-nudge="end,-5">−5</button>
        <button class="btn" data-nudge="end,-1">−1</button>
        <input type="time" id="end-time" value="${hmInputValue(draft.endMin)}" />
        <button class="btn" data-nudge="end,1">+1</button>
        <button class="btn" data-nudge="end,5">+5</button>
        <button class="btn" data-now>${t("now")}</button>
      </div>
    </div>
    <p class="muted" id="span-lab">${minutesToHm(draft.startMin)}–${minutesToHm(draft.endMin)} · ${formatDurationI18n(draft.endMin - draft.startMin)}</p>
  `;
}

function bindTimeFields(root, draft, onChange) {
  const sync = () => {
    root.querySelector("#start-time").value = hmInputValue(draft.startMin);
    root.querySelector("#end-time").value = hmInputValue(draft.endMin);
    const lab = root.querySelector("#span-lab");
    if (lab) {
      lab.textContent = `${minutesToHm(draft.startMin)}–${minutesToHm(draft.endMin)} · ${formatDurationI18n(Math.max(0, draft.endMin - draft.startMin))}`;
    }
    onChange?.();
  };
  root.querySelector("#start-time").addEventListener("change", (e) => {
    draft.startMin = parseHm(e.target.value);
    if (draft.endMin <= draft.startMin) draft.endMin = Math.min(24 * 60, draft.startMin + 1);
    sync();
  });
  root.querySelector("#end-time").addEventListener("change", (e) => {
    draft.endMin = parseHm(e.target.value);
    if (draft.endMin <= draft.startMin) draft.endMin = Math.min(24 * 60, draft.startMin + 1);
    sync();
  });
  root.querySelectorAll("[data-nudge]").forEach((el) => {
    el.addEventListener("click", () => {
      const [which, delta] = el.dataset.nudge.split(",");
      const key = which === "start" ? "startMin" : "endMin";
      draft[key] = Math.max(0, Math.min(24 * 60, draft[key] + Number(delta)));
      if (draft.endMin <= draft.startMin) draft.endMin = Math.min(24 * 60, draft.startMin + 1);
      sync();
    });
  });
  root.querySelector("[data-now]")?.addEventListener("click", () => {
    draft.endMin = nowMinutes();
    if (draft.endMin <= draft.startMin) draft.endMin = Math.min(24 * 60, draft.startMin + 1);
    sync();
  });
}

function bindRecord(root, draft) {
  bindTimeFields(root, draft);

  const updateMix = () => {
    const box = root.querySelector("#mix-box");
    const hint = root.querySelector("#mix-hint");
    if (!box || !hint) return;
    if (draft.kinds.length === 0) {
      box.style.display = "none";
      hint.textContent = t("mixEmpty");
      return;
    }
    box.style.display = "block";
    box.style.background = gradientCss(draft.kinds.map((id) => kindById(id).color));
    hint.textContent = draft.kinds.length === 1 ? t("mixOne") : t("mixMany");
  };

  const reopen = () => showSheet(recordHtml(draft), (r) => bindRecord(r, draft));
  const refreshKinds = () => {
    const row = root.querySelector("#kind-row");
    if (row) row.innerHTML = kindRowHtml(draft);
    bindKindRow(root, draft, refreshKinds, false, reopen);
    updateMix();
  };
  bindKindRow(root, draft, refreshKinds, false, reopen);


  root.querySelector("[data-save]").addEventListener("click", () => {
    if (draft.kinds.length === 0) {
      root.querySelector("[data-save]").textContent = t("pickOne");
      return;
    }
    draft.title = root.querySelector("#title").value.trim();
    if (draft.endMin <= draft.startMin) draft.endMin = draft.startMin + 1;
    state.day = upsertBlock(state.day, {
      id: draft.id,
      startMin: draft.startMin,
      endMin: draft.endMin,
      title: draft.title,
      kinds: draft.kinds,
      kind: draft.kinds[0],
      isPlan: false,
    });
    markOffered(`${todayISO()}-${draft.startMin}`);
    closeSheet();
    render();
  });
  root.querySelector("[data-close]").addEventListener("click", closeSheet);
}

function openEditor(block) {
  const draft = {
    id: block.id,
    isPlan: Boolean(block.isPlan),
    kinds: [...blockKinds(block)],
    title: block.title || "",
    startMin: block.startMin,
    endMin: block.endMin,
  };
  const isEdit = state.day.blocks.some((b) => b.id === block.id);
  showSheet(editorHtml(draft, isEdit), (root) => bindEditor(root, draft, isEdit));
}

function editorHtml(draft, isEdit) {
  const mixHint = draft.kinds.length > 1
    ? `<div class="mix-preview" style="background:${gradientCss(draft.kinds.map((id) => kindById(id).color))}"></div>
       <p class="muted">${t("mixEdit")}</p>`
    : "";
  return `
    <div class="sheet">
      <h2>${isEdit ? t("editBlock") : t("logRange")}</h2>
      <div class="row" id="kind-row">${kindRowHtml(draft)}</div>
      ${mixHint}
      <input class="field" id="title" placeholder="${escapeAttr(t("note"))}" value="${escapeAttr(draft.title)}" />
      ${timeFields(draft)}
      <button class="primary" data-save>${t("save")}</button>
      ${isEdit ? `<button class="danger" data-delete>${t("deleteBlock")}</button>` : ""}
      <button class="ghost" data-close>${t("cancel")}</button>
    </div>
  `;
}

function bindEditor(root, draft, isEdit) {
  const redraw = () => {
    const html = editorHtml(draft, isEdit);
    const inner = root.querySelector(".sheet");
    const next = document.createElement("div");
    next.innerHTML = html;
    inner.replaceWith(next.firstElementChild);
    bindEditor(root, draft, isEdit);
  };

  bindTimeFields(root, draft);
  bindKindRow(root, draft, redraw, true, () => {
    showSheet(editorHtml(draft, isEdit), (r) => bindEditor(r, draft, isEdit));
  });
  root.querySelector("[data-save]").addEventListener("click", () => {
    draft.title = root.querySelector("#title").value.trim();
    if (draft.kinds.length === 0) draft.kinds = ["OTHER"];
    if (draft.endMin <= draft.startMin) draft.endMin = draft.startMin + 1;
    state.day = upsertBlock(state.day, {
      id: draft.id,
      startMin: draft.startMin,
      endMin: draft.endMin,
      title: draft.title,
      kinds: draft.kinds,
      kind: draft.kinds[0],
      isPlan: false,
    });
    if (state.planDraft?.id === draft.id) state.planDraft = null;
    closeSheet();
    render();
  });
  const del = root.querySelector("[data-delete]");
  if (del) {
    del.addEventListener("click", () => {
      state.day = removeBlock(state.day, draft.id);
      if (state.planDraft?.id === draft.id) state.planDraft = null;
      closeSheet();
      render();
    });
  }
  root.querySelector("[data-close]").addEventListener("click", closeSheet);
}

function openSettingsSheet() {
  const settings = loadSettings();
  const current = lang();
  showSheet(`
    <div class="sheet">
      <h2>${t("settings")}</h2>
      <div class="section">${t("language")}</div>
      <div class="row">
        <button type="button" class="chip-h ${current === "zh" ? "on" : ""}" data-lang="zh">${t("langZh")}</button>
        <button type="button" class="chip-h ${current === "en" ? "on" : ""}" data-lang="en">${t("langEn")}</button>
      </div>
      <div class="switch-row">
        <div>
          <div>${t("prompt")}</div>
          <p class="muted" style="margin:4px 0 0">${t("promptHint")}</p>
        </div>
        <input type="checkbox" id="prompt-toggle" ${settings.promptEnabled ? "checked" : ""} />
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn" data-act="export">${t("export")}</button>
        <button class="btn" data-act="import">${t("import")}</button>
      </div>
      <button class="ghost" data-close>${t("close")}</button>
    </div>
  `, (root) => {
    root.querySelectorAll("[data-lang]").forEach((el) => {
      el.addEventListener("click", () => {
        saveSettings({ ...loadSettings(), lang: el.dataset.lang });
        closeSheet();
        render();
      });
    });
    const toggle = root.querySelector("#prompt-toggle");
    if (toggle) {
      toggle.addEventListener("change", async () => {
        saveSettings({ ...loadSettings(), promptEnabled: toggle.checked });
        if (toggle.checked) await requestNotify();
      });
    }
    root.querySelectorAll("[data-act]").forEach((el) => {
      el.addEventListener("click", onAction);
    });
    root.querySelector("[data-close]").addEventListener("click", closeSheet);
  });
}

function openGloss(key) {
  const allowed = ["principal", "todayInvest", "totalInvest", "valuation", "totalValuation", "price"];
  const gloss = allowed.includes(key) ? key : "principal";
  const bg = document.getElementById("sheet-bg");
  bg.className = "sheet-bg show gloss";
  bg.innerHTML = `
    <div class="gloss-card">
      <h2>${t(gloss === "price" ? "price" : gloss)}</h2>
      <p>${t(`gloss.${gloss}`)}</p>
      <button type="button" class="ghost" data-close>${t("close")}</button>
    </div>
  `;
  bg.onclick = (event) => {
    if (event.target === bg) closeSheet();
  };
  bg.querySelector("[data-close]").addEventListener("click", closeSheet);
}

function showSheet(html, bind, opts = {}) {
  const bg = document.getElementById("sheet-bg");
  bg.className = opts.mini ? "sheet-bg show mini" : "sheet-bg show";
  bg.innerHTML = html;
  bg.onclick = (event) => {
    if (event.target === bg) {
      if (typeof opts.onDismiss === "function") opts.onDismiss();
      else closeSheet();
    }
  };
  bind(bg);
}

function closeSheet() {
  const bg = document.getElementById("sheet-bg");
  bg.className = "sheet-bg";
  bg.innerHTML = "";
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function download(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function pickFile(onText) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    file.text().then(onText);
  };
  input.click();
}

async function requestNotify() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") await Notification.requestPermission();
}

function offerStamp(startMin) {
  return `${todayISO()}-${startMin}`;
}

let offeredThisSession = false;

function maybeOfferHour(fromTick = false) {
  const settings = loadSettings();
  if (!settings.promptEnabled) return;
  const now = new Date();
  const hour = now.getHours();
  if (hour < 7 || hour > 23) return;
  if (state.date !== todayISO()) state.date = todayISO();
  currentDay();
  const gap = gapFromLastToNow(state.day, now);
  if (gap.endMin - gap.startMin < 1) return;
  const stamp = offerStamp(gap.startMin);
  if (!fromTick && (offeredThisSession || alreadyOffered(stamp))) return;
  offeredThisSession = true;
  if (Notification.permission === "granted") {
    new Notification(t("notifyTitle"), {
      body: t("notifyBody", { start: minutesToHm(gap.startMin), end: minutesToHm(gap.endMin) }),
    });
  }
  openRecordSheet(gap);
}

let lastHour = new Date().getHours();
function tickHour() {
  const hour = new Date().getHours();
  if (hour !== lastHour) {
    lastHour = hour;
    offeredThisSession = false;
    maybeOfferHour(true);
  }
}

function pinFrame() {
  const app = document.getElementById("app");
  if (!app) return;
  if (window.matchMedia("(min-width: 900px)").matches) {
    app.style.top = "";
    app.style.height = "";
    return;
  }
  const vv = window.visualViewport;
  const height = Math.max(
    window.innerHeight,
    document.documentElement.clientHeight,
    vv ? Math.round(vv.height + vv.offsetTop) : 0,
  );
  app.style.top = "0px";
  app.style.height = `${height}px`;
}

window.addEventListener("resize", () => {
  pinFrame();
  render();
});
window.visualViewport?.addEventListener("resize", pinFrame);
window.visualViewport?.addEventListener("scroll", pinFrame);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    pinFrame();
    render();
    maybeOfferHour();
  }
});
window.addEventListener("pageshow", () => {
  pinFrame();
  render();
});

render();
pinFrame();
requestAnimationFrame(() => {
  pinFrame();
  render();
  pinFrame();
});
maybeOfferHour();
setInterval(tickHour, 15000);
requestNotify();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js?v=45").catch(() => {});
}
