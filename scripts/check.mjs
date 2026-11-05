import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const raw=await fs.readFile(new URL('../data/archive.json',import.meta.url),'utf8');
const a=JSON.parse(raw);
const script=await fs.readFile(new URL('../data/archive.js',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(script.replace(/^window.WORK_ARCHIVE = /,'').replace(/;\s*$/,'')),a,'JSON and browser data must match');
const projects=new Set(a.projects.map(p=>p.id));
assert.equal(projects.size,a.projects.length,'unique project ids');
assert.equal(new Set(a.questions.map(q=>q.id)).size,a.questions.length,'unique question ids');
let citations=0,files=0;
async function walk(x){
  if(Array.isArray(x)){for(const v of x)await walk(v);return;}
  if(!x||typeof x!=='object')return;
  for(const [k,v]of Object.entries(x)){
    if(k==='evidence'&&Array.isArray(v)){for(const id of v){assert.ok(a.evidence[id],`missing citation ${id}`);citations++;}}
    else if(k==='projectId'&&v)assert.ok(projects.has(v),`missing project ${v}`);
    else if(k==='url'&&v){assert.match(v,/^assets\/[a-zA-Z0-9._-]+$/,'safe local asset path');await fs.access(new URL('../'+v,import.meta.url));files++;}
    else await walk(v);
  }
}
await walk(a);
for(const event of a.events){assert.match(event.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(event.evidence.length,`uncited event ${event.title}`);}
for(const q of a.questions){assert.ok(q.attempts.length,`no attempts ${q.id}`);assert.ok(q.nextSteps.length,`no next steps ${q.id}`);assert.ok(q.evidence.length,`uncited question ${q.id}`);}
for(const p of a.projects){const ds=p.milestones.map(m=>m.date);assert.deepEqual(ds,[...ds].sort(),`chronological milestones ${p.id}`);}
for(const id of ['m00370','m08504','m08510','m08511','m09650'])assert.ok(!a.evidence[id],`private source leaked ${id}`);
for(const [id,m] of Object.entries(a.evidence)){
  assert.ok(!/(?<!\d)1[3-9]\d{9}(?!\d)/.test(m.text.replace(/https?:\/\/[^\s<>]+/g,'')),`unredacted mobile number ${id}`);
  if(m.assets)for(const asset of m.assets)assert.ok(!asset.url||!asset.url.endsWith('.dat'),'encrypted media must never render as a decoded image');
  assert.ok(!/(?:sk-proj-|ghp_|github_pat_)[a-zA-Z0-9_-]{15,}/.test(m.text),`unredacted secret ${id}`);
}
const math=a.questions.find(q=>q.title.includes('去掉代数'));
for(const q of a.questions)assert.equal(new Set(q.attempts.map(t=>t.text)).size,q.attempts.length,`duplicate attempts ${q.id}`);
assert.ok(math.attempts.some(t=>t.evidence.includes('m00340')),'preserve 2019 preliminary answer');
assert.ok(math.evidence.includes('m10010'),'preserve 2026 reopened question');
console.log(`OK: ${a.projects.length} projects, ${a.events.length} events, ${a.questions.length} questions, ${citations} citations, ${files} asset links`);
