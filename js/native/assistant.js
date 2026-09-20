import { addDays, todayISO, blockKinds, uid, kindById } from "../models.js?v=102";
import { loadAllDays, loadDay, loadSettings, saveSettings, upsertPlan } from "./store.js?v=102";
import { loadTodos } from "./todos.js?v=102";
import { escapeHtml as esc, hours, hm, hash, atMinute, minuteOf, category, buildReview, capturePlans, futureSlot, isFreshRecord, habitMatches, HABITS, sanitizeAnalysis, weekReady, flatten } from "./core.js";
import { syncReminders, initReminders, requestReminderPermission, reminderStatus, cancelHabits, sendHabitNotification } from "./reminders.js";

const CACHE="rihou.assistant-reports.v1", ARCHIVE="rihou.plan-history.v1", WAKE="rihou.assistant-wake.v1", EVENTS="rihou.habit-events.v1", TOKEN="rihou.coach-access.v1";
const read=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback;}catch{return fallback;}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const preferences=()=>loadSettings().assistant||{};
const setPreferences=patch=>saveSettings({...loadSettings(),assistant:{...preferences(),...patch}});
let ui=null, current=null, busy=false, failure="", timer=null;
const attempts=new Map();
const hhmm=min=>`${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`;
const renderSafe=()=>ui?.render();
export const reportDate=()=>current?.date||addDays(todayISO(),-1);
function refresh() { current=buildReview(loadAllDays(),read(ARCHIVE)); return current; }
function cached() {const result=current ? read(CACHE)[current.fingerprint] : null;return result?.ageGroup===(preferences().ageGroup||"adult")?result:null;}
function habitsToday() { const p=preferences(); return p.habitDate===todayISO() ? (p.activeHabits||[]) : []; }

export function configure(callbacks) {
  ui=callbacks;
  write(ARCHIVE,capturePlans(loadAllDays(),read(ARCHIVE)));
  refresh();
  window.addEventListener("rihou:store-changed",event=>{
    if(event.detail?.imported){write(ARCHIVE,{});write(CACHE,{});write(WAKE,{});attempts.clear();setPreferences({aiEnabled:false});}
    if(event.detail?.previous) write(ARCHIVE,capturePlans({[event.detail.date]:event.detail.previous},read(ARCHIVE)));
    write(ARCHIVE,capturePlans(loadAllDays(),read(ARCHIVE)));
    clearTimeout(timer);timer=setTimeout(()=>{syncReminders();refresh();ensureAnalysis();},250);
  });
  initReminders({onPlan:callbacks.navigate,onHabit:habitAction,onResume:()=>{refresh();ensureAnalysis();renderSafe();}}).catch(()=>{});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){refresh();ensureAnalysis();syncReminders();}});
}

export function html() {
  refresh();
  const result=cached(), p=preferences();
  const localSummary=current?`睡眠 ${hours(current.totals.sleep)} · 投资 ${hours(current.totals.invest)} · 消费 ${hours(current.totals.consume)}`:"";
  const status=busy?"正在生成分析…":failure||(!p.endpoint||!p.aiEnabled?"AI 尚未连接 · 在设置中连接后生成分析":result?`已生成 · ${hm(result.generatedAt)}`:"记录睡眠后生成昨日分析");
  return `<div class="coach">
    <h2 class="coach-title">昨日分析</h2><p class="coach-status" role="status">${esc(status)}</p>
    ${current?metricHtml():`<p class="coach-empty">起床后补记昨晚的睡眠，这里就会出现昨日的时间统计与分析。</p>`}
    ${current?`<section class="coach-section"><h3>昨天发生了什么</h3>${timelineHtml(result?.analysis)}${result?`<p class="coach-summary">${esc(result.analysis.summary)}</p>`:`<p class="coach-muted">${esc(localSummary)}。以上为本机统计；AI 分析尚未生成。</p>`}</section>`:""}
    ${current?reviewHtml():""}
    ${current&&!result&&p.endpoint&&p.aiEnabled?`<button class="coach-link" data-coach="retry" ${busy?"disabled":""}>${failure?"重试分析":"生成这次睡眠对应的分析"}</button>`:""}
    <section class="coach-section"><h2 class="coach-title">今日建议</h2>${habitHtml(result?.analysis)}${dueHtml()}</section>
    ${weekHtml()}
    <p class="coach-feedback" data-coach-feedback role="status" aria-live="polite"></p>
  </div>`;
}
function metricHtml() {
  const details=cat=>Object.entries(current.breakdown[cat]).map(([label,min])=>`${esc(label)} ${hours(min)}`).join(" · ")||"暂无记录";
  return `<div class="coach-metrics">
    <div><span>投资 <strong>${hours(current.totals.invest)}</strong></span><p>${details("invest")}</p></div>
    <div class="coach-inline"><span>睡眠 <strong>${hours(current.totals.sleep)}</strong></span><p>${hm(current.sleep.start)} 睡 · ${hm(current.sleep.end)} 起</p></div>
    <div class="coach-inline"><span>消费 <strong>${hours(current.totals.consume)}</strong></span><p>${details("consume")}</p></div>
    </div><p class="coach-boundary">${current.boundaryKnown?"从上次起床到今早起床":"上次起床时间缺失，暂按最早记录统计"} · ${hm(current.start)} → ${hm(current.end)}</p>`;
}
function timelineHtml(analysis) {
  const duration=current.end-current.start;
  const blocks=current.blocks;
  const marks=blocks.map(b=>`<span style="top:${Math.max(0,(b.start-current.start)/duration*100)}%;height:${Math.max(.45,(b.end-b.start)/duration*100)}%;background:${esc(kindById(b.kinds[0]).color)}"></span>`).join("");
  const insights=analysis?.events||[];
  let events=insights.map(e=>({...e,block:blocks.find(b=>b.id===e.recordId)})).filter(e=>e.block).sort((a,b)=>a.block.start-b.block.start);
  if(!events.length) events=blocks.filter(b=>b.end-b.start>=30*60000).slice(0,4).map(b=>({block:b,title:b.name,observation:`记录 ${hours((b.end-b.start)/60000)}`,type:"record"}));
  if(!events.length) events=blocks.slice(0,3).map(b=>({block:b,title:b.name,type:"record"}));
  const height=Math.max(320,events.length*128);
  // Labels use a collision-free stack; marks retain their true positions.
  return `<div class="coach-timeline" style="--coach-height:${height}px"><div class="coach-mini" role="img" aria-label="昨日实际时间线"><time>${hm(current.start)}</time><div class="coach-track">${marks}</div><time>${hm(current.end)}</time></div>
    <div class="coach-events">${events.map(e=>`<article><time>${hm(e.block.start)}–${hm(e.block.end)}</time><span class="coach-tag ${e.type}">${e.type==="problem"?"问题":e.type==="highlight"?"亮点":"记录"}</span><strong>${esc(e.title)}</strong><p>${esc(e.observation||"")}</p>${e.type!=="record"?`<button class="coach-link" data-coach="detail" data-record-id="${esc(e.recordId)}">查看深度分析 ↗</button>`:""}</article>`).join("")}</div></div>`;
}
function reviewHtml() {
  const plans=current.plans, linked=plans.filter(p=>p.actualStart!=null);
  const delayed=linked.filter(p=>p.delayMin>15).sort((a,b)=>b.delayMin-a.delayMin)[0];
  const todos=loadTodos().filter(t=>Date.parse(t.createdAt)<=current.end && (!t.completedAt||Date.parse(t.completedAt)>=current.start));
  const completed=todos.filter(t=>t.completedAt&&Date.parse(t.completedAt)<=current.end);
  const carry=todos.filter(t=>!t.done&&t.dueISO&&t.dueISO<=todayISO()).sort((a,b)=>a.dueISO.localeCompare(b.dueISO))[0];
  const first=delayed?`${delayed.name} 比原计划晚开始 ${hours(delayed.delayMin)}。`:plans.length?`${plans.length-linked.length} 项计划尚无可确认的对应记录。`:"之前的计划对照尚未留存，从本次更新开始积累。";
  const second=carry?`${carry.text} 仍未勾选，${carry.dueISO===todayISO()?"今天到期":"已逾期"}。`:"没有需要今天接手的临期待办。";
  return `<section class="coach-section"><h3>计划与待办复盘</h3><p class="coach-muted">${plans.length} 项计划 · ${linked.length} 项有对应记录；待办完成 ${completed.length}/${todos.length}</p><p class="coach-finding"><em>偏差</em>${esc(first)}</p><p class="coach-finding"><em>接手</em>${esc(second)}</p><details><summary>展开对照记录</summary>${plans.map(p=>`<p>${esc(p.name)}：计划 ${hm(p.start)}–${hm(p.end)}；${p.actualStart==null?"无确认记录，可能漏记":`实际从 ${hm(p.actualStart)} 开始`}。</p>`).join("")}</details></section>`;
}
function habitHtml(analysis) {
  const candidates=[...new Set([...(analysis?.habits||[]),...habitsToday()])];
  if(analysis&&!candidates.length)return `<h3>作息上的改进</h3><p class="coach-muted">这次没有需要优先启用的情境提醒。</p>`;
  const ids=candidates.length?candidates:Object.keys(HABITS);
  return `<h3>作息上的改进</h3>${!analysis?`<p class="coach-muted">可选情境提醒，尚未由 AI 个性化分析。</p>`:""}${ids.map(id=>{const h=HABITS[id],on=habitsToday().includes(id);return `<div class="coach-habit"><div><strong>${esc(h.label)}</strong><p>${esc(h.trigger)}</p></div><button class="btn" data-coach="habit" data-habit="${id}" aria-pressed="${on}">${on?"停用":"启用"}</button></div>`;}).join("")}`;
}
function dueHtml() {
  const now=Date.now(),today=todayISO(),blocks=[...loadDay(today).blocks];
  const due=loadTodos().filter(t=>!t.done&&t.dueISO&&t.dueISO<=today).sort((a,b)=>a.dueISO.localeCompare(b.dueISO));
  return `<h3>今日到期${due.some(t=>t.dueISO<today)?"与逾期":""}</h3>${due.length?due.map(todo=>{
    const exists=blocks.find(b=>b.isPlan&&b.todoId===todo.id);
    const slot=exists||futureSlot(blocks,minuteOf(now)+5,30);
    if(slot&&!exists) blocks.push(slot);
    return `<div class="coach-due"><div><strong>${esc(todo.text)} <small>${todo.dueISO<today?"已逾期":"今天"}</small></strong><p>${slot?`${hhmm(slot.startMin)}–${hhmm(slot.endMin)} · ${exists?"已安排":"暂估 0.5h"}`:"今天没有合适空档"}</p></div><button class="btn" data-coach="adopt" data-todo="${esc(todo.id)}" data-start="${slot?.startMin??0}" ${!slot||exists?"disabled":""}>${exists?"已安排":"采纳"}</button></div>`;
  }).join(""):`<p class="coach-muted">今天没有到期的未完成待办。</p>`}`;
}
function weekHtml() {
  const p=preferences(),week=read(CACHE).week;
  if(!week||!weekReady()||week.date!==todayISO()) return "";
  return `<section class="coach-section"><h3>这周分析</h3><p>${esc(week.analysis.summary)}</p></section>`;
}
export function bind(root,{active}) {
  root.querySelectorAll("[data-coach]").forEach(button=>button.addEventListener("click",async()=>{
    try {
      const action=button.dataset.coach;
      if(action==="retry") await ensureAnalysis(true);
      if(action==="detail") openDetail(button.dataset.recordId);
      if(action==="habit") {
        const list=habitsToday(),id=button.dataset.habit;
        if(!list.includes(id)&&!await requestReminderPermission()){feedback("请在 iPhone 设置中允许通知后重试。");return;}
        setPreferences({habitDate:todayISO(),habitReminders:true,activeHabits:list.includes(id)?list.filter(x=>x!==id):[...list,id]});
        if(list.includes(id)) await cancelHabits(id);
        renderSafe();
      }
      if(action==="adopt") {
        const todo=loadTodos().find(t=>t.id===button.dataset.todo&&!t.done);
        const day=loadDay(todayISO());
        if(!todo||day.blocks.some(b=>b.isPlan&&b.todoId===todo.id)){renderSafe();return;}
        const start=Number(button.dataset.start),end=start+30;
        if(start<minuteOf(Date.now())||day.blocks.some(b=>b.startMin<end&&b.endMin>start)){feedback("这个时段已被占用，请刷新建议。");renderSafe();return;}
        upsertPlan(day,{id:uid(),startMin:start,endMin:end,kinds:["OTHER"],title:todo.text,todoId:todo.id});
        await syncReminders();renderSafe();feedback("已加入计划；待办仍保持未完成，可在时间线上调整。");
      }
    }catch{feedback("这次操作未完成，请稍后重试。");}
  }));
  if(active) { ensureAnalysis(); ensureWeek(); }
}
function feedback(message) { const target=document.querySelector("[data-coach-feedback]");if(target)target.textContent=message; }
function openDetail(id) {
  const event=cached()?.analysis.events.find(e=>e.recordId===id);
  if(!event)return;
  const sections=[["记录与判断",event.observation],["生物学原理与证据",event.mechanism],["可能的影响",event.impact],["可以怎么做",event.action],["适用范围",event.limit]];
  ui.showSheet(`<div class="sheet coach coach-detail"><h2>${esc(event.title)}</h2>${sections.filter(([,v])=>v).map(([label,value])=>`<h3>${label}</h3><p>${esc(value)}</p>`).join("")}<p class="coach-muted">依据：${event.sources.map(s=>esc(s.title)).join("；")||"本次时间记录"}。完整知识资料保存在分析服务端。</p><button class="ghost" data-close>关闭</button></div>`,root=>root.querySelector("[data-close]").addEventListener("click",ui.closeSheet));
}
function validEndpoint(value) { try {const u=new URL(value); return u.protocol==="https:"&&!u.username&&!u.password&&!u.search&&!u.hash?u.href.replace(/\/$/,""):null;}catch{return null;} }
async function fetchAnalysis(payload) {
  const endpoint=validEndpoint(preferences().endpoint);
  if(!endpoint) throw Error("请在设置中填写有效的 HTTPS 服务地址");
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),65000);
  try {
    const response=await fetch(endpoint+"/analyze",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${localStorage.getItem(TOKEN)||""}`},body:JSON.stringify(payload),signal:controller.signal});
    if(!response.ok) throw Error(response.status===401?"服务访问码不正确":response.status===429?"请求较多，请稍后重试":`分析服务暂不可用（${response.status}）`);
    const result=await response.json();
    return sanitizeAnalysis(result,new Set(payload.blocks.map(b=>b.id)));
  }finally{clearTimeout(timeout);}
}
async function ensureAnalysis(manual=false) {
  const data=refresh(),p=preferences();
  if(!data||!p.aiEnabled||!validEndpoint(p.endpoint)||busy||cached())return;
  const wake=read(WAKE);
  if(!manual && wake.end!==data.end) return;
  if(!manual && attempts.has(data.fingerprint))return;
  const key=data.fingerprint;
  attempts.set(key,true);busy=true;failure="";renderSafe();
  try {
    const analysis=await fetchAnalysis({mode:"yesterday",date:data.date,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,start:data.start,end:data.end,boundaryKnown:data.boundaryKnown,summary:data.totals,blocks:data.blocks,plans:data.plans,ageGroup:p.ageGroup||"adult"});
    if(!preferences().aiEnabled || preferences().endpoint!==p.endpoint || preferences().ageGroup!==p.ageGroup) return;
    const cache=read(CACHE);cache[key]={analysis,date:data.date,ageGroup:p.ageGroup||"adult",generatedAt:Date.now()};
    const ordered=Object.entries(cache).sort((a,b)=>(b[1].generatedAt||0)-(a[1].generatedAt||0)).slice(0,35);
    write(CACHE,Object.fromEntries(ordered));
  }catch(error){failure=error.name==="AbortError"?"分析超时，已有记录不受影响，可重试。":error.message;}
  finally{busy=false;renderSafe();}
}
let weekBusy=false;
async function ensureWeek() {
  if(!weekReady()||weekBusy||!preferences().aiEnabled||!validEndpoint(preferences().endpoint))return;
  const today=todayISO();
  const days={};for(let i=6;i>=0;i--){const d=addDays(today,-i);days[d]=loadDay(d);}
  const blocks=flatten(days).map(b=>({id:`${b.date}:${b.id}`,start:b.start,end:b.end,kinds:blockKinds(b),name:b.title||blockKinds(b).map(k=>kindById(k).label).join(" / ")}));
  if(!blocks.length)return;
  const fingerprint=hash(JSON.stringify(blocks)),key=`week:${today}:${fingerprint}`,p=preferences();
  if(read(CACHE).week?.fingerprint===fingerprint||attempts.has(key))return;
  weekBusy=true;attempts.set(key,true);
  try{const analysis=await fetchAnalysis({mode:"week",date:today,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,blocks,summary:{},ageGroup:p.ageGroup||"adult"});if(preferences().aiEnabled&&preferences().endpoint===p.endpoint){write(CACHE,{...read(CACHE),week:{date:today,fingerprint,analysis,generatedAt:Date.now()}});renderSafe();}}catch{}finally{weekBusy=false;}
}
export function recorded(record) {
  if(!isFreshRecord(record))return;
  const data=refresh();
  if(blockKinds(record).includes("SLEEP")&&data&&Math.abs(data.end-atMinute(record.date,record.endMin))<60000){write(WAKE,{end:data.end});ensureAnalysis();}
  if(preferences().habitReminders===false)return;
  const events=read(EVENTS);
  for(const id of habitsToday().filter(id=>habitMatches(id,record))) {
    const eventKey=`${record.date}:${record.id}:${id}`;
    if(events[eventKey])continue;
    const end=atMinute(record.date,record.endMin),deadline=end+15*60000;
    events[eventKey]={date:record.date,handled:false,deadline};
    sendHabitNotification({id,label:HABITS[id].label,eventKey,date:record.date,end,deadline}).catch(()=>{});
  }
  write(EVENTS,Object.fromEntries(Object.entries(events).filter(([,e])=>e.date>=addDays(todayISO(),-2))));
}
async function habitAction(action,data) {
  const events=read(EVENTS),entry=events[data.eventKey];
  if(!entry||entry.handled||!habitsToday().includes(data.habitId)||data.deadline<Date.now()||data.date!==todayISO())return;
  if(preferences().habitReminders===false)return;
  if(action==="skip") {setPreferences({activeHabits:habitsToday().filter(id=>id!==data.habitId)});entry.handled=true;await cancelHabits(data.habitId);}
  else if(action==="later") {
    if(data.attempt>=1||Date.now()+5*60000>data.deadline)return;
    await sendHabitNotification({id:data.habitId,label:HABITS[data.habitId].label,...data,delay:300,attempt:1});
  } else if(action==="start" || action==="tap") {
    const spec=HABITS[data.habitId],start=minuteOf(Date.now()),end=start+spec.duration,day=loadDay(todayISO());
    if(end>1440||day.blocks.some(b=>b.startMin<end&&b.endMin>start)){entry.handled=true;feedback("当前没有足够空档，这次已跳过。");}
    else {const id=uid();upsertPlan(day,{id,startMin:start,endMin:end,kinds:[spec.planKind],title:spec.label});entry.handled=true;ui.navigate(todayISO(),id);}
  }
  write(EVENTS,events);renderSafe();
}
export function openSettings(actions) {
  const p=preferences();
  ui.showSheet(`<div class="sheet coach coach-settings"><h2>设置</h2>
    <h3>事项</h3><div class="row"><button class="btn" data-add>添加自定义事项</button><button class="btn" data-manage>管理事项</button></div>
    <h3>消息提醒</h3><label><input type="checkbox" data-plan ${p.planReminders!==false?"checked":""}>计划提前 10 分钟提醒</label><label><input type="checkbox" data-habits ${p.habitReminders!==false?"checked":""}>接收已启用的作息提醒</label><label><input type="checkbox" data-details ${p.notificationDetails?"checked":""}>锁屏显示计划名称</label><p class="coach-muted" data-permission>${esc(reminderStatus)}</p><button class="btn" data-permission-request>允许通知 / 刷新状态</button><p class="coach-muted">新建时不足 10 分钟的计划会尽快提醒一次。通知按最近 60 项滚动安排，每次打开或修改计划时更新；长期不打开 App，远期提醒可能尚未排入。</p>
    <h3>AI 分析</h3><p class="coach-muted">连接后，经你的 Cloudflare 服务将时间记录及备注发给 DeepSeek。知识资料只在服务端保存，不上传通讯录或位置。</p>
    <label>年龄范围<select data-age><option value="adult" ${p.ageGroup!=="teen"?"selected":""}>18 岁及以上</option><option value="teen" ${p.ageGroup==="teen"?"selected":""}>13–17 岁</option></select></label>
    <label>Cloudflare Worker 地址<input type="url" data-endpoint placeholder="https://你的服务.workers.dev" value="${esc(p.endpoint||"https://rihou-coach.menxuanmo.workers.dev")}" autocapitalize="none"></label>
    <label>服务访问码<input type="password" data-token autocomplete="off" placeholder="你部署时设置的访问码" value="${esc(localStorage.getItem(TOKEN)||"")}"></label>
    <label><input type="checkbox" data-ai ${p.aiEnabled?"checked":""}>同意发送记录并启用 AI 分析</label><p class="coach-muted">这里不填写 DeepSeek 密钥。服务访问码仅保存在本机，不包含在导出的备份中。</p>
    <h3>数据</h3><div class="row"><button class="btn" data-backup>导出备份</button><button class="btn" data-restore>导入备份</button></div><p data-error role="status"></p><button class="primary" data-save>保存设置</button><button class="ghost" data-close>关闭</button></div>`,root=>{
      root.querySelector("[data-add]").onclick=actions.add;root.querySelector("[data-manage]").onclick=actions.manage;
      root.querySelector("[data-backup]").onclick=actions.backup;root.querySelector("[data-restore]").onclick=actions.restore;
      root.querySelector("[data-close]").onclick=ui.closeSheet;
      root.querySelector("[data-permission-request]").onclick=async()=>{await requestReminderPermission();root.querySelector("[data-permission]").textContent=reminderStatus;};
      root.querySelector("[data-save]").onclick=async()=>{
        const endpoint=root.querySelector("[data-endpoint]").value.trim();
        if(endpoint&&!validEndpoint(endpoint)){root.querySelector("[data-error]").textContent="请填写不含查询参数的 HTTPS 地址。";return;}
        const ai=root.querySelector("[data-ai]").checked;
        if(ai&&!endpoint){root.querySelector("[data-error]").textContent="请先配置分析服务地址，或暂时关闭 AI。";return;}
        localStorage.setItem(TOKEN,root.querySelector("[data-token]").value.trim());
        setPreferences({endpoint,aiEnabled:ai,ageGroup:root.querySelector("[data-age]").value,planReminders:root.querySelector("[data-plan]").checked,habitReminders:root.querySelector("[data-habits]").checked,notificationDetails:root.querySelector("[data-details]").checked});
        if(!preferences().habitReminders)await cancelHabits();
        await syncReminders();ui.closeSheet();failure="";attempts.clear();renderSafe();ensureAnalysis();
      };
    });
}
