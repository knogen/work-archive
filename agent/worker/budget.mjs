import {beijingDay,json} from './config.mjs';

// One fixed object for the entire installation, not one per user or per day.
// All decisions and mutations run in synchronous SQLite transactions.
export class BudgetLedger {
  constructor(ctx,env) {
    this.ctx=ctx;this.env=env;this.sql=ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, spent INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0, frozen INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, day TEXT NOT NULL, user TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, actual INTEGER, created INTEGER NOT NULL, expires INTEGER NOT NULL, status TEXT NOT NULL)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS requests_user_day ON requests(user, day)`);
  }
  rows(query,...args){return [...this.sql.exec(query,...args)];}
  expire(now) {
    for(const row of this.rows("SELECT id,day,amount FROM requests WHERE status IN ('admitted','reserved') AND expires <= ?",now)){
      // An abandoned generation may already have been billed. Charge its full reservation.
      this.sql.exec('UPDATE days SET reserved=reserved-?,spent=spent+? WHERE day=?',row.amount,row.amount,row.day);
      this.sql.exec("UPDATE requests SET status='uncertain',actual=amount WHERE id=?",row.id);
    }
  }
  snapshot(day,cap) {
    const row=this.rows('SELECT * FROM days WHERE day=?',day)[0]||{spent:0,reserved:0,frozen:0};
    return {day,timeZone:'Asia/Shanghai',limitUsd:cap/1e6,spentUsd:row.spent/1e6,reservedUsd:row.reserved/1e6,remainingUsd:Math.max(0,cap-row.spent-row.reserved)/1e6,frozen:!!row.frozen};
  }
  async schedule(now) {
    const next=this.rows("SELECT MIN(expires) AS next FROM requests WHERE status IN ('admitted','reserved')")[0]?.next;
    const midnight=(Math.floor((now+8*3600000)/86400000)+1)*86400000-8*3600000;
    // Keep daily retention maintenance even after the final outstanding request settles.
    await this.ctx.storage.setAlarm(Math.min(next??Infinity,midnight));
  }
  async fetch(request) {
    const body=await request.json(),action=new URL(request.url).pathname,now=Date.now(),day=beijingDay(now),cap=body.cap;
    // This endpoint is reachable only through the Worker binding, never from the public router.
    if(!Number.isSafeInteger(cap)||cap<=0)return json({code:'ledger_config'},500);
    const result=this.ctx.storage.transactionSync(()=>{
      this.expire(now);
      this.sql.exec('INSERT OR IGNORE INTO days(day) VALUES (?)',day);
      if(action==='/status')return {status:200,...this.snapshot(day,cap)};
      if(action==='/admit'){
        if(this.rows('SELECT id FROM requests WHERE id=?',body.id).length)return {status:409,code:'duplicate_request'};
        const usage=this.rows('SELECT COUNT(*) AS n FROM requests WHERE day=? AND user=?',day,body.user)[0].n;
        const minute=this.rows('SELECT COUNT(*) AS n FROM requests WHERE user=? AND created>?',body.user,now-60000)[0].n;
        const concurrent=this.rows("SELECT COUNT(*) AS n FROM requests WHERE status IN ('admitted','reserved')")[0].n;
        const total=this.rows('SELECT COUNT(*) AS n FROM requests WHERE day=?',day)[0].n;
        const state=this.snapshot(day,cap);
        if(state.frozen||state.remainingUsd<=0)return {status:429,code:'daily_budget',...state};
        if(usage>=20)return {status:429,code:'user_daily'};
        if(minute>=5||total>=300)return {status:429,code:'rate_limit'};
        if(concurrent>=3)return {status:429,code:'concurrency'};
        this.sql.exec("INSERT INTO requests(id,day,user,created,expires,status) VALUES (?,?,?,?,?,'admitted')",body.id,day,body.user,now,now+120000);
        return {status:200,id:body.id,day};
      }
      const row=this.rows('SELECT * FROM requests WHERE id=?',body.id)[0];
      if(!row)return {status:404,code:'missing_reservation'};
      if(action==='/reserve'){
        if(row.status!=='admitted')return {status:409,code:'reservation_state'};
        if(!Number.isSafeInteger(body.amount)||body.amount<1)return {status:400,code:'invalid_amount'};
        // A request crossing midnight starts its paid generation in the new Beijing day.
        if(row.day!==day){
          this.sql.exec('UPDATE requests SET day=? WHERE id=?',day,row.id);
          const count=this.rows('SELECT COUNT(*) AS n FROM requests WHERE day=? AND user=?',day,row.user)[0].n;
          if(count>20)return {status:429,code:'user_daily'};
        }
        const state=this.snapshot(day,cap);
        if(state.frozen||Math.round(state.remainingUsd*1e6)<body.amount)return {status:429,code:'daily_budget',...state};
        this.sql.exec('UPDATE days SET reserved=reserved+? WHERE day=?',body.amount,day);
        this.sql.exec("UPDATE requests SET amount=?,status='reserved',expires=? WHERE id=?",body.amount,now+120000,row.id);
        return {status:200,...this.snapshot(day,cap)};
      }
      if(action==='/settle'){
        if(row.status==='settled')return {status:200,...this.snapshot(day,cap)};
        const actual=body.actual===null?row.amount:body.actual;
        if(!Number.isSafeInteger(actual)||actual<0)return {status:400,code:'invalid_actual'};
        if(row.status==='uncertain')this.sql.exec('UPDATE days SET spent=spent-?+? WHERE day=?',row.amount,actual,row.day);
        else this.sql.exec('UPDATE days SET reserved=reserved-?,spent=spent+? WHERE day=?',row.amount,actual,row.day);
        if(actual>row.amount)this.sql.exec('UPDATE days SET frozen=1 WHERE day=?',row.day);
        this.sql.exec("UPDATE requests SET status='settled',actual=? WHERE id=?",actual,row.id);
        return {status:200,...this.snapshot(day,cap)};
      }
      return {status:404,code:'not_found'};
    });
    // Alarm expiry preserves accounting even if the request/Worker disappears.
    await this.schedule(now);
    return json(result,result.status);
  }
  async alarm() {
    const now=Date.now();
    this.ctx.storage.transactionSync(()=>{
      this.expire(now);
      const cutoff=beijingDay(now-29*86400000);
      this.sql.exec("DELETE FROM requests WHERE day < ? AND status IN ('settled','uncertain')",cutoff);
      this.sql.exec('DELETE FROM days WHERE day < ?',cutoff);
    });
    await this.schedule(now);
  }
}
