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
const backlogIds=new Set(a.questions.map(q=>q.id));
for(const q of a.questions){
  assert.ok(q.attempts.length||q.status==='proposed',`historical records or explicit proposed status required ${q.id}`);assert.ok(q.nextSteps.length,`no next steps ${q.id}`);assert.ok(q.evidence.length,`uncited item ${q.id}`);
  assert.ok(['research','data','engineering','verification'].includes(q.kind),`unknown backlog kind ${q.id}`);
  assert.ok(['proposed','replication','validation','audit'].includes(q.status),`unknown backlog status ${q.id}`);
  assert.ok(q.kind==='research'?q.status!=='audit':q.status==='audit',`type/status mismatch ${q.id}`);
  assert.match(q.lastDiscussedAt,/^\d{4}-\d{2}-\d{2}$/);assert.equal(q.lastDate,q.lastDiscussedAt,'legacy date follows substantive discussion');
  for(const date of [q.lastDiscussedAt,q.lastProgressAt,q.lastArtifactAt].filter(Boolean)){assert.match(date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(date<=a.meta.end,`date beyond source cutoff ${q.id}`);}
  assert.ok(!q.lastProgressAt||q.lastProgressAt<=q.lastDiscussedAt,`progress later than discussion ${q.id}`);
  assert.ok(q.acceptanceCriteria?.length,`missing independent acceptance criteria ${q.id}`);
  for(const id of q.relatedIds||[]){assert.ok(backlogIds.has(id),`missing related item ${q.id}: ${id}`);assert.notEqual(id,q.id,'no self-related item');}
  for(const id of q.backgroundEvidence||[])assert.ok(a.evidence[id],`missing background evidence ${q.id}: ${id}`);
  const directIds=new Set([...q.evidence,...q.attempts.flatMap(t=>t.evidence||[]),...(q.sections||[]).flatMap(t=>t.evidence||[])]);
  for(const excerpt of q.evidenceExcerpts||[]){assert.ok(directIds.has(excerpt.messageId),`excerpt must belong to direct evidence ${q.id}`);assert.ok(excerpt.text?.trim()&&a.evidence[excerpt.messageId]?.text.includes(excerpt.text),`excerpt differs from preserved source ${q.id}: ${excerpt.messageId}`);}
  for(const section of q.sections||[]){assert.ok(section.title&&section.lastKnown&&section.acceptanceCriteria?.length,`incomplete investigation area ${q.id}`);assert.match(section.lastDiscussedAt,/^\d{4}-\d{2}-\d{2}$/);assert.ok(section.lastDiscussedAt<=q.lastDiscussedAt,`section date later than parent ${q.id}`);}
}
assert.equal(a.backlogReview.status,'implemented','review plan must have been applied');
assert.equal(a.backlogReview.sourceIds.length,38,'all original review entries accounted for');
assert.equal(a.backlogReview.changes.length,38,'each original entry has a migration decision');
for(const id of a.backlogReview.sourceIds){assert.ok(backlogIds.has(id),`legacy route lost ${id}`);assert.ok(a.backlogReview.changes.some(c=>c.oldId===id),`missing migration decision ${id}`);}
for(const change of a.backlogReview.changes)for(const id of change.newIds)assert.ok(backlogIds.has(id),`migration destination missing ${id}`);
assert.deepEqual(new Set(a.backlogReview.changes.flatMap(c=>c.newIds)),backlogIds,'all focused records have a reviewed source entry');
for(const event of a.events)for(const id of event.questionIds||[])assert.ok(backlogIds.has(id),`timeline link missing ${id}`);
for(const p of a.projects){const ds=p.milestones.map(m=>m.date);assert.deepEqual(ds,[...ds].sort(),`chronological milestones ${p.id}`);}
for(const f of a.library){
  assert.ok(f.available&&f.summary?.trim().length>=40,`library entry must have a substantive document summary: ${f.id}`);
  assert.ok(['.docx','.pdf','.pptx','.xlsx','.txt'].includes(f.extension),`unsupported library material: ${f.id}`);
  assert.ok(f.readScope&&/^[a-f0-9]{64}$/.test(f.sourceSha256),'summary must retain its reading scope and source fingerprint');
  assert.ok(a.evidence[f.messageId],`summary source citation missing: ${f.id}`);
  assert.ok(f.versions.every(v=>v.available),'missing documents must not appear in library version lists');
}
assert.equal(new Set(a.library.map(f=>f.sourceSha256)).size,a.library.length,'identical document copies must share one library entry');
const outputCatalog=JSON.parse(await fs.readFile(new URL('../data/output-catalog.json',import.meta.url),'utf8'));
assert.equal(new Set(a.outputs.map(o=>o.id)).size,a.outputs.length,'unique current output ids');
for(const output of a.outputs){
  const link=new URL(output.href);
  assert.equal(link.origin,'https://discipline-network-research.nikepai.com','current outputs use the supplied public platform');
  assert.ok(!link.username&&!link.password&&!link.search&&!link.hash,'plain public output URLs only');
  assert.ok(outputCatalog.paths.includes(link.pathname),`output route absent from the reviewed upstream catalog: ${output.id}`);
  assert.ok(output.projectIds.length&&output.projectIds.every(id=>projects.has(id)),`unknown output project: ${output.id}`);
  assert.ok(output.evidence.length&&output.scope?.trim()&&output.description?.trim(),`output requires matching evidence and scope: ${output.id}`);
  assert.equal(output.id,link.pathname.split('/').at(-1),'stable output id matches route');
}
assert.equal(a.outputs.find(o=>o.id==='openalex-entropy')?.href,'https://discipline-network-research.nikepai.com/charts/openalex-entropy','preserve the supplied OpenAlex chart entry');
assert.ok(!a.outputs.find(o=>o.id==='degree-distributions').evidence.includes('m05272'),'MAG/WM distributions must not replace the historical Wikipedia distribution');
for(const id of ['m00370','m08504','m08510','m08511','m09650'])assert.ok(!a.evidence[id],`private source leaked ${id}`);
for(const [id,m] of Object.entries(a.evidence)){
  assert.ok(!/(?<!\d)1[3-9]\d{9}(?!\d)/.test(m.text.replace(/https?:\/\/[^\s<>]+/g,'')),`unredacted mobile number ${id}`);
  if(m.assets)for(const asset of m.assets)assert.ok(!asset.url||!asset.url.endsWith('.dat'),'encrypted media must never render as a decoded image');
  assert.ok(!/(?:sk-proj-|ghp_|github_pat_)[a-zA-Z0-9_-]{15,}/.test(m.text),`unredacted secret ${id}`);
}
const math=a.questions.find(q=>q.id==='knowledge-consilience-q3');
for(const q of a.questions)assert.equal(new Set(q.attempts.map(t=>t.text)).size,q.attempts.length,`duplicate attempts ${q.id}`);
assert.ok(math.attempts.some(t=>t.evidence.includes('m00340')),'preserve 2019 preliminary answer');
assert.ok(math.evidence.includes('m10010'),'preserve 2026 reopened question');
assert.equal(math.lastDiscussedAt,'2026-04-28','unlinked encrypted media must not refresh research date');
assert.equal(math.lastProgressAt,'2019-09-04','preserve the preliminary answer as progress');
assert.ok(!math.evidence.includes('m10011'),'unconfirmed image must not be evidence for the deletion experiment');
console.log(`OK: ${a.projects.length} projects, ${a.events.length} events, ${a.questions.filter(q=>q.kind==='research').length} research questions, ${a.questions.filter(q=>q.kind!=='research').length} related audits, ${citations} citations, ${files} asset links, ${a.outputs.length} current output links`);
