import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {fileURLToPath} from 'node:url';
import {beijingDay} from '../worker/config.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const bundled=await build({stdin:{contents:`
import {BudgetLedger} from './agent/worker/budget.mjs';
export class TestLedger extends BudgetLedger {
  async fetch(request){if(new URL(request.url).pathname==='/_alarm')return Response.json({at:await this.ctx.storage.getAlarm()});if(new URL(request.url).pathname==='/_sql'){const b=await request.json();return Response.json([...this.sql.exec(b.query,...(b.args||[]))]);}return super.fetch(request);}
}
export default {fetch(request,env){const id=env.BUDGET_LEDGER.idFromName(request.headers.get('x-test-object')||'test');return env.BUDGET_LEDGER.get(id).fetch(request);}};`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-07-01',durableObjects:{BUDGET_LEDGER:{className:'TestLedger',useSQLite:true}}});
after(()=>mf.dispose());
const call=async(object,action,payload={})=>{
  const response=await mf.dispatchFetch(`https://ledger.test/${action}`,{method:'POST',headers:{'Content-Type':'application/json','x-test-object':object},body:JSON.stringify({cap:1000000,...payload})});
  return {status:response.status,value:await response.json()};
};
const admit=(object,id,user=id)=>call(object,'admit',{id,user});
const reserve=(object,id,amount)=>call(object,'reserve',{id,amount});
const settle=(object,id,actual)=>call(object,'settle',{id,actual});

test('Beijing daily boundary is 16:00 UTC, independent of host timezone',()=>{
  assert.equal(beijingDay(Date.parse('2026-11-05T15:59:59Z')),'2026-11-05');
  assert.equal(beijingDay(Date.parse('2026-11-05T16:00:00Z')),'2026-11-06');
});
test('SQLite transactions prevent simultaneous reservations exceeding one dollar',async()=>{
  const object='atomic';await admit(object,'a');await admit(object,'b');
  const replies=await Promise.all([reserve(object,'a',600000),reserve(object,'b',600000)]);
  assert.deepEqual(replies.map(x=>x.status).sort(),[200,429]);
  const state=(await call(object,'status')).value;assert.equal(state.reservedUsd,.6);assert.equal(state.spentUsd,0);
  const winner=replies[0].status===200?'a':'b',loser=winner==='a'?'b':'a';
  await settle(object,winner,200000);assert.equal((await reserve(object,loser,600000)).status,200);
  const final=(await call(object,'status')).value;assert.equal(final.spentUsd,.2);assert.equal(final.reservedUsd,.6);
});
test('only three concurrent requests are admitted across different users',async()=>{
  const results=await Promise.all(Array.from({length:12},(_,i)=>admit('concurrent',`req-${i}`)));
  assert.equal(results.filter(x=>x.status===200).length,3);
  assert.ok(results.filter(x=>x.status!==200).every(x=>x.value.code==='concurrency'));
});
test('settlement is idempotent and an unreserved error releases its slot',async()=>{
  await admit('idempotent','a');await reserve('idempotent','a',100000);await settle('idempotent','a',40000);await settle('idempotent','a',40000);
  assert.equal((await call('idempotent','status')).value.spentUsd,.04);
  await admit('idempotent','b');await settle('idempotent','b',0);
  assert.equal((await call('idempotent','status')).value.reservedUsd,0);
  assert.equal((await admit('idempotent','a')).status,409);
});
test('unknown usage is charged conservatively and exhausted days refuse new admission',async()=>{
  await admit('unknown','a');await reserve('unknown','a',1000000);await settle('unknown','a',null);
  const status=(await call('unknown','status')).value;assert.equal(status.spentUsd,1);assert.equal(status.reservedUsd,0);assert.equal(status.remainingUsd,0);
  assert.equal((await admit('unknown','b')).value.code,'daily_budget');
});
test('abandoned leases charge full reservation; late valid usage corrects original day',async()=>{
  await admit('expiry','a');await reserve('expiry','a',300000);
  await call('expiry','_sql',{query:'UPDATE requests SET expires=0 WHERE id=?',args:['a']});
  const state=(await call('expiry','status')).value;assert.equal(state.spentUsd,.3);assert.equal(state.reservedUsd,0);
  const late=(await settle('expiry','a',100000)).value;assert.equal(late.spentUsd,.1);
});
test('cross-midnight reservation is attributed to generation day, not admission day',async()=>{
  await admit('midnight','a');
  await call('midnight','_sql',{query:"INSERT OR IGNORE INTO days(day) VALUES ('2000-01-01')"});
  await call('midnight','_sql',{query:"UPDATE requests SET day='2000-01-01' WHERE id='a'"});
  const held=(await reserve('midnight','a',500000)).value;assert.equal(held.reservedUsd,.5);
  const rows=(await call('midnight','_sql',{query:"SELECT day FROM requests WHERE id='a'"})).value;assert.equal(rows[0].day,held.day);
  const old=(await call('midnight','_sql',{query:"SELECT reserved,spent FROM days WHERE day='2000-01-01'"})).value[0];assert.deepEqual(old,{reserved:0,spent:0});
});
test('provider usage above the reserved bound freezes that day',async()=>{
  await admit('overrun','a');await reserve('overrun','a',100000);await settle('overrun','a',150000);
  const state=(await call('overrun','status')).value;assert.equal(state.frozen,true);assert.equal(state.spentUsd,.15);
  assert.equal((await admit('overrun','b')).value.code,'daily_budget');
});
test('per-minute and per-day user quotas include failed requests',async()=>{
  for(let i=0;i<5;i++){await admit('rate',`r${i}`,'same');await settle('rate',`r${i}`,0);}
  assert.equal((await admit('rate','r5','same')).value.code,'rate_limit');
  await call('rate','_sql',{query:'UPDATE requests SET created=created-120000'});
  for(let i=5;i<20;i++){
    await call('rate','_sql',{query:'UPDATE requests SET created=created-120000'});
    assert.equal((await admit('rate',`r${i}`,'same')).status,200);await settle('rate',`r${i}`,0);
  }
  assert.equal((await admit('rate','r20','same')).value.code,'user_daily');
});
test('daily maintenance remains scheduled with no pending requests',async()=>{
  await admit('maintenance','a');await settle('maintenance','a',0);
  const alarm=(await call('maintenance','_alarm')).value.at;
  assert.ok(alarm>Date.now());assert.equal(new Date(alarm).toISOString().slice(11),'16:00:00.000Z');
});
