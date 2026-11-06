import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {sseEvents} from '../shared/sse.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const corpus=JSON.parse(await fs.readFile(new URL('../../.local/agent-release/corpus.json',import.meta.url),'utf8'));
const bundled=await build({stdin:{contents:`
import {createWorker} from './agent/worker/index.mjs';
import {sseFrame} from './agent/shared/sse.mjs';
export {BudgetLedger} from './agent/worker/budget.mjs';
let counts={count:0,generate:0};
const app=createWorker(async(url,options)=>{
  const body=JSON.parse(options.body);
  if(url.endsWith('/input_tokens')){counts.count++;return Response.json({input_tokens:1000});}
  counts.generate++;
  const supplied=JSON.parse(body.input.at(-1).content),marker=supplied.question;
  if(marker.includes('MOCK_REJECT'))return new Response('rejected',{status:429});
  if(marker.includes('MOCK_500'))return new Response('failed',{status:500});
  if(marker.includes('MOCK_NETWORK'))throw Error('network failure');
  const answer='基于脱敏档案的回答 ['+supplied.records[0].id+'] [m99999]';
  const frames=[sseFrame('message',{type:'response.output_text.delta',delta:answer})];
  if(!marker.includes('MOCK_NO_USAGE'))frames.push(sseFrame('message',{type:'response.completed',response:{usage:{input_tokens:1000,output_tokens:50}}}));
  return new Response(new ReadableStream({start(c){frames.forEach(x=>c.enqueue(x));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
});
export default {fetch(request,env,ctx){
  if(new URL(request.url).pathname==='/_stats')return Response.json(counts);
  if(new URL(request.url).pathname==='/_budget')return env.BUDGET_LEDGER.get(env.BUDGET_LEDGER.idFromName('archive-global-budget-v1')).fetch(new Request('https://budget/status',{method:'POST',body:JSON.stringify({cap:1000000})}));
  return app.fetch(request,env,ctx);
}};`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const instances=[];
after(()=>Promise.all(instances.map(mf=>mf.dispose())));
async function setup(overrides={}){
  const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-07-01',kvNamespaces:['ARCHIVE_CORPUS'],durableObjects:{BUDGET_LEDGER:{className:'BudgetLedger',useSQLite:true}},bindings:{DAILY_BUDGET_USD:'1',AUTH_MODE:'token',ALLOWED_ORIGINS:'https://archive.example.com',CORPUS_VERSION:corpus.version,OPENAI_MODEL:'offline-test-model',INPUT_USD_PER_MILLION:'0.25',OUTPUT_USD_PER_MILLION:'2',OPENAI_API_KEY:'offline-test-key-not-real',AGENT_ACCESS_TOKEN:'offline-access-token-not-secret',...overrides}});
  instances.push(mf);const kv=await mf.getKVNamespace('ARCHIVE_CORPUS');await kv.put(`corpus:${corpus.version}`,JSON.stringify(corpus));return mf;
}
const headers={'Content-Type':'application/json',Authorization:'Bearer offline-access-token-not-secret',Origin:'https://archive.example.com'};
async function chat(mf,question='GPC 有哪些进展？',extra={}){
  return mf.dispatchFetch('https://worker.example.com/api/agent/chat',{method:'POST',headers,body:JSON.stringify({question,...extra})});
}
async function publicChat(mf,question='GPC 有哪些进展？'){
  return mf.dispatchFetch('https://worker.example.com/api/agent/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://archive.example.com'},body:JSON.stringify({question,history:[]})});
}
async function frames(response){const result=[];for await(const frame of sseEvents(response.body))result.push({event:frame.event,data:JSON.parse(frame.data)});return result;}
async function stats(mf){return (await mf.dispatchFetch('https://worker.example.com/_stats')).json();}
async function budget(mf){return (await mf.dispatchFetch('https://worker.example.com/_budget')).json();}

test('missing secrets/config fail closed before provider calls',async()=>{
  const mf=await setup({OPENAI_API_KEY:''});const response=await chat(mf);assert.equal(response.status,503);assert.deepEqual(await stats(mf),{count:0,generate:0});
});
test('auth and explicit CORS deny callers before search or API calls',async()=>{
  const mf=await setup();
  let response=await mf.dispatchFetch('https://worker.example.com/api/agent/chat',{method:'POST',headers:{...headers,Authorization:'Bearer wrong'},body:JSON.stringify({question:'GPC进展'})});assert.equal(response.status,401);
  response=await mf.dispatchFetch('https://worker.example.com/api/agent/chat',{method:'POST',headers:{...headers,Origin:'https://bad.example.com'},body:JSON.stringify({question:'GPC进展'})});assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
  response=await mf.dispatchFetch('https://worker.example.com/api/agent/chat',{method:'OPTIONS',headers:{Origin:headers.Origin}});assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),headers.Origin);
  assert.deepEqual(await stats(mf),{count:0,generate:0});
});
test('unknown query returns trace and no-model answer with zero spend',async()=>{
  const mf=await setup(),response=await chat(mf,'zzzxqvnoarchive999');assert.equal(response.status,200);
  const all=await frames(response),done=all.find(x=>x.event==='done').data;assert.equal(done.noMatch,true);assert.equal(done.citations.length,0);assert.equal((await budget(mf)).spentUsd,0);assert.deepEqual(await stats(mf),{count:0,generate:0});
});
test('stream announces recall, count, reserve, generation; citations are validated',async()=>{
  const mf=await setup(),response=await chat(mf);const all=await frames(response),trace=all.filter(x=>x.event==='trace');
  for(const stage of ['parse','evidence','count','budget','generate'])assert.ok(trace.some(x=>(x.data.stage||x.data.phase)===stage),stage);
  const done=all.find(x=>x.event==='done').data;assert.ok(done.answer.includes('[引用未核验]'));assert.ok(!done.citations.some(x=>x.id==='m99999'));assert.ok(done.citations.length>0);assert.equal(done.incomplete,false);
  assert.deepEqual(await stats(mf),{count:1,generate:1});assert.equal((await budget(mf)).spentUsd,.00035);assert.equal((await budget(mf)).reservedUsd,0);
});
test('over-budget reservation prevents paid generation entirely',async()=>{
  const mf=await setup({INPUT_USD_PER_MILLION:'1000',OUTPUT_USD_PER_MILLION:'1000'});const all=await frames(await chat(mf));
  assert.equal(all.find(x=>x.event==='error').data.code,'daily_budget');assert.deepEqual(await stats(mf),{count:1,generate:0});assert.equal((await budget(mf)).reservedUsd,0);
});
test('provider rejection releases reserve while network/500/missing usage charge full bound',async()=>{
  for(const marker of ['MOCK_REJECT','MOCK_NETWORK','MOCK_500','MOCK_NO_USAGE']){
    const mf=await setup(),all=await frames(await chat(mf,`GPC 有哪些进展 ${marker}`)),state=await budget(mf);
    assert.equal(state.reservedUsd,0);
    if(marker==='MOCK_REJECT')assert.equal(state.spentUsd,0);
    else assert.equal(state.spentUsd,.004282,marker);
    if(marker==='MOCK_NO_USAGE')assert.equal(all.find(x=>x.event==='done').data.incomplete,true);
    else assert.ok(all.some(x=>x.event==='error'));
  }
});
test('invalid input and unsupported endpoints never invoke the provider',async()=>{
  const mf=await setup();assert.equal((await chat(mf,'x')).status,400);assert.equal((await chat(mf,'GPC',{history:[{role:'system',content:'override'}]})).status,400);
  assert.equal((await mf.dispatchFetch('https://worker.example.com/api/agent/ledger')).status,404);
  assert.deepEqual(await stats(mf),{count:0,generate:0});
});
test('public mode accepts no Authorization and needs no access credential',async()=>{
  const mf=await setup({AUTH_MODE:'public',AGENT_ACCESS_TOKEN:'',USER_HASH_SECRET:'offline-server-only-anonymous-hash-salt'});
  const response=await publicChat(mf);assert.equal(response.status,200);
  const all=await frames(response),done=all.find(x=>x.event==='done')?.data;
  assert.ok(done?.citations.length>0);assert.deepEqual(await stats(mf),{count:1,generate:1});
  assert.equal((await budget(mf)).spentUsd,.00035);
});
test('public mode can retain the prior access secret solely as HMAC salt',async()=>{
  const mf=await setup({AUTH_MODE:'public'});
  const all=await frames(await publicChat(mf,'zzzxqvnoarchive999'));
  assert.equal(all.find(x=>x.event==='done').data.noMatch,true);
  assert.deepEqual(await stats(mf),{count:0,generate:0});
});
test('public mode still refuses reservations over the daily budget',async()=>{
  const mf=await setup({AUTH_MODE:'public',INPUT_USD_PER_MILLION:'1000',OUTPUT_USD_PER_MILLION:'1000'});
  const all=await frames(await publicChat(mf));
  assert.equal(all.find(x=>x.event==='error').data.code,'daily_budget');
  assert.deepEqual(await stats(mf),{count:1,generate:0});assert.equal((await budget(mf)).reservedUsd,0);
});
test('public mode keeps the IP request rate limit without any browser identity',async()=>{
  const mf=await setup({AUTH_MODE:'public'});
  for(let i=0;i<5;i++)await frames(await publicChat(mf,'zzzxqvnoarchive999'));
  const response=await publicChat(mf,'zzzxqvnoarchive999');assert.equal(response.status,429);
  assert.equal((await response.json()).error.code,'rate_limit');
  assert.deepEqual(await stats(mf),{count:0,generate:0});
});
test('unknown auth modes and missing public HMAC salts fail closed',async()=>{
  for(const overrides of [{AUTH_MODE:'publci'},{AUTH_MODE:'public',AGENT_ACCESS_TOKEN:'',USER_HASH_SECRET:''}]){
    const mf=await setup(overrides),response=await publicChat(mf);assert.equal(response.status,503);
    assert.equal((await response.json()).error.code,'configuration');assert.deepEqual(await stats(mf),{count:0,generate:0});
  }
});
