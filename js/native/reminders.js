import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import { addDays, todayISO } from "../models.js?v=102";
import { loadDay, loadAllDays, loadSettings } from "./store.js?v=102";
import { actualName, atMinute, flatten, hash, hm } from "./core.js";

const LEDGER="rihou.notification-ledger.v1";
const read=()=>{try{return JSON.parse(localStorage.getItem(LEDGER)||"{}");}catch{return {};}};
export let reminderStatus="尚未允许通知";
export function planNotifications(days, now=Date.now(), detailed=false, ledger={}) {
  const used=new Set();
  return flatten(days,true).filter(p=>p.start>now).sort((a,b)=>a.start-b.start).map(p=>{
    const key=`${p.date}:${p.id}:${p.start}:${p.end}:${actualName(p)}`;
    let id=1000000+(parseInt(hash(key),16)%1000000000);
    while(used.has(id)) id++;
    used.add(id);
    const target=p.start-10*60000;
    const at=ledger[key]?.at ?? Math.max(target,now+2000);
    return {id,title:target>now?"计划还有 10 分钟开始":"计划即将开始",body:detailed?`${hm(p.start)}–${hm(p.end)} · ${actualName(p)}`:`${hm(p.start)} 有一项计划，点此查看。`,schedule:{at:new Date(at)},actionTypeId:"PLAN",extra:{type:"plan",key,date:p.date,planId:p.id,start:p.start,end:p.end}};
  }).filter(n=>n.schedule.at.getTime()>now).slice(0,60);
}
let queue=Promise.resolve();
export function syncReminders() {
  queue=queue.catch(()=>{}).then(async()=>{
    const settings=loadSettings().assistant||{};
    const permission=await LocalNotifications.checkPermissions();
    const pending=(await LocalNotifications.getPending()).notifications;
    if(permission.display!=="granted") { reminderStatus="系统通知未允许，请在设置中开启"; return; }
    const days=loadAllDays();
    for(let i=0;i<=112;i++){const date=addDays(todayISO(),i);days[date]=loadDay(date);}
    const ledger=read();
    const desired=settings.planReminders===false?[]:planNotifications(days,Date.now(),settings.notificationDetails===true,ledger);
    const expected=new Map(desired.map(n=>[n.id,n]));
    const canceled=pending.filter(n=>n.extra?.type==="plan"&&!expected.has(n.id));
    if(canceled.length) await LocalNotifications.cancel({notifications:canceled.map(n=>({id:n.id}))});
    const toSchedule=desired.filter(n=>{
      const existing=pending.find(p=>p.id===n.id);
      return !existing || existing.title!==n.title || existing.body!==n.body;
    });
    if(toSchedule.length) await LocalNotifications.schedule({notifications:toSchedule});
    for(const n of desired) ledger[n.extra.key]={at:n.schedule.at.getTime(),end:n.extra.end};
    localStorage.setItem(LEDGER,JSON.stringify(Object.fromEntries(Object.entries(ledger).filter(([,v])=>v.end>Date.now()-86400000))));
    const delivered=(await LocalNotifications.getDeliveredNotifications()).notifications;
    const stale=delivered.filter(n=>n.extra?.type==="plan" && (!days[n.extra.date]?.blocks?.some(b=>b.isPlan&&b.id===n.extra.planId&&atMinute(n.extra.date,b.startMin)===n.extra.start)||n.extra.end<Date.now()));
    if(stale.length) await LocalNotifications.removeDeliveredNotifications({notifications:stale});
    reminderStatus=settings.planReminders===false?"计划提醒已关闭":`提前 10 分钟提醒 · 已安排最近 ${desired.length} 条`;
  }).catch(()=>{reminderStatus="通知安排失败，可在设置中重试";});
  return queue;
}
export async function requestReminderPermission() {
  const permission=await LocalNotifications.requestPermissions();
  await syncReminders();
  return permission.display==="granted";
}
export async function cancelHabits(habitId) {
  const p=await LocalNotifications.getPending();
  const notifications=p.notifications.filter(n=>n.extra?.type==="habit" && (!habitId || n.extra.habitId===habitId));
  if(notifications.length) await LocalNotifications.cancel({notifications});
}
export async function sendHabitNotification({id,label,eventKey,date,end,delay=1,deadline,attempt=0}) {
  if((await LocalNotifications.checkPermissions()).display!=="granted") return false;
  const pending=(await LocalNotifications.getPending()).notifications.filter(n=>n.extra?.type==="habit");
  const stale=pending.filter(n=>n.extra.deadline<Date.now() || n.extra.habitId===id);
  if(stale.length) await LocalNotifications.cancel({notifications:stale});
  if(pending.length-stale.length>=4) return false;
  await LocalNotifications.schedule({notifications:[{
    id:1500000000+(parseInt(hash(eventKey),16)%100000000), title:"给自己一个小转折", body:label,
    schedule:{at:new Date(Date.now()+delay*1000)},actionTypeId:"HABIT",
    extra:{type:"habit",habitId:id,eventKey,date,end,deadline,attempt},
  }]});
  return true;
}
export async function initReminders({onPlan,onHabit,onResume}) {
  await LocalNotifications.registerActionTypes({types:[
    {id:"PLAN",actions:[{id:"open",title:"查看计划",foreground:true}]},
    {id:"HABIT",actions:[{id:"start",title:"开始",foreground:true},{id:"later",title:"5 分钟后"},{id:"skip",title:"今天不提醒"}]},
  ]});
  await LocalNotifications.addListener("localNotificationActionPerformed",event=>{
    const data=event.notification.extra;
    if(data?.type==="plan") {
      const block=loadDay(data.date).blocks.find(b=>b.isPlan&&b.id===data.planId);
      if(block) onPlan(data.date,data.planId);
    }
    if(data?.type==="habit") onHabit(event.actionId,data);
  });
  await App.addListener("appStateChange",({isActive})=>{if(isActive){syncReminders();onResume();}});
  await syncReminders();
}
