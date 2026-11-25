// Import the actual packaged functions and exercise their disabled entry paths only.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected live network')};
for(const k of Object.keys(process.env))if(k.startsWith('AUREA_'))delete process.env[k];
const load=async name=>import(pathToFileURL(path.resolve('activation-review-output/server-functions/'+name+'.mjs')));
const tick=await load('aurea-tick');assert.equal(tick.config.schedule,'*/15 * * * *');assert.equal((await tick.default()).status,204);
const job=await load('aurea-job-background');assert.equal(job.config.background,true);await job.default(new Request('https://example.invalid',{method:'POST'}));
const admin=await load('aurea-admin');assert.equal((await admin.default(new Request('https://example.invalid',{method:'POST'}))).status,503);
assert.equal(calls,0);console.log('PASS packaged ESM import and disabled entrypoint smoke: 3/3, zero external calls');
