import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildAgent} from '../../scripts/build-agent.mjs';
import {retrieve,parseTime,buildPostings,citationCandidates} from '../shared/retrieval.mjs';

const directory=await fs.mkdtemp(path.join(os.tmpdir(),'archive-agent-eval-'));
let corpus;
try{({corpus}=await buildAgent({outputUrl:pathToFileURL(directory+path.sep),quiet:true}));}finally{await fs.rm(directory,{recursive:true,force:true});}
const cases=JSON.parse(await fs.readFile(new URL('retrieval-eval.json',import.meta.url),'utf8'));

test('date parsing covers leap months, days, ranges, relative dates, and historical references',()=>{
  assert.equal(parseTime('2024年2月','2026-05-06').to,'2024-02-29');
  assert.equal(parseTime('2022年2月','2026-05-06').to,'2022-02-28');
  assert.equal(parseTime('2022-2024','2026-05-06').from,'2022-01-01');
  assert.equal(parseTime('2022-2024','2026-05-06').to,'2024-12-31');
  assert.equal(parseTime('2020-2022','2026-05-06').from,'2020-01-01');
  assert.equal(parseTime('2022年2023年','2026-05-06').to,'2023-12-31');
  assert.equal(parseTime('2022年至2023年','2026-05-06').to,'2023-12-31');
  assert.equal(parseTime('2024-02-29','2026-05-06').from,'2024-02-29');
  assert.equal(parseTime('2022年1月至2023年3月','2026-05-06').to,'2023-03-31');
  assert.equal(parseTime('2026年4月28日','2026-05-06').from,'2026-04-28');
  assert.equal(parseTime('今年','2026-05-06').relativeToCutoff,true);
  assert.equal(parseTime('复现2019年实验','2026-05-06').explicit,false);
});

for(const item of cases)test(`real archive recall: ${item.id}`,()=>{
  const result=retrieve(corpus,item.question,item.context||{});
  if(item.noMatch)assert.equal(result.matched,false,`${item.id}: expected no evidence`);
  else assert.equal(result.matched,true,`${item.id}: expected a recall`);
  if(item.minNodes)assert.ok(result.nodes.length>=item.minNodes);
  if(item.topic){assert.ok(result.topicIds.includes(item.topic));assert.ok(result.nodes.every(n=>n.topicIds.includes(item.topic)||result.topicIds.some(t=>n.topicIds.includes(t))));}
  if(item.expectedIds)assert.ok(result.nodes.some(n=>item.expectedIds.includes(n.id)),`${item.id}: expected an archived question or event`);
  if(item.firstKind)assert.equal(result.nodes[0]?.kind,item.firstKind);
  if(item.from){assert.equal(result.time.from,item.from);assert.equal(result.time.to,item.to);for(const node of result.nodes)assert.ok(node.date>=item.from&&node.date<=item.to);for(const e of result.evidence)assert.ok(e.date.slice(0,10)>=item.from&&e.date.slice(0,10)<=item.to);}
  assert.equal(new Set(result.nodes.map(n=>n.id)).size,result.nodes.length);
  const candidates=citationCandidates(result);assert.ok(candidates.every(c=>/^#\//.test(c.href)));
  assert.ok(result.trace.every(step=>step.phase&&step.label&&step.status==='done'));
  for(const stage of result.trace)for(const node of stage.nodes||[])assert.deepEqual(Object.keys(node).sort(),['date','id','kind','title']);
  assert.ok(!JSON.stringify(result.trace).includes('"text":'));
});

test('postings safely handles object prototype words',()=>{
  const postings=buildPostings([{id:'node-1',title:'constructor prototype tostring',text:'',keywords:[]}]);
  assert.deepEqual(postings.constructor,['node-1']);
  assert.ok(Object.hasOwn(postings,'prototype'));
});

test('all evidence and tree references resolve to the same sanitized corpus',()=>{
  const nodes=new Map(corpus.nodes.map(n=>[n.id,n]));
  for(const t of corpus.topics)for(const id of t.nodeIds)assert.ok(nodes.has(id));
  for(const y of corpus.time)for(const m of y.months)for(const id of m.nodeIds)assert.ok(nodes.has(id));
  for(const n of corpus.nodes)for(const id of n.evidenceIds)assert.ok(corpus.evidence[id]);
  assert.equal(cases.length,30);
});
