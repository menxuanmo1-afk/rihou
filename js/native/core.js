import { addDays, todayISO, blockKinds, kindById } from "../models.js?v=102";

export const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const hours = minutes => `${(Math.max(0, minutes) / 60).toFixed(1)}h`;
export const atMinute = (iso, minute) => { const [y,m,d] = iso.split("-").map(Number); return new Date(y,m-1,d,0,Number(minute),0,0).getTime(); };
export const hm = stamp => new Date(stamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
export const minuteOf = stamp => new Date(stamp).getHours() * 60 + new Date(stamp).getMinutes();
export const actualName = block => String(block.title || blockKinds(block).map(id => kindById(id).label).join(" / "));
export function hash(value) { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16); }
export function flatten(days, plans = false) {
  return Object.entries(days).flatMap(([date, day]) => (day.blocks || []).filter(b => Boolean(b.isPlan) === plans).map(b => ({ ...b, date, start: atMinute(date,b.startMin), end: atMinute(date,b.endMin) })))
    .filter(b => Number.isFinite(b.start) && b.end > b.start).sort((a,b) => a.start-b.start || a.end-b.end);
}
export function sleepSessions(days, now = Date.now()) {
  const sessions = [];
  for (const b of flatten(days).filter(b => blockKinds(b).includes("SLEEP") && b.end <= now)) {
    const last = sessions.at(-1);
    if (last && b.start <= last.end + 60000) { last.end = Math.max(last.end,b.end); last.parts.push(b); }
    else sessions.push({ start:b.start, end:b.end, parts:[b] });
  }
  return sessions.filter(s => {
    const duration=s.end-s.start, endHour=new Date(s.end).getHours();
    return duration>=180*60000 || (duration>=30*60000 && (todayISO(new Date(s.start))!==todayISO(new Date(s.end)) || (endHour>=3 && endHour<12)));
  });
}
export function category(id) {
  if (id === "SLEEP") return "sleep";
  if (["SCROLL","GAME"].includes(id)) return "consume";
  if (["STUDY","READ","CLASS","WORK","FITNESS","SPORT","CREATE"].includes(id) || kindById(id).custom) return "invest";
  return "rest";
}
export function buildReview(days, archive = {}, now = Date.now()) {
  const sessions = sleepSessions(days, now);
  const sleep = sessions.at(-1);
  if (!sleep) return null;
  const previous = sessions.at(-2);
  const actuals = flatten(days);
  const candidates = actuals.filter(b => b.end <= sleep.start && b.start >= sleep.start-36*3600000);
  const start = previous?.end ?? candidates[0]?.start ?? sleep.start;
  // A missing prior wake is a data gap, never silently relabel midnight as waking.
  const windowStart = Math.max(start, sleep.end-48*3600000);
  const blocks = actuals.filter(b => b.start < sleep.end && b.end > windowStart).map(b => ({
    id:`${b.date}:${b.id}`, blockId:b.id, date:b.date, start:Math.max(windowStart,b.start), end:Math.min(sleep.end,b.end),
    kinds:blockKinds(b), name:actualName(b), todoId:b.todoId || null, fromPlanId:b.fromPlanId || null,
  }));
  const sleepMinutes=sleep.parts.reduce((sum,b)=>sum+(b.end-b.start)/60000/blockKinds(b).length,0);
  const totals = { invest:0,consume:0,rest:0,sleep:sleepMinutes };
  const breakdown = { invest:{},consume:{} };
  for (const b of blocks) for (const id of b.kinds) {
    const cat = category(id), minutes=(b.end-b.start)/60000/b.kinds.length;
    if (cat !== "sleep") totals[cat] += minutes;
    if (breakdown[cat]) breakdown[cat][kindById(id).label] = (breakdown[cat][kindById(id).label] || 0)+minutes;
  }
  const date = todayISO(new Date(windowStart));
  const plans = Object.values(archive).filter(p => p.start >= windowStart && p.start < sleep.start).map(p => {
    const match = blocks.find(b => b.date === p.date && (b.blockId === p.blockId || b.fromPlanId === p.blockId || (p.todoId && b.todoId === p.todoId)));
    return { ...p, actualStart:match?.start ?? null, delayMin:match ? Math.round((match.start-p.start)/60000) : null };
  });
  const fingerprint = hash(JSON.stringify({ start:windowStart,end:sleep.end,blocks,plans }));
  return { date, start:windowStart, end:sleep.end, boundaryKnown:Boolean(previous && previous.end===windowStart), sleep, blocks, totals, breakdown, plans, fingerprint };
}
export function capturePlans(days, archive = {}, now=Date.now()) {
  const next = { ...archive };
  for (const b of flatten(days,true)) {
    const key=`${b.date}:${b.id}`,prior=next[key];
    // Keep the promised slot once it starts; logging into a plan clips its remaining span.
    if(prior&&prior.start<=now)continue;
    next[key] = { id:key, blockId:b.id, date:b.date, start:b.start,end:b.end,name:actualName(b),todoId:b.todoId||null };
  }
  const cutoff=atMinute(addDays(todayISO(),-90),0);
  return Object.fromEntries(Object.entries(next).filter(([,v]) => v.end>=cutoff));
}
export function futureSlot(blocks, nowMinute, duration = 30) {
  for(let start=Math.ceil(nowMinute/5)*5; start+duration<=1440; start+=5) {
    if(!(blocks||[]).some(b=>b.startMin<start+duration && b.endMin>start)) return { startMin:start,endMin:start+duration };
  }
  return null;
}
export function isFreshRecord(record, now=Date.now()) {
  const end=atMinute(record.date,record.endMin);
  return record.date === todayISO(new Date(now)) && end<=now+60000 && now-end<=5*60000;
}
export function weekReady(now=new Date()) { return now.getDay()===0 && now.getHours()>=14; }
export const HABITS = {
  meal_walk: { label:"饭后先轻松走 10 分钟", trigger:"结束用餐记录时提醒", kinds:["MEAL"], duration:10, planKind:"SPORT" },
  wake_start: { label:"起床后先开始第一项任务", trigger:"补记昨晚睡眠后提醒", kinds:["SLEEP"], duration:15, planKind:"STUDY" },
  work_break: { label:"长时间学习后起身活动", trigger:"结束至少 60 分钟的学习记录后提醒", kinds:["STUDY","READ","CLASS","WORK","CREATE"], duration:5, planKind:"REST" },
};
export function habitMatches(id, record) {
  const spec=HABITS[id];
  if(!spec || !blockKinds(record).some(k=>spec.kinds.includes(k))) return false;
  if(id==="work_break" && record.endMin-record.startMin<60) return false;
  if(id==="wake_start" && !record.overnight && record.endMin-record.startMin<180) return false;
  return true;
}
export function sanitizeAnalysis(raw, allowedIds) {
  if(!raw || typeof raw!=="object" || typeof raw.summary!=="string") throw new Error("分析格式不正确");
  const text=(v,n)=>String(v||"").slice(0,n);
  const events=(Array.isArray(raw.events)?raw.events:[]).filter(e=>e && allowedIds.has(e.recordId)).slice(0,5).map(e=>({
    recordId:e.recordId, type:e.type==="highlight"?"highlight":"problem", title:text(e.title,45), observation:text(e.observation,100),
    mechanism:text(e.mechanism,400), impact:text(e.impact,250), action:text(e.action,250), limit:text(e.limit,250),
    // Source text/URLs are resolved only by the server, never followed from model output.
    sources:(Array.isArray(e.sources)?e.sources:[]).filter(s=>s && /^https:\/\//.test(s.url)).slice(0,3).map(s=>({title:text(s.title,100),url:text(s.url,350)})),
  }));
  return { summary:text(raw.summary,150), events, habits:[...new Set((Array.isArray(raw.habits)?raw.habits:[]).filter(id=>Object.hasOwn(HABITS,id)))].slice(0,3) };
}
