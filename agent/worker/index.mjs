import {ApiError,json,config,modelConfig,readJson,costMicros} from './config.mjs';
import {retrieve,citationCandidates} from '../shared/retrieval.mjs';
import {createSanitizer} from '../shared/privacy.mjs';
import {sseFrame} from '../shared/sse.mjs';
import {countInput,generate,promptFor} from './openai.mjs';
export {BudgetLedger} from './budget.mjs';

const messages={daily_budget:'今日问答预算已用完，北京时间零点恢复。你仍可使用站内搜索。',user_daily:'你今天的问答次数已用完，请明天再来。',rate_limit:'提问较频繁，请稍后再试。',concurrency:'当前问答人数较多，请稍后再试。'};
let cachedCorpus=null;
async function corpusFor(env) {
  const key=String(env.CORPUS_VERSION||'');
  if(!/^[a-f0-9]{20}$/.test(key)||!env.ARCHIVE_CORPUS)throw new ApiError(503,'configuration','问答资料尚未发布。');
  if(cachedCorpus?.version===key)return cachedCorpus;
  const corpus=await env.ARCHIVE_CORPUS.get(`corpus:${key}`,'json');
  if(!corpus||corpus.version!==key||corpus.schemaVersion!==1||!Array.isArray(corpus.nodes)||!corpus.postings||!corpus.evidence)throw new ApiError(503,'corpus_missing','问答资料暂不可用。');
  cachedCorpus=corpus;return corpus;
}
function ledgerFor(env,cfg) {
  if(!env.BUDGET_LEDGER)throw new ApiError(503,'configuration','预算服务尚未配置。');
  const stub=env.BUDGET_LEDGER.get(env.BUDGET_LEDGER.idFromName('archive-global-budget-v1'));
  return async(action,payload={})=>{
    const response=await stub.fetch(new Request(`https://budget.internal/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,cap:cfg.dailyMicros})}));
    const value=await response.json();
    if(!response.ok)throw new ApiError(response.status,value.code,messages[value.code]||'预算服务暂不可用，请稍后再试。');
    return value;
  };
}
async function equalSecret(a,b) {
  const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
async function authenticate(request,body,env,cfg,fetcher) {
  const ip=request.headers.get('CF-Connecting-IP')||'local-preview';
  if(cfg.authMode==='token'){
    const value=request.headers.get('Authorization')||'';
    if(!value.startsWith('Bearer ')||!await equalSecret(value.slice(7),cfg.secret))throw new ApiError(401,'unauthorized','请输入正确的问答访问口令。');
  }else if(cfg.authMode==='turnstile'){
    if(typeof body.turnstileToken!=='string'||body.turnstileToken.length<1||body.turnstileToken.length>2048)throw new ApiError(401,'challenge','请先完成人机验证。');
    const data=new URLSearchParams({secret:cfg.secret,response:body.turnstileToken,remoteip:ip});
    let result;try{
      const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:data,signal:AbortSignal.timeout(10000)});
      result=await response.json();
    }catch{throw new ApiError(503,'challenge_unavailable','人机验证暂不可用，请稍后重试。');}
    const hosts=cfg.origins.map(x=>new URL(x).hostname);
    if(!result.success||result.action!=='archive_chat'||!hosts.includes(result.hostname))throw new ApiError(401,'challenge','人机验证已失效，请重新验证。');
  }
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(cfg.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(ip)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function questionBody(body) {
  if(!body||typeof body.question!=='string'||body.question.trim().length<2||body.question.length>1200)throw new ApiError(400,'question','请输入 2～1200 字的问题。');
  const clean=createSanitizer();
  const question=clean.text(body.question.trim());
  if(body.history!==undefined&&!Array.isArray(body.history))throw new ApiError(400,'history','对话格式无效。');
  const history=(body.history||[]).slice(-6).map(x=>{
    if(!x||!['user','assistant'].includes(x.role)||typeof x.content!=='string'||x.content.length>3000)throw new ApiError(400,'history','对话格式无效。');
    return {role:x.role,content:clean.text(x.content)};
  });
  if(history.reduce((n,x)=>n+x.content.length,0)>6000)throw new ApiError(400,'history','对话过长，请开启新对话。');
  const context={};for(const key of ['projectId','questionId'])if(typeof body.context?.[key]==='string'&&/^[a-z0-9-]{1,100}$/.test(body.context[key]))context[key]=body.context[key];
  return {question,history,context};
}
function filterCitations(answer,candidates) {
  const found=new Set([...answer.matchAll(/\[([a-zA-Z0-9_:-]+)\]/g)].map(x=>x[1]));
  return candidates.filter(x=>found.has(x.id));
}
function finalText(answer,candidates) {
  const ids=new Set(candidates.map(x=>x.id));
  return createSanitizer().text(answer).replace(/\[((?:m\d{5}|(?:question|project|document|event|output|evidence):)[a-zA-Z0-9_:-]*)\]/g,(whole,id)=>ids.has(id)?whole:'[引用未核验]');
}

// Exported factory permits offline transport tests. Production always uses the native fetch.
export function createWorker(fetcher=fetch) {
  return {async fetch(request,env,ctx) {
    const requestId=crypto.randomUUID(),origin=request.headers.get('Origin'),url=new URL(request.url);
    let cfg;
    const finish=response=>{
      const headers=new Headers(response.headers);
      headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Request-ID',requestId);headers.set('Vary','Origin');
      if(origin&&cfg?.origins.includes(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');headers.set('Access-Control-Expose-Headers','X-Request-ID');}
      return new Response(response.body,{status:response.status,headers});
    };
    let ledger,admitted=false,reserved=false,settled=false;
    const settle=async actual=>{if(admitted&&!settled){const value=await ledger('settle',{id:requestId,actual});settled=true;return value;}};
    try{
      if(!['/api/agent/health','/api/agent/chat'].includes(url.pathname))return finish(json({error:{code:'not_found',message:'接口不存在。'}},404));
      cfg=config(env);
      if(origin&&!cfg.origins.includes(origin))throw new ApiError(403,'origin','该站点来源未获准访问问答服务。');
      if(request.method==='OPTIONS')return finish(new Response(null,{status:204}));
      if(url.pathname.endsWith('/health')){
        if(request.method!=='GET')throw new ApiError(405,'method','请求方法不支持。');
        modelConfig(env);const corpus=await corpusFor(env);ledgerFor(env,cfg);
        return finish(json({status:'ready',version:corpus.version,cutoff:corpus.meta.cutoff,authMode:cfg.authMode,dailyBudgetUsd:cfg.dailyMicros/1e6}));
      }
      if(request.method!=='POST')throw new ApiError(405,'method','请求方法不支持。');
      const prices=modelConfig(env),body=await readJson(request),parsed=questionBody(body);
      const user=await authenticate(request,body,env,cfg,fetcher);
      ledger=ledgerFor(env,cfg);await ledger('admit',{id:requestId,user});admitted=true;
      const corpus=await corpusFor(env);
      const controller=new AbortController(),abort=()=>controller.abort();
      request.signal.addEventListener('abort',abort,{once:true});
      if(request.signal.aborted)controller.abort();
      const timer=setTimeout(abort,60000);
      let closed=false;
      const stream=new ReadableStream({
        start(streamController){
          const send=(event,data)=>{if(!closed)try{streamController.enqueue(sseFrame(event,data));}catch{closed=true;controller.abort();}};
          const run=async()=>{
            send('meta',{requestId,cutoff:corpus.meta.cutoff,version:corpus.version});
            try{
              // Follow-ups may use a preceding user question for recall, never assistant claims.
              const previous=parsed.history.filter(x=>x.role==='user').at(-1)?.content||'';
              const query=/^(那|它|这个|还有|后来|继续|具体|上述)/.test(parsed.question)&&previous?`${previous}\n${parsed.question}`:parsed.question;
              const result=retrieve(corpus,query,parsed.context),candidates=citationCandidates(result);
              if(result.trace)for(const trace of result.trace)send('trace',{...trace,stage:trace.stage||trace.phase});
              else {
                send('trace',{stage:'parse',label:'解析时间和主题',status:'done'});
                send('trace',{stage:'evidence',label:'读取脱敏证据',status:'done',count:result.evidence.length,nodes:result.nodes.map(n=>({id:n.id,title:n.title}))});
              }
              if(!result.matched){
                const budget=await settle(0);
                send('done',{answer:`现有脱敏资料中未找到足够依据，无法回答这个问题。可以补充专题名称、方法名或年份。资料截止 ${corpus.meta.cutoff}。`,citations:[],cutoff:corpus.meta.cutoff,version:corpus.version,noMatch:true,budget});return;
              }
              send('trace',{stage:'count',label:'核对模型输入额度',status:'running'});
              let prompt=promptFor(corpus,result,parsed.question,parsed.history);
              let inputTokens=await countInput(prices.model,prompt,env,controller.signal,fetcher);
              if(inputTokens>prices.maxInput){
                prompt=promptFor(corpus,{...result,nodes:result.nodes.slice(0,4),evidence:result.evidence.slice(0,5)},parsed.question,parsed.history.slice(-2));
                inputTokens=await countInput(prices.model,prompt,env,controller.signal,fetcher);
              }
              if(inputTokens>prices.maxInput)throw new ApiError(400,'input_limit','相关资料或对话过长，请缩小时间和专题范围。');
              send('trace',{stage:'count',label:'核对模型输入额度',status:'done',count:inputTokens});
              const amount=costMicros(inputTokens+128,prices.maxOutput,prices);
              send('trace',{stage:'budget',label:'预留本次调用预算',status:'running'});
              const reservation=await ledger('reserve',{id:requestId,amount});reserved=true;
              send('trace',{stage:'budget',label:'预留本次调用预算',status:'done',reservedUsd:amount/1e6,remainingUsd:reservation.remainingUsd});
              // Only IDs actually supplied in the final model input are eligible citations.
              const supplied=JSON.parse(prompt.input.at(-1).content),allowed=new Set([...supplied.records.map(n=>n.id),...supplied.evidence.map(e=>e.id)]);
              const validCandidates=candidates.filter(c=>allowed.has(c.id));
              send('trace',{stage:'generate',label:'依据证据生成回答',status:'running'});
              const generated=await generate(prices.model,prompt,prices,env,controller.signal,delta=>send('delta',{text:delta}),fetcher);
              const budget=await settle(generated.actual),answer=finalText(generated.answer,validCandidates);
              send('trace',{stage:'generate',label:'依据证据生成回答',status:'done'});
              send('done',{answer:answer||'模型未返回可展示的回答，请缩小问题范围后重试。',citations:filterCitations(answer,validCandidates),cutoff:corpus.meta.cutoff,version:corpus.version,budget,incomplete:generated.incomplete,usage:generated.usage});
            }catch(error){
              try{await settle(!reserved||error.definitelyUnbilled?0:null);}catch{ /* Lease expiry conservatively charges the reservation. */ }
              send('error',{code:error.code||'generation_failed',message:error instanceof ApiError?error.message:'回答中断，请稍后重试。',requestId});
            }finally{
              clearTimeout(timer);request.signal.removeEventListener('abort',abort);
              if(!closed){closed=true;streamController.close();}
            }
          };
          ctx.waitUntil(run());
        },
        cancel(){closed=true;controller.abort();},
      });
      return finish(new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}}));
    }catch(error){
      try{await settle(reserved?null:0);}catch{ /* Budget lease remains authoritative on failure. */ }
      return finish(json({error:{code:error.code||'internal',message:error instanceof ApiError?error.message:'问答服务暂不可用，请稍后再试。'},requestId},error instanceof ApiError?error.status:503));
    }
  }};
}
export default createWorker();
