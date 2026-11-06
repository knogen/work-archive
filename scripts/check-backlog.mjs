import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const a=JSON.parse(await fs.readFile(new URL('../data/archive.json',import.meta.url),'utf8'));
const nodes=new Map(),listeners={};
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',dataset:{},classList:{add(){},remove(){}},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},offsetWidth:0});return nodes.get(id);};
const location={hash:'#/'};
const sandbox={URL,URLSearchParams,Set,Blob,setTimeout,location,navigator:{},document:{body:{dataset:{}},querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){listeners[type]=fn;},getElementById:()=>null},history:{replaceState(_,__,value){location.hash=value;}},window:{WORK_ARCHIVE:a,addEventListener(){},scrollTo(){}}};
const source=(await fs.readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/\}\)\(\);\s*$/,'globalThis.ui={route,filterIssues,question,prompt,home,project,search,directEvidenceIds};})();');
vm.runInNewContext(source,sandbox);
const {ui}=sandbox,byId=new Map(a.questions.map(q=>[q.id,q]));
const cardIds=html=>[...html.matchAll(/href="#\/question\/([^"#?]+)" class="issue-card"/g)].map(m=>m[1]);
function validateList(kind,project='',query=''){
  node('#issue-kind').value=kind;node('#issue-project').value=project;node('#issue-search').value=query;ui.filterIssues();
  const result=cardIds(node('#issue-list').innerHTML);
  const expected=a.questions.filter(q=>(kind==='all'||(kind==='tasks'?q.kind!=='research':q.kind===kind))&&(!project||(project==='minor'?!q.projectId:q.projectId===project))&&JSON.stringify(q).toLowerCase().includes(query.toLowerCase()));
  assert.deepEqual(new Set(result),new Set(expected.map(q=>q.id)),'filter must include exactly the relevant records');
  for(let i=1;i<result.length;i++)assert.ok(byId.get(result[i-1]).lastDiscussedAt>=byId.get(result[i]).lastDiscussedAt,'discussion dates descend');
  return result;
}
for(const kind of ['research','data','engineering','verification','tasks','all'])for(const project of ['',...a.projects.map(p=>p.id),'minor'])validateList(kind,project);
assert.equal(validateList('research')[0],'knowledge-consilience-q3','reopened 2026 experiment leads the research list');
validateList('all','','本体');validateList('research','','GPC');

for(const id of a.backlogReview.sourceIds){location.hash=`#/question/${id}`;ui.route();assert.ok(!node('#main').innerHTML.includes('这份档案暂不存在'),'all old routes remain accessible');}
for(const q of a.questions){
  const html=ui.question(q),pack=ui.prompt(q);
  assert.ok(html.includes('后续验收条件')&&html.includes('最近讨论')&&html.includes('最后实质进展'));
  assert.ok(pack.includes('\n\n##')&&!pack.includes('\\n\\n##'),'export uses actual Markdown line breaks');
  for(const excerpt of q.evidenceExcerpts||[])assert.ok(pack.includes(excerpt.text),'export includes the scoped source excerpt');
  for(const id of q.relatedIds||[])assert.ok(html.includes(`href="#/question/${id}"`),'related record links work');
}
const ontology=byId.get('metapedia-ontology-q1');
assert.equal(ontology.kind,'research');assert.equal(ontology.lastDiscussedAt,'2023-03-13');
assert.ok(!ui.directEvidenceIds(ontology).includes('m07650')&&!ui.directEvidenceIds(ontology).includes('m07651'),'patent disclosure is separate from migration quality');
assert.equal(byId.get('metapedia-ontology-q1-product-audit').kind,'engineering');
assert.equal(byId.get('metapedia-ontology-q1-technical-disclosure').kind,'verification');
assert.equal(byId.get('network-entropy-kqi-q2').lastDiscussedAt,'2025-06-20');
assert.equal(byId.get('network-entropy-kqi-q2').lastArtifactAt,'2025-07-17');
const mathEvent=a.events.find(e=>e.evidence.includes('m10010'));
assert.ok(mathEvent.questionIds.includes('knowledge-consilience-q3'));
assert.ok(ui.question(byId.get('knowledge-consilience-q3')).includes('对应时间线'));

location.hash='#/questions?kind=engineering&project=minor';ui.route();
assert.equal(node('#issue-kind').value,'engineering');assert.equal(node('#issue-project').value,'minor');
await listeners.click({target:{closest:()=>({dataset:{reset:'questions'},hasAttribute:()=>false})}});
assert.equal(node('#issue-kind').value,'research');assert.equal(node('#issue-project').value,'');
assert.ok(cardIds(node('#issue-list').innerHTML).every(id=>byId.get(id).kind==='research'),'reset restores research view');
node('#global-search').value='本体';ui.search();
assert.ok(node('#search-results').innerHTML.includes('#/question/metapedia-ontology-q1-technical-disclosure'),'search can find related verification tasks');
for(const p of a.projects){const ids=cardIds(ui.project(p));assert.deepEqual(new Set(ids),new Set(a.questions.filter(q=>q.projectId===p.id).map(q=>q.id)),'project pages retain research and related tasks');}
assert.equal(JSON.parse(await fs.readFile(new URL('../data/archive.json',import.meta.url),'utf8')).questions.length,a.questions.length,'view operations do not alter saved data');
console.log(`Backlog UI OK: ${a.backlogReview.sourceIds.length} legacy routes, ${a.questions.length} focused records, typed filters, dates, scoped exports, related tasks, timeline links and search.`);
