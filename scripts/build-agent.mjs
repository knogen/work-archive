import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createSanitizer} from '../agent/shared/privacy.mjs';
import {buildPostings} from '../agent/shared/retrieval.mjs';

const root=new URL('../',import.meta.url);
export async function buildAgent({sourceUrl=new URL('data/archive.json',root),publicPolicyUrl=new URL('agent/privacy-policy.json',root),privatePolicyUrl=new URL('.local/agent-privacy.json',root),outputUrl=new URL('.local/agent-release/',root),quiet=false}={}){
const out=outputUrl,source=await fs.readFile(sourceUrl,'utf8'),archive=JSON.parse(source);
const publicPolicy=JSON.parse(await fs.readFile(publicPolicyUrl,'utf8'));
let privatePolicy={};try{privatePolicy=JSON.parse(await fs.readFile(privatePolicyUrl,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const policy={};for(const key of ['excludedEvidenceIds','excludedRecordIds','privateTerms']){
  for(const sourcePolicy of [publicPolicy,privatePolicy])if(sourcePolicy[key]!==undefined&&(!Array.isArray(sourcePolicy[key])||sourcePolicy[key].some(x=>typeof x!=='string')))throw Error(`Invalid privacy policy field: ${key}`);
  policy[key]=[...(publicPolicy[key]||[]),...(privatePolicy[key]||[])];
}
const topicAliases={...(publicPolicy.topicAliases||{}),...(privatePolicy.topicAliases||{})};
const excluded=new Set(policy.excludedEvidenceIds),blocked=new Set(policy.excludedRecordIds);
const rawRefs=items=>[...new Set((items||[]).flatMap(x=>typeof x==='string'?[x]:x.evidence||[]))];
const blockedRecord=id=>blocked.has(id)||blocked.has(id.split(':').slice(1).join(':'));
// Blocking a record also blocks its source messages. Other summaries referencing
// those sources are omitted, so excluded text cannot reappear via another tree.
for(const id of Object.keys(archive.evidence))if(blockedRecord(`evidence:${id}`))excluded.add(id);
const sourceRecords=[
  ...archive.questions.map(q=>({id:`question:${q.id}`,evidence:rawRefs([...(q.evidence||[]),...(q.attempts||[]),...(q.sections||[])])})),
  ...archive.events.map((e,i)=>({id:`event:${i}`,evidence:e.evidence||[]})),
  ...archive.library.map(f=>({id:`document:${f.id}`,evidence:[f.messageId]})),
  ...(archive.outputs||[]).map(o=>({id:`output:${o.id}`,evidence:o.evidence||[]})),
  ...archive.projects.map(p=>({id:`project:${p.id}`,evidence:rawRefs([...(p.achievements||[]),...(p.milestones||[])])})),
];
for(const record of sourceRecords)if(blockedRecord(record.id))for(const id of record.evidence)excluded.add(id);
const sanitizer=createSanitizer({...policy,authors:Object.values(archive.evidence).map(e=>e.author)}),safe=sanitizer.text;
const unique=xs=>[...new Set(xs.filter(Boolean))],evidence={},nodes=[],topicRefs=new Map();
const refs=items=>unique((items||[]).flatMap(x=>typeof x==='string'?[x]:x.evidence||[])).filter(id=>archive.evidence[id]&&!excluded.has(id));
const kinds={research:'研究验证',data:'数据与方法核验',engineering:'工程与产品验收',verification:'成果与技术材料核验'};
const statuses={proposed:'提出，待验证',replication:'旧结果待复现',validation:'已有进展，待验证',audit:'待核验'};
const add=node=>{
  if(blockedRecord(node.id)||rawRefs(node.evidenceIds).some(id=>excluded.has(id)))return;
  const clean={...node,title:safe(node.title),text:safe(node.text),keywords:(node.keywords||[]).map(safe),evidenceIds:refs(node.evidenceIds),topicIds:unique(node.topicIds||[])};
  nodes.push(clean);
  for(const id of clean.evidenceIds){const topics=topicRefs.get(id)||new Set();for(const topic of clean.topicIds)topics.add(topic);topicRefs.set(id,topics);}
};
for(const q of archive.questions)add({id:`question:${q.id}`,kind:'question',title:q.title,date:q.lastDiscussedAt||q.lastDate,topicIds:[q.projectId],keywords:[q.topicTitle,kinds[q.kind]],href:`#/question/${q.id}`,evidenceIds:rawRefs([...(q.evidence||[]),...(q.attempts||[]),...(q.sections||[])]),text:[`事项类型：${kinds[q.kind]||q.kind}；状态：${statuses[q.status]||q.status}`,`最后讨论：${q.lastDiscussedAt||q.lastDate}；最后实质进展：${q.lastProgressAt||'未单列'}；材料日期：${q.lastArtifactAt||'未单列'}`,`最后已知状态：${q.lastKnown}`,...q.attempts.map(a=>`已有尝试：${a.text}`),...(q.sections||[]).map(s=>`${s.title}：${s.lastKnown}`),...q.acceptanceCriteria.map(s=>`验收条件：${s}`),...q.nextSteps.map(s=>`建议（未执行）：${typeof s==='string'?s:s.text}`)].join('\n')});
for(const [i,e]of archive.events.entries())add({id:`event:${i}`,kind:'event',title:e.title,date:e.date.slice(0,10),topicIds:[e.projectId],keywords:[e.status],href:e.projectId?`#/project/${e.projectId}`:`#/timeline?year=${e.date.slice(0,4)}`,evidenceIds:e.evidence,text:`${e.detail}\n阶段标记：${e.status||'历史记录'}`});
for(const f of archive.library)if(f.summary?.trim())add({id:`document:${f.id}`,kind:'document',title:f.name,date:f.date.slice(0,10),topicIds:f.projectIds,keywords:[f.extension],href:`#/library/${f.id}`,evidenceIds:[f.messageId],text:[f.summary,...(f.keyPoints||[]),`阅读范围：${f.readScope||'未单列'}`,f.summaryCaveat||''].join('\n')});
for(const o of archive.outputs||[])add({id:`output:${o.id}`,kind:'output',title:o.title,date:archive.meta.end,timeline:false,topicIds:o.projectIds,keywords:[],href:o.projectIds[0]?`#/project/${o.projectIds[0]}`:'#/projects',evidenceIds:o.evidence,text:`${o.description}\n范围：${o.scope}\n当前图表入口（非历史进展日期）：${o.href}`});
for(const p of archive.projects){const ids=rawRefs([...(p.achievements||[]),...(p.milestones||[])]);add({id:`project:${p.id}`,kind:'project',title:p.title,date:ids.filter(id=>archive.evidence[id]).map(id=>archive.evidence[id].date.slice(0,10)).sort().at(-1)||archive.meta.end,timeline:false,topicIds:[p.id],keywords:p.tags,href:`#/project/${p.id}`,evidenceIds:ids,text:[p.summary,`历史范围：${p.period}`,p.caveat,...p.achievements.map(a=>`已有成果：${a.text}`)].join('\n')});}
// Evidence is shared by both trees. No sender, file path, attachment URL, or raw export line is published.
for(const [id,e]of Object.entries(archive.evidence))if(!excluded.has(id)&&!blocked.has(id)&&!blocked.has(`evidence:${id}`)){
  evidence[id]={id,date:e.date.slice(0,19),text:safe(e.text)};
  if(evidence[id].text.replace(/\[[^\]]*(?:未解密|缺失|未转写|未核实|附件|隐去|已移除)[^\]]*\]/g,'').trim().length<4)continue;
  add({id:`evidence:${id}`,kind:'evidence',title:`原文证据 ${id}`,date:e.date.slice(0,10),topicIds:[...(topicRefs.get(id)||[])],keywords:[],href:`#/evidence/${id}`,evidenceIds:[id],text:evidence[id].text});
}
for(const node of nodes)node.evidenceIds=node.evidenceIds.filter(id=>evidence[id]);
const topics=archive.projects.filter(p=>!blockedRecord(`project:${p.id}`)).map(p=>({id:p.id,title:safe(p.title),keywords:p.tags.map(safe),aliases:(topicAliases[p.id]||[]).map(safe),nodeIds:nodes.filter(n=>n.topicIds.includes(p.id)).map(n=>n.id)}));
const independent=nodes.filter(n=>!n.topicIds.length).map(n=>n.id);
if(independent.length)topics.push({id:'independent',title:'独立事项与参考资料',keywords:[],nodeIds:independent});
const months=new Map();for(const n of nodes){const month=n.date.slice(0,7);if(!/^\d{4}-\d{2}$/.test(month))throw Error(`Invalid date: ${n.id}`);if(n.timeline===false)continue;(months.get(month)||months.set(month,[]).get(month)).push(n.id);}
const years=unique([...months.keys()].map(m=>m.slice(0,4))).sort();
const body={schemaVersion:1,meta:{cutoff:archive.meta.end,start:archive.meta.start,sourceSha256:createHash('sha256').update(source).digest('hex'),limitations:archive.meta.limitations.map(safe),scope:'仅现有已审阅工作摘录与文档摘要；未读取原始群聊、附件全文、图片或语音。'},topics,time:years.map(year=>({year,months:[...months].filter(([m])=>m.startsWith(year)).sort(([a],[b])=>a.localeCompare(b)).map(([month,nodeIds])=>({month,nodeIds}))})),nodes,evidence,postings:buildPostings(nodes)};
const version=createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0,20),corpus={...body,version};
const report={version,schemaVersion:1,source:'data/archive.json',sourceSha256:body.meta.sourceSha256,scope:body.meta.scope,counts:{nodes:nodes.length,evidence:Object.keys(evidence).length,topics:topics.length,months:months.size},redactions:sanitizer.counts,excludedEvidence:unique([...excluded]),excludedRecords:unique(policy.excludedRecordIds),limitations:['规则脱敏不能保证识别所有间接身份信息，发布前仍需复核。','原附件未进入本次问答语料，未审计其正文或图像。','现有静态站点的数据与附件未被此构建命令改写。']};
await fs.mkdir(out,{recursive:true});
await fs.writeFile(new URL('corpus.json',out),JSON.stringify(corpus));
await fs.writeFile(new URL('privacy-report.json',out),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(new URL('kv-upload.json',out),JSON.stringify([{key:`corpus:${version}`,value:JSON.stringify(corpus)}]));
if(!quiet)console.log(JSON.stringify({version,...report.counts,redactions:report.redactions,output:'.local/agent-release/ (private; excluded from static build)'}));
return {corpus,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await buildAgent();
