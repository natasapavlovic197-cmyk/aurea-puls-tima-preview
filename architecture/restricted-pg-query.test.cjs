'use strict';
const assert=require('node:assert/strict');
const {createRestrictedLimiterQuery}=require('./restricted-pg-query.cjs');
const {SQL}=require('./postgres-durable-limiter.cjs');
const params=['a'.repeat(64),1700000100];
function pool({login='aurea_limiter_login',role='aurea_rate_limiter',bypass=false,failAt=''}={}){
 const calls=[],releases=[];
 return {calls,releases,async connect(){return {async query(sql,p){calls.push(sql);if(sql===failAt)throw Error('DB offline');if(sql.includes('session_user as login_user'))return {rows:[{login_user:login,active_user:role,bypassrls:bypass}]};if(sql===SQL){assert.deepEqual(p,params);return {rows:[{hits:1}]}}return {rows:[]}},release(x){releases.push(x)}}}};
}
(async()=>{
 const good=pool();assert.equal((await createRestrictedLimiterQuery({pool:good})(SQL,params)).rows[0].hits,1);
 assert.deepEqual(good.calls,['BEGIN','SET LOCAL ROLE aurea_rate_limiter',good.calls[2],SQL,'COMMIT']);
 assert.equal(good.releases[0],undefined);
 for(const opts of [{login:'postgres'},{role:'postgres'},{bypass:true}]){
  const p=pool(opts);await assert.rejects(()=>createRestrictedLimiterQuery({pool:p})(SQL,params),/Untrusted/);
  assert.ok(p.calls.includes('ROLLBACK'));assert.ok(!p.calls.includes(SQL));assert.deepEqual(p.releases,[true]);
 }
 const down=pool({failAt:SQL});await assert.rejects(()=>createRestrictedLimiterQuery({pool:down})(SQL,params),/DB offline/);
 assert.ok(down.calls.includes('ROLLBACK'));assert.deepEqual(down.releases,[true]);
 const blocked=pool();await assert.rejects(()=>createRestrictedLimiterQuery({pool:blocked})('select * from auth.users',params),/Unapproved/);assert.equal(blocked.calls.length,0);
 assert.throws(()=>createRestrictedLimiterQuery(),TypeError);
 console.log('PASS: transaction-local role, both identities, allowlist, rollback and discard on failure');
})().catch(e=>{console.error(e);process.exitCode=1});
