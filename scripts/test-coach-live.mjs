// Opt-in paid API smoke test. Uses only synthetic records, never the user's diary.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

if (!process.argv.includes("--run")) {
  console.log("Use --run to make one real, billable analysis request with synthetic records.");
  process.exit(0);
}
const token=execFileSync("/usr/bin/security",["find-generic-password","-s","com.rihou.coach.personal-access","-a","menxuanmo","-w"],{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:10000}).trim();
assert.ok(token.length>=32,"Missing personal service access code");
const time=s=>Date.parse(`${s}+08:00`);
const block=(id,start,end,kind,name)=>({id,start:time(start),end:time(end),kinds:[kind],name});
const payload={mode:"yesterday",date:"2026-09-18",timeZone:"Asia/Shanghai",boundaryKnown:true,ageGroup:"adult",summary:{invest:180,sleep:450,consume:45,rest:765},blocks:[
  block("demo-1","2026-09-18T07:00:00","2026-09-18T07:30:00","MEAL","早餐"),
  block("demo-2","2026-09-18T07:30:00","2026-09-18T08:15:00","SCROLL","早餐后刷短视频"),
  block("demo-3","2026-09-18T08:15:00","2026-09-18T10:15:00","STUDY","学习"),
  block("demo-4","2026-09-18T10:15:00","2026-09-18T11:15:00","READ","读书"),
  block("demo-5","2026-09-18T11:15:00","2026-09-18T23:30:00","REST","休息与日常活动"),
  block("demo-6","2026-09-18T23:30:00","2026-09-19T07:00:00","SLEEP","昨晚睡眠"),
],plans:[{name:"学习",start:time("2026-09-18T08:00:00"),end:time("2026-09-18T10:00:00"),actualStart:time("2026-09-18T08:15:00")}]};
const started=Date.now();
const response=await fetch("https://rihou-coach.menxuanmo.workers.dev/analyze",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,Origin:"capacitor://localhost"},body:JSON.stringify(payload),signal:AbortSignal.timeout(65000)});
const analysis=await response.json();
assert.equal(response.status,200,`Analysis failed: ${analysis.error||response.status}`);
assert.equal(response.headers.get("access-control-allow-origin"),"capacitor://localhost");
assert.equal(typeof analysis.summary,"string");
assert.ok(Array.isArray(analysis.events));
for(const event of analysis.events){
  const record=payload.blocks.find(b=>b.id===event.recordId);
  assert.ok(record,"Unknown record in analysis");
  assert.ok(event.observation.endsWith(`${(record.end-record.start)/60000}分钟`),"Fact duration mismatch");
  assert.ok(Array.isArray(event.sources));
}
console.log(JSON.stringify({status:response.status,seconds:(Date.now()-started)/1000,syntheticOnly:true,analysis},null,2));
