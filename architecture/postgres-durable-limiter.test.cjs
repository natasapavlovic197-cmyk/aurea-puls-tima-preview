'use strict';
const assert=require('node:assert/strict');
const {createDurableLimiter,SQL}=require('./postgres-durable-limiter.cjs');
(async()=>{
 let count=0,params;
 const limit=createDurableLimiter({query:async(sql,p)=>{assert.equal(sql,SQL);params=p;return {rows:[{hits:++count}]}},secret:'z'.repeat(64),maxHits:2,clock:()=>1700000000000});
 assert.equal(await limit({ip:'192.0.2.4',scope:'employee-submit'}),true);
 assert.equal(await limit({ip:'192.0.2.4',scope:'employee-submit'}),true);
 assert.equal(await limit({ip:'192.0.2.4',scope:'employee-submit'}),false);
 assert.match(params[0],/^[0-9a-f]{64}$/);
 assert.equal(params[0].includes('192.0.2.4'),false);
 assert.equal(params[1]%300,0);
 assert.equal(await limit({ip:'',scope:'employee-submit'}),false);
 assert.equal(await createDurableLimiter({query:async()=>{throw Error('DB DOWN')},secret:'x'.repeat(32)})({ip:'192.0.2.4',scope:'employee-submit'}),false);
 assert.throws(()=>createDurableLimiter({query:async()=>{},secret:'short'}),TypeError);
 console.log('PASS: atomic shared SQL counter, HMAC anonymization, threshold and fail-closed DB errors');
})().catch(e=>{console.error(e);process.exitCode=1});
