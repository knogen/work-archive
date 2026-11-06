const stop = new Set(['什么','哪些','怎么','如何','是否','这个','那个','我们','你们','一个','一下','目前','现在','相关','关于','以及','进行','已经','还有','工作','项目','情况','进展','总结','讨论','主要','后来','当时','截至','最后','最新','资料','记录','问题','的','了','在','和','与','是','有','the','and','what','how','in','of']);
export function terms(text) {
  const value = String(text || '').normalize('NFKC').toLowerCase();
  const result = new Set(value.match(/[a-z][a-z0-9+._-]{1,}|\d{4}/g) || []);
  for (const run of value.match(/[\p{Script=Han}]+/gu) || []) {
    for (let n=2;n<=3;n++) for(let i=0;i<=run.length-n;i++) {
      const term=run.slice(i,i+n); if(!stop.has(term))result.add(term);
    }
  }
  return [...result].filter(x=>!stop.has(x));
}

export function buildPostings(nodes) {
  const postings = Object.create(null);
  for (const node of nodes) for (const term of terms(`${node.title} ${node.keywords.join(' ')} ${node.text}`).slice(0,1600)) {
    (postings[term] ||= []).push(node.id);
  }
  return postings;
}

const monthEnd=(year,month)=>new Date(Date.UTC(Number(year),Number(month),0)).toISOString().slice(0,10);
export function parseTime(question, cutoff) {
  const normalized=String(question).normalize('NFKC');
  const yearRange=normalized.match(/\b((?:19|20)\d{2})\s*年?\s*(?:至|到|—|–|~|～|-)\s*((?:19|20)\d{2})\s*年?/);
  if(yearRange){const years=[yearRange[1],yearRange[2]].sort();return {from:`${years[0]}-01-01`,to:`${years[1]}-12-31`,years:[...new Set(years)],explicit:true};}
  const values=[...normalized.matchAll(/\b((?:20|19)\d{2})(?!\d)(?:\s*(?:年|[-/])\s*(1[0-2]|0?[1-9])(?!\d)(?:\s*(?:月|[-/])\s*(3[01]|[12]\d|0?[1-9])(?!\d)\s*日?)?)?/g)].filter(m=>!/(?:复现|重现|重做|复核|重复)\s*$/.test(normalized.slice(0,m.index)));
  if(values.length){
    const dates=values.map(m=>({year:m[1],month:m[2],day:m[3]}));
    const from=x=>`${x.year}-${x.month?x.month.padStart(2,'0'):'01'}-${x.day?x.day.padStart(2,'0'):'01'}`;
    const to=x=>x.day?from(x):x.month?monthEnd(x.year,x.month):`${x.year}-12-31`;
    const starts=dates.map(from).sort(),ends=dates.map(to).sort();
    return {from:starts[0],to:ends.at(-1),years:[...new Set(dates.map(x=>x.year))],explicit:true};
  }
  const relative=question.match(/去年|今年|前年/);
  if(relative) { const year=String(Number(cutoff.slice(0,4))-(relative[0]==='去年'?1:relative[0]==='前年'?2:0));return {from:`${year}-01-01`,to:`${year}-12-31`,years:[year],explicit:true,relativeToCutoff:true}; }
  return {explicit:false,years:[]};
}

function topicMatches(question,topic) {
  const value=question.normalize('NFKC').toLowerCase();
  return [topic.title,...topic.keywords,...(topic.aliases||[])].some(k=>{
    if(typeof k!=='string'||k.length<2)return false;
    const lower=k.normalize('NFKC').toLowerCase();
    // Short Latin tags such as MAG/Core match whole identifiers, not substrings.
    if(/^[a-z0-9+._-]+$/.test(lower))return value.split(/[^a-z0-9+._-]+/).includes(lower);
    return value.includes(lower);
  });
}

export function retrieve(corpus, question, context={}, limit=10) {
  if(/密码|口令|手机号|私人电话|家庭住址|身份证|api[ _-]?key|secret[ _-]?key|私钥|银行卡|微信号/i.test(question))return {nodes:[],evidence:[],time:{explicit:false,years:[]},topicIds:[],matched:false,trace:[{phase:'parse',step:'parse',label:'检查资料边界',status:'done',count:0,restricted:true},{phase:'evidence',step:'evidence',label:'私人信息不进入问答召回',status:'done',count:0,evidenceIds:[]}]};
  const query=terms(question), time=parseTime(question,corpus.meta.cutoff), byId=new Map(corpus.nodes.map(n=>[n.id,n]));
  const scores=new Map(), lexical=new Set(),matchedTerms=new Map();
  for (const term of query) {
    const hits=Object.hasOwn(corpus.postings,term)?corpus.postings[term]:[], weight=1+Math.log(1+corpus.nodes.length/(hits.length+1));
    for(const id of hits) {scores.set(id,(scores.get(id)||0)+weight);lexical.add(id);matchedTerms.set(id,(matchedTerms.get(id)||0)+1);}
  }
  const explicitTopics=corpus.topics.filter(t=>topicMatches(question,t));
  const topicIds=new Set(explicitTopics.map(t=>t.id));
  if(!topicIds.size&&context.projectId&&corpus.topics.some(t=>t.id===context.projectId))topicIds.add(context.projectId);
  if(context.questionId&&byId.has(`question:${context.questionId}`)){
    const node=byId.get(`question:${context.questionId}`); for(const id of node.topicIds)if(!explicitTopics.length)topicIds.add(id);
    if(!explicitTopics.length&&!time.explicit)scores.set(node.id,(scores.get(node.id)||0)+15);
  }
  const timeIds = time.explicit ? new Set(corpus.time.flatMap(y=>y.months.filter(m=>m.month>=time.from.slice(0,7)&&m.month<=time.to.slice(0,7)).flatMap(m=>m.nodeIds))) : null;
  const general=/做了什么|主要.*工作|总结|概况|概览|哪些.*(?:成果|工作)|发生了什么/.test(question);
  const latest=/最后|最新|最近|进展|状态|待验证|待续|当前|尚未/.test(question);
  let afterTime=0,afterTopic=0;
  for(const node of corpus.nodes) {
    if(timeIds&&(!timeIds.has(node.id)||node.date<time.from||node.date>time.to)){scores.delete(node.id);continue;}
    afterTime++;
    const topicMatch=node.topicIds.some(id=>topicIds.has(id));
    if(explicitTopics.length&&!topicMatch){scores.delete(node.id);continue;}
    afterTopic++;
    if(topicMatch)scores.set(node.id,(scores.get(node.id)||0)+5);
    if(timeIds&&general)scores.set(node.id,(scores.get(node.id)||0)+3);
    if(!scores.has(node.id))continue;
    const title=node.title.toLowerCase();
    for(const term of query)if(title.includes(term))scores.set(node.id,scores.get(node.id)+2);
    const kindWeight=latest?{project:4,question:8,event:2,document:0,output:0,evidence:0}:{project:2,question:3,event:3,document:1,output:0,evidence:0};
    scores.set(node.id,scores.get(node.id)+(kindWeight[node.kind]||0));
    if(general&&time.explicit)scores.set(node.id,scores.get(node.id)+({event:16,question:7,document:-8,project:0,output:0,evidence:0}[node.kind]||0));
    if(latest&&node.kind==='question')scores.set(node.id,scores.get(node.id)+Math.max(0,(Number(node.date.slice(0,4))-2018)*0.3));
  }
  let ranked=[...scores].filter(([id])=>byId.has(id)).sort((a,b)=>b[1]-a[1]||byId.get(b[0]).date.localeCompare(byId.get(a[0]).date));
  // Unknown words must not become a confident match merely through page context.
  if(!lexical.size&&!explicitTopics.length&&!time.explicit&&!context.questionId)ranked=[];
  if(!explicitTopics.length&&!time.explicit&&!context.questionId)ranked=ranked.filter(([id])=>(matchedTerms.get(id)||0)>=Math.min(2,query.length));
  const nodes=[],seen=new Set(),monthCounts=new Map();
  for(const [id] of ranked) {
    const node=byId.get(id);if(seen.has(id))continue;
    const month=node.date.slice(0,7), count=monthCounts.get(month)||0;
    if(general&&time.explicit&&count>=2)continue;
    nodes.push(node);seen.add(id);monthCounts.set(month,count+1);if(nodes.length>=limit)break;
  }
  const evidenceIds=[...new Set(nodes.flatMap(n=>n.evidenceIds))].filter(id=>corpus.evidence[id]);
  const eligibleEvidence=evidenceIds.map(id=>corpus.evidence[id]).filter(e=>!time.explicit||(e.date.slice(0,10)>=time.from&&e.date.slice(0,10)<=time.to));
  const evidence=eligibleEvidence.slice(0,18);
  const trace=[
    {step:'parse',label:'解析问题',status:'complete',time:time.explicit?{from:time.from,to:time.to,relativeToCutoff:!!time.relativeToCutoff}:null,topicIds:[...topicIds]},
    {step:'lexical',label:'检索关键词索引',status:'complete',matchedTerms:query.filter(t=>Object.hasOwn(corpus.postings,t)).length,candidateCount:lexical.size},
    {step:'time',label:'召回时间树',status:'complete',active:time.explicit,candidateCount:afterTime},
    {step:'topic',label:'召回主题树',status:'complete',active:topicIds.size>0,explicit:explicitTopics.length>0,candidateCount:afterTopic,topics:corpus.topics.filter(t=>topicIds.has(t.id)).map(t=>({id:t.id,title:t.title}))},
    {step:'rank',label:'合并排序与去重',status:'complete',candidateCount:ranked.length,selectedCount:nodes.length,nodes:nodes.map(n=>({id:n.id,title:n.title,date:n.date,kind:n.kind}))},
    {step:'evidence',label:'读取可引用证据',status:'complete',candidateCount:eligibleEvidence.length,selectedCount:evidence.length,evidenceIds:evidence.map(e=>e.id)},
  ];
  for(const item of trace){item.phase=item.step;item.status='done';item.count=item.selectedCount??item.candidateCount??null;}
  return {nodes,evidence,time,topicIds:[...topicIds],matched:nodes.length>0,trace};
}

export function citationCandidates(result) {
  const refs=[];
  for(const node of result.nodes)refs.push({id:node.id,title:node.title,date:node.date,href:node.href,kind:node.kind});
  for(const ev of result.evidence)refs.push({id:ev.id,title:`原文证据 ${ev.id}`,date:ev.date,href:`#/evidence/${ev.id}`,kind:'evidence'});
  return refs;
}
