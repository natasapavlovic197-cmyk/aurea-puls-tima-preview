'use strict';
const assert=require('node:assert/strict');
const {createRestrictedLimiterQuery}=require('./restricted-pg-query.cjs');
const {SQL}=require('./postgres-durable-limiter.cjs');
const params=['a'.repeat(64),1700000100];
function pool(role='aurea_rate_limiter',bypassrls=false,fail=false){
 let released=0,queries=0;
 return {get released(){return released},get queries(){return queries},async connect(){return {async query(sql,p){queries++;if(sql.includes('current_user as current_user'))return {rows:[{current_user:role,bypassrls}]};if(fail)throw Error('DB offline');assert.equal(sql,SQL);assert.deepEqual(p,params);return {rows:[{hits:1}]}},release(){released++}}}};
}
(async()=>{
 const good=pool();assert.equal((await createRestrictedLimiterQuery({pool:good})(SQL,params)).rows[0].hits,1);assert.equal(good.released,1);
 for(const p of [pool('postgres'),pool('aurea_rate_limiter',true)]){await assert.rejects(()=>createRestrictedLimiterQuery({pool:p})(SQL,params),/Untrusted/);assert.equal(p.queries,1);assert.equal(p.released,1)}
 const broken=pool('aurea_rate_limiter',false,true);await assert.rejects(()=>createRestrictedLimiterQuery({pool:broken})(SQL,params),/DB offline/);assert.equal(broken.released,1);
 const blocked=pool();await assert.rejects(()=>createRestrictedLimiterQuery({pool:blocked})('select * from auth.users',params),/Unapproved/);assert.equal(blocked.queries,0);
 assert.throws(()=>createRestrictedLimiterQuery(),TypeError);
 console.log('PASS: restricted database identity verified, admin/bypass rejected, connections released on failure, SQL allowlisted');
})().catch(e=>{console.error(e);process.exitCode=1});
