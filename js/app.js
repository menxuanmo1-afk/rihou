import {
  KINDS,
  uid,
  kindById,
  minutesToHm,
  parseHm,
  hmInputValue,
  formatDuration,
  todayISO,
  addDays,
  dateTitle,
  blockKinds,
  blockLabel,
  blockColors,
  gradientCss,
  gapFromLastToNow,
  lastActualEnd,
  nowMinutes,
} from "./models.js";
import {
  loadDay,
  upsertBlock,
  removeBlock,
  toggleHabit,
  loadSettings,
  saveSettings,
  loadHabits,
  saveHabits,
  exportAll,
  importAll,
  alreadyOffered,
  markOffered,
} from "./store.js";
import { analyze, weekStats } from "./analysis.js";

const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_H = 56;

const state = {
  date: todayISO(),
  day: loadDay(todayISO()),
  tab: "time",
};

function currentDay() {
  state.day = loadDay(state.date);
  return state.day;
}

function report() {
  return analyze(state.day, 0, new Date(), state.date === todayISO());
}

function render() {
  currentDay();
  const app = document.getElementById("app");
  const isToday = state.date === todayISO();
  const r = report();
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const showTime = wide || state.tab === "time";
  const showAchieve = wide || state.tab === "achieve";
  const gap = isToday ? gapFromLastToNow(state.day) : null;
  const canLogNow = Boolean(gap && gap.endMin > gap.startMin);

  app.innerHTML = `
    <header class="top">
      <div class="date-nav">
        <button class="btn" data-act="prev">‹</button>
        <div>
          <h1>${dateTitle(state.date)}</h1>
          <div class="sub">${isToday ? "厉害" : "这一天"} ${r.awesomeIndex}</div>
        </div>
        <button class="btn" data-act="next">›</button>
      </div>
      <div class="top-actions">
        ${isToday ? "" : `<button class="btn" data-act="today">今天</button>`}
        <button class="btn" data-act="plan">＋计划</button>
      </div>
    </header>
    <div class="main">
      <section class="panel timeline-wrap ${showTime ? "" : "hidden"}">
        <div class="hint">记录精确到 1 分钟。点「记到现在」补上上次到此刻；点色块可改。</div>
        ${timelineHtml()}
      </section>
      <section class="panel achieve-wrap ${showAchieve ? "" : "hidden"}">
        ${achieveHtml(r)}
      </section>
    </div>
    ${canLogNow ? `<button class="fab" data-act="log-now">记到现在</button>` : ""}
    <nav class="tabs">
      <button class="${state.tab === "time" ? "on" : ""}" data-act="tab-time">时间</button>
      <button class="${state.tab === "achieve" ? "on" : ""}" data-act="tab-achieve">厉害</button>
    </nav>
  `;
  bindApp();
  scrollToNow();
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

  const blocks = state.day.blocks
    .map((block) => {
      const visStart = Math.max(block.startMin, START_HOUR * 60);
      const visEnd = Math.min(block.endMin, END_HOUR * 60);
      if (visEnd <= visStart) return "";
      const top = ((visStart - START_HOUR * 60) / 60) * HOUR_H;
      const h = Math.max(8, ((visEnd - visStart) / 60) * HOUR_H);
      const colors = blockColors(block);
      const mixed = colors.length > 1 && !block.isPlan;
      const label = block.isPlan ? `计划 · ${blockLabel(block)}` : blockLabel(block);
      const ink = mixed || luminance(colors[0]) <= 0.55 ? "#F4EDE4" : "#0F1419";
      const bg = block.isPlan ? `${colors[0]}22` : gradientCss(colors);
      const style = [
        `top:${top}px`,
        `height:${h}px`,
        `background:${bg}`,
        `color:${block.isPlan ? colors[0] : ink}`,
        block.isPlan ? `border-color:${colors[0]}` : "",
      ].filter(Boolean).join(";");
      return `<div class="block ${block.isPlan ? "plan" : "actual"}${mixed ? " mix" : ""}" data-id="${block.id}" style="${style}">
        ${label}${h > 28 ? `<div class="when">${minutesToHm(block.startMin)}–${minutesToHm(block.endMin)}</div>` : ""}
      </div>`;
    })
    .join("");

  return `<div class="timeline" id="timeline">
    <div style="position:relative;height:${height}px">
      ${hourRows}
      ${blocks}
      ${showNow ? `<div class="now-line" style="top:${nowTop}px"></div>` : ""}
    </div>
  </div>`;
}

function luminance(hex) {
  const n = (hex || "#888888").replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function achieveHtml(r) {
  const settings = loadSettings();
  const habits = loadHabits();
  const week = weekStats(loadDay, state.date);
  const total = r.delayMinutes + r.careMinutes + r.instantMinutes;
  const bar = total === 0
    ? ""
    : `<div class="bar">
        ${r.delayMinutes ? `<span style="flex:${r.delayMinutes};background:#7DCEA0"></span>` : ""}
        ${r.careMinutes ? `<span style="flex:${r.careMinutes};background:#E8C9A0"></span>` : ""}
        ${r.instantMinutes ? `<span style="flex:${r.instantMinutes};background:#E07A5F"></span>` : ""}
      </div>`;

  const habitChips = habits.map(
    (h) =>
      `<button class="chip ${state.day.habits[h.id] ? "on" : ""}" data-habit="${h.id}">${escapeAttr(h.label)}  +${h.points}</button>`,
  ).join("");

  const highlights = r.highlights.map((line) => `<div class="card">${line}</div>`).join("");
  const seeds = r.seeds
    ? `<div class="seeds">${Array.from({ length: Math.min(18, r.seeds) }, () => `<i class="seed"></i>`).join("")}${r.seeds > 18 ? `<span class="muted">+${r.seeds - 18}</span>` : ""}</div>`
    : `<p class="muted">学习、读书、健身、创作、功课，每半小时长一颗种子。</p>`;

  const weekDots = week.days
    .map((d) => {
      const lab = d.iso.slice(8);
      const cls = d.delay >= 30 ? "on" : d.instant >= 30 ? "mix" : "";
      return `<div class="week-day"><div class="week-dot ${cls}"></div><div class="week-lab">${Number(lab)}</div></div>`;
    })
    .join("");

  return `
    <p class="muted" style="margin:0">今天变得多厉害</p>
    <h2 class="title">${r.title}</h2>
    <div class="score">${r.awesomeIndex}</div>
    <p class="muted">${r.summary}</p>
    <div class="section">延迟满足可视化</div>
    ${bar || `<div class="bar"></div>`}
    <p class="legend">延迟 ${formatDuration(r.delayMinutes)}  ·  照料 ${formatDuration(r.careMinutes)}  ·  即时 ${formatDuration(r.instantMinutes)}</p>
    ${total === 0 ? `<p class="muted">还没有实际记录。点「记到现在」。</p>` : ""}
    <div class="section">这一周种下的</div>
    <div class="week">${weekDots}</div>
    <p class="muted">近 7 天深度投入 ${formatDuration(week.delayTotal)}，有投入的日子 ${week.activeDays}/7。</p>
    <div class="section">种下的半小时</div>
    ${seeds}
    <div class="section-row">
      <div class="section" style="margin:0">日常加分</div>
      <button class="btn" data-act="habits">修改项目</button>
    </div>
    <div class="chip-col">${habitChips || `<p class="muted">还没有加分项，点右上角修改。</p>`}</div>
    ${highlights}
    <div class="card"><strong style="color:var(--clay)">延迟满足 · 复利</strong><p class="muted" style="margin:8px 0 0">${r.futureYield}</p></div>
    <div class="switch-row">
      <div>
        <div>整点提醒我记一笔</div>
        <p class="muted" style="margin:4px 0 0">提醒你补上「上次到现在」。不必记满一小时，精确到分钟。添加到主屏幕后，打开 App 才会弹出。</p>
      </div>
      <input type="checkbox" id="prompt-toggle" ${settings.promptEnabled ? "checked" : ""} />
    </div>
    <div class="row" style="margin-top:16px">
      <button class="btn" data-act="export">导出备份</button>
      <button class="btn" data-act="import">从备份导入</button>
    </div>
  `;
}

function bindApp() {
  document.querySelectorAll("[data-act]").forEach((el) => {
    el.addEventListener("click", onAction);
  });
  document.querySelectorAll("[data-habit]").forEach((el) => {
    el.addEventListener("click", () => {
      state.day = toggleHabit(state.day, el.dataset.habit);
      render();
    });
  });
  const toggle = document.getElementById("prompt-toggle");
  if (toggle) {
    toggle.addEventListener("change", async () => {
      saveSettings({ ...loadSettings(), promptEnabled: toggle.checked });
      if (toggle.checked) await requestNotify();
    });
  }
  const timeline = document.getElementById("timeline");
  if (timeline) {
    timeline.addEventListener("click", (event) => {
      const block = event.target.closest("[data-id]");
      if (block) {
        const found = state.day.blocks.find((b) => b.id === block.dataset.id);
        if (found) openEditor(found);
        return;
      }
      const hourRow = event.target.closest("[data-hour]");
      if (hourRow) {
        const hour = Number(hourRow.dataset.hour);
        let start = hour * 60;
        const last = lastActualEnd(state.day);
        if (last != null && last > start && last < hour * 60 + 60) start = last;
        const end = Math.max(start + 1, Math.min(hour * 60 + 60, start + 30));
        openRecordSheet({ startMin: start, endMin: end });
      }
    });
  }
}

function onAction(event) {
  const act = event.currentTarget.dataset.act;
  if (act === "prev") {
    state.date = addDays(state.date, -1);
    render();
  } else if (act === "next") {
    state.date = addDays(state.date, 1);
    render();
  } else if (act === "today") {
    state.date = todayISO();
    render();
  } else if (act === "plan") {
    const hour = state.date === todayISO() ? Math.min(22, Math.max(6, new Date().getHours())) : 9;
    openEditor({
      id: uid(),
      isPlan: true,
      kinds: ["STUDY"],
      kind: "STUDY",
      title: "",
      startMin: hour * 60,
      endMin: hour * 60 + 60,
    });
  } else if (act === "log-now") {
    openRecordSheet(gapFromLastToNow(state.day));
  } else if (act === "tab-time") {
    state.tab = "time";
    render();
  } else if (act === "tab-achieve") {
    state.tab = "achieve";
    render();
  } else if (act === "habits") {
    openHabitsSheet();
  } else if (act === "export") {
    download("rihou-backup.json", exportAll());
  } else if (act === "import") {
    pickFile((text) => {
      importAll(text);
      render();
    });
  }
}

function scrollToNow() {
  if (state.date !== todayISO()) return;
  const timeline = document.getElementById("timeline");
  if (!timeline) return;
  const last = lastActualEnd(state.day);
  const focus = last == null ? nowMinutes() : last;
  const hour = Math.max(START_HOUR, Math.floor(focus / 60) - 1);
  timeline.scrollTop = (hour - START_HOUR) * HOUR_H;
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
  const kinds = KINDS.map((k) => {
    const on = draft.kinds.includes(k.id);
    return `<button type="button" class="chip-h ${on ? "on" : ""}" data-kind="${k.id}">${k.label}</button>`;
  }).join("");
  const preview = draft.kinds.length
    ? `<div class="mix-preview" id="mix-box" style="background:${gradientCss(draft.kinds.map((id) => kindById(id).color))}"></div>
       <p class="muted" id="mix-hint">${draft.kinds.length === 1 ? "整段都是这件事。结束时间可以改成只记其中几分钟。" : "记不清哪分钟换的事：这段会显示成渐变色块，打分时时间均分。"}</p>`
    : `<div class="mix-preview" id="mix-box" style="display:none"></div><p class="muted" id="mix-hint">点一件或多件。学了半小时就去通勤：只改结束时间，或两件都点上做成渐变。</p>`;

  return `
    <div class="sheet">
      <h2>${lastActualEnd(state.day) == null ? "记到现在" : "上次到现在"}</h2>
      <p class="muted">默认从上次记录结束，记到此刻，精确到 1 分钟。整点只是提醒，不必记满一小时。</p>
      ${timeFields(draft)}
      <div class="section">这段里有什么</div>
      <div class="row">${kinds}</div>
      ${preview}
      <input class="field" id="title" placeholder="备注（可空）" value="${escapeAttr(draft.title)}" />
      <button class="primary" data-save>保存</button>
      <button class="ghost" data-close>取消</button>
    </div>
  `;
}

function timeFields(draft) {
  return `
    <div class="time-field">
      <span>开始</span>
      <div class="time-controls">
        <button class="btn" data-nudge="start,-5">−5</button>
        <button class="btn" data-nudge="start,-1">−1</button>
        <input type="time" id="start-time" value="${hmInputValue(draft.startMin)}" />
        <button class="btn" data-nudge="start,1">+1</button>
        <button class="btn" data-nudge="start,5">+5</button>
      </div>
    </div>
    <div class="time-field">
      <span>结束</span>
      <div class="time-controls">
        <button class="btn" data-nudge="end,-5">−5</button>
        <button class="btn" data-nudge="end,-1">−1</button>
        <input type="time" id="end-time" value="${hmInputValue(draft.endMin)}" />
        <button class="btn" data-nudge="end,1">+1</button>
        <button class="btn" data-nudge="end,5">+5</button>
        <button class="btn" data-now>此刻</button>
      </div>
    </div>
    <p class="muted" id="span-lab">${minutesToHm(draft.startMin)}–${minutesToHm(draft.endMin)} · ${formatDuration(draft.endMin - draft.startMin)}</p>
  `;
}

function bindTimeFields(root, draft, onChange) {
  const sync = () => {
    root.querySelector("#start-time").value = hmInputValue(draft.startMin);
    root.querySelector("#end-time").value = hmInputValue(draft.endMin);
    const lab = root.querySelector("#span-lab");
    if (lab) {
      lab.textContent = `${minutesToHm(draft.startMin)}–${minutesToHm(draft.endMin)} · ${formatDuration(Math.max(0, draft.endMin - draft.startMin))}`;
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
      hint.textContent = "点一件或多件。学了半小时就去通勤：只改结束时间，或两件都点上做成渐变。";
      return;
    }
    box.style.display = "block";
    box.style.background = gradientCss(draft.kinds.map((id) => kindById(id).color));
    hint.textContent = draft.kinds.length === 1
      ? "整段都是这件事。结束时间可以改成只记其中几分钟。"
      : "记不清哪分钟换的事：这段会显示成渐变色块，打分时时间均分。";
  };

  root.querySelectorAll("[data-kind]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.kind;
      if (draft.kinds.includes(id)) draft.kinds = draft.kinds.filter((k) => k !== id);
      else draft.kinds.push(id);
      el.classList.toggle("on", draft.kinds.includes(id));
      updateMix();
    });
  });

  root.querySelector("[data-save]").addEventListener("click", () => {
    if (draft.kinds.length === 0) {
      root.querySelector("[data-save]").textContent = "先选至少一件事";
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
  showSheet(editorHtml(draft, true), (root) => bindEditor(root, draft, true));
}

function editorHtml(draft, isEdit) {
  const kinds = KINDS.map((k) => {
    const on = draft.kinds.includes(k.id);
    return `<button type="button" class="chip-h ${on ? "on" : ""}" data-kind="${k.id}">${k.label}</button>`;
  }).join("");
  const mixHint = !draft.isPlan && draft.kinds.length > 1
    ? `<div class="mix-preview" style="background:${gradientCss(draft.kinds.map((id) => kindById(id).color))}"></div>
       <p class="muted">多选表示这段里都做过，但记不清分界，时间轴上是渐变。</p>`
    : "";
  return `
    <div class="sheet">
      <h2>${isEdit ? "改这一段" : draft.isPlan ? "添加计划" : "记一笔"}</h2>
      <div class="row">
        <button class="chip-h ${draft.isPlan ? "" : "on"}" data-mode="actual">实际</button>
        <button class="chip-h ${draft.isPlan ? "on" : ""}" data-mode="plan">计划</button>
      </div>
      <div class="row">${kinds}</div>
      ${mixHint}
      <input class="field" id="title" placeholder="备注（可空）" value="${escapeAttr(draft.title)}" />
      ${timeFields(draft)}
      <button class="primary" data-save>保存</button>
      ${isEdit ? `<button class="danger" data-delete>删除这段</button>` : ""}
      <button class="ghost" data-close>取消</button>
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
  root.querySelectorAll("[data-kind]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.kind;
      if (draft.isPlan) {
        draft.kinds = [id];
      } else if (draft.kinds.includes(id)) {
        draft.kinds = draft.kinds.filter((k) => k !== id);
        if (draft.kinds.length === 0) draft.kinds = [id];
      } else {
        draft.kinds = [...draft.kinds, id];
      }
      redraw();
    });
  });
  root.querySelectorAll("[data-mode]").forEach((el) => {
    el.addEventListener("click", () => {
      draft.isPlan = el.dataset.mode === "plan";
      if (draft.isPlan) draft.kinds = draft.kinds.slice(0, 1);
      redraw();
    });
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
      isPlan: draft.isPlan,
    });
    closeSheet();
    render();
  });
  const del = root.querySelector("[data-delete]");
  if (del) {
    del.addEventListener("click", () => {
      state.day = removeBlock(state.day, draft.id);
      closeSheet();
      render();
    });
  }
  root.querySelector("[data-close]").addEventListener("click", closeSheet);
}

function openHabitsSheet() {
  const habits = loadHabits().map((h) => ({ ...h }));
  const html = () => `
    <div class="sheet">
      <h2>日常加分项目</h2>
      <p class="muted">自己增删。分值是做了当天加多少。刷牙、十一点前睡觉只是默认，可以改掉。</p>
      <div id="habit-list">
        ${habits.map((h, i) => `
          <div class="habit-edit">
            <input class="field" data-h="label" data-i="${i}" value="${escapeAttr(h.label)}" placeholder="名称" />
            <input class="field points" data-h="points" data-i="${i}" type="number" min="1" max="50" value="${h.points}" />
            <button class="btn" data-del="${i}">删</button>
          </div>
        `).join("")}
      </div>
      <button class="ghost" data-add>＋新项目</button>
      <button class="primary" data-save>保存</button>
      <button class="ghost" data-close>取消</button>
    </div>
  `;
  showSheet(html(), (root) => {
    const redraw = () => {
      const next = document.createElement("div");
      next.innerHTML = html();
      root.querySelector(".sheet").replaceWith(next.firstElementChild);
      bind();
    };
    const bind = () => {
      root.querySelectorAll("[data-h]").forEach((el) => {
        el.addEventListener("input", () => {
          const i = Number(el.dataset.i);
          if (el.dataset.h === "points") habits[i].points = Math.max(1, Math.min(50, Number(el.value) || 1));
          else habits[i].label = el.value;
        });
      });
      root.querySelectorAll("[data-del]").forEach((el) => {
        el.addEventListener("click", () => {
          habits.splice(Number(el.dataset.del), 1);
          redraw();
        });
      });
      root.querySelector("[data-add]").addEventListener("click", () => {
        habits.push({ id: uid(), label: "新习惯", points: 8, hint: "" });
        redraw();
      });
      root.querySelector("[data-save]").addEventListener("click", () => {
        const cleaned = habits
          .map((h) => ({ ...h, label: h.label.trim(), points: Math.max(1, Number(h.points) || 1) }))
          .filter((h) => h.label);
        saveHabits(cleaned);
        closeSheet();
        render();
      });
      root.querySelector("[data-close]").addEventListener("click", closeSheet);
    };
    bind();
  });
}

function showSheet(html, bind) {
  const bg = document.getElementById("sheet-bg");
  bg.className = "sheet-bg show";
  bg.innerHTML = html;
  bg.onclick = (event) => {
    if (event.target === bg) closeSheet();
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
    new Notification("记一笔：上次到现在", {
      body: `${minutesToHm(gap.startMin)}–${minutesToHm(gap.endMin)}，精确到分钟，不必记满一小时。`,
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

window.addEventListener("resize", () => render());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") maybeOfferHour();
});

render();
maybeOfferHour();
setInterval(tickHour, 15000);
requestNotify();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
