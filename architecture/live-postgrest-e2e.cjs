'use strict';
const assert=require('node:assert/strict');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const cfg=require('./postgrest-runtime/staging-public-config.cjs');
const {createPostgrestTransport}=require('./postgrest-runtime/browser-transport.cjs');
const {createEmployeeClient}=require('./employee-live-client.cjs');
const ref='ublzmoroanhlcgpnxilw', root='https://api.supabase.com/v1/projects/'+ref;
const pat=process.env.SUPABASE_ACCESS_TOKEN;
const sha=s=>createHash('sha256').update(s).digest('hex');
async function sql(query){
 const r=await fetch(root+'/database/query',{method:'POST',redirect:'error',signal:AbortSignal.timeout(25000),headers:{authorization:'Bearer '+pat,'content-type':'application/json'},body:JSON.stringify({query})});
 if(!r.ok)throw Error('Management SQL HTTP '+r.status);
 return r.json();
}
async function main(){
 if(!pat?.startsWith('sbp_fc')||cfg.url!=='https://'+ref+'.supabase.co'||process.env.GITHUB_REF!=='refs/heads/integration/employee-ten-domains-step5'||process.env.GITHUB_REPOSITORY!=='natasapavlovic197-cmyk/aurea-puls-tima-preview')throw Error('Staging gate');
 const p=await fetch(root,{headers:{authorization:'Bearer '+pat},redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!p.ok)throw Error('Project lookup HTTP '+p.status);
 const meta=await p.json();if((meta.ref||meta.id)!==ref||meta.name!=='aurea-puls-staging')throw Error('Project identity');
 const o=randomUUID(),c=randomUUID(),i=randomUUID(),token=randomBytes(32).toString('hex'),hash=sha(token);
 const name='SYNTHETIC HTTPS QA '+o, email='qa-'+i+'@example.invalid';
 console.log('Synthetic cleanup identifier: '+o);
 const cleanup=`BEGIN;
 DELETE FROM aurea_private.response_answers WHERE response_id IN (SELECT r.id FROM aurea_private.responses r JOIN aurea_private.cycles c ON c.id=r.cycle_id JOIN aurea_private.organizations o ON o.id=c.organization_id WHERE c.id='${c}' AND o.id='${o}' AND o.name='${name}');
 DELETE FROM aurea_private.responses WHERE cycle_id='${c}' AND EXISTS(SELECT 1 FROM aurea_private.cycles c JOIN aurea_private.organizations o ON o.id=c.organization_id WHERE c.id='${c}' AND o.id='${o}' AND o.name='${name}');
 DELETE FROM aurea_private.invitations WHERE id='${i}' AND cycle_id='${c}' AND recipient_address='${email}' AND EXISTS(SELECT 1 FROM aurea_private.organizations WHERE id='${o}' AND name='${name}');
 DELETE FROM aurea_private.cycle_questions WHERE cycle_id='${c}' AND EXISTS(SELECT 1 FROM aurea_private.cycles c JOIN aurea_private.organizations o ON o.id=c.organization_id WHERE c.id='${c}' AND o.id='${o}' AND o.name='${name}');
 DELETE FROM aurea_private.cycles WHERE id='${c}' AND organization_id='${o}' AND EXISTS(SELECT 1 FROM aurea_private.organizations WHERE id='${o}' AND name='${name}');
 DELETE FROM aurea_private.organizations WHERE id='${o}' AND name='${name}';
 DELETE FROM aurea_rpc_private.employee_limits WHERE bucket IN ('${sha('aurea-rpc-invite:invitation:'+hash)}','${sha('aurea-rpc-invite:submit:'+hash)}');
 COMMIT;`;
 try{
 await sql(`BEGIN;
 INSERT INTO aurea_private.organizations(id,name) VALUES('${o}','${name}');
 INSERT INTO aurea_private.cycles(id,organization_id,week_start,state,model_version) VALUES('${c}','${o}',date '2026-11-23','open',2);
 INSERT INTO aurea_private.cycle_questions(cycle_id,question_id,position)
 SELECT '${c}',q.id,v.pos FROM (VALUES ('A_CLARITY',1),('A_WORKLOAD',2),('A_SPEAKUP',3),('R_LEADER_HELP',4),('R_INFO',5),('R_PRIORITY',6)) v(code,pos) JOIN aurea_private.questions q ON q.code=v.code AND q.model_version=2 AND q.active;
 INSERT INTO aurea_private.invitations(id,cycle_id,recipient_address,token_hash,expires_at) VALUES('${i}','${c}','${email}','${hash}',now()+interval '10 minutes');
 COMMIT;`);
 const transport=createPostgrestTransport(cfg);
 const client=createEmployeeClient({token,fetchImpl:transport});
 const q=await client.load();
 assert.deepEqual(q.map(x=>x.code),['A_CLARITY','A_WORKLOAD','A_SPEAKUP','R_LEADER_HELP','R_INFO','R_PRIORITY']);
 console.log('PASS: actual premium employee client loaded six canonical questions over HTTPS');
 const answers=Object.fromEntries(q.map((x,j)=>[x.code,j===5?6:4]));
 assert.equal(await client.submit(answers),true);
 const replay=await transport('/api/employee/submit',{method:'POST',body:JSON.stringify({token,answers:q.map(x=>({code:x.code,rating:answers[x.code]}))})});
 assert.equal(replay.status,400);
 assert.deepEqual(await replay.json(),{status:'unavailable'});
 const rows=await sql(`SELECT (SELECT count(*)::int FROM aurea_private.responses WHERE cycle_id='${c}') AS responses,(SELECT count(*)::int FROM aurea_private.response_answers a JOIN aurea_private.responses r ON r.id=a.response_id WHERE r.cycle_id='${c}') AS answers,(SELECT count(*)::int FROM aurea_private.response_answers a JOIN aurea_private.responses r ON r.id=a.response_id WHERE r.cycle_id='${c}' AND a.not_applicable AND a.rating IS NULL) AS na,(SELECT redeemed_at IS NOT NULL FROM aurea_private.invitations WHERE id='${i}') AS redeemed`);
 assert.deepEqual(rows,[{responses:1,answers:6,na:1,redeemed:true}]);
 console.log('PASS: actual HTTPS submission, replay denied, database contains exactly one response and six answers including NA');
 }finally{
 await sql(cleanup);
 const remaining=await sql(`SELECT (SELECT count(*)::int FROM aurea_private.organizations WHERE id='${o}') AS organizations,(SELECT count(*)::int FROM aurea_private.cycles WHERE id='${c}') AS cycles,(SELECT count(*)::int FROM aurea_private.invitations WHERE id='${i}') AS invitations,(SELECT count(*)::int FROM aurea_private.responses WHERE cycle_id='${c}') AS responses`);
 assert.deepEqual(remaining,[{organizations:0,cycles:0,invitations:0,responses:0}]);
 console.log('PASS: synthetic records removed; shared global counters left intact');
 }
}
main().catch(e=>{console.error('E2E failed: '+(e instanceof assert.AssertionError?'assertion':e.message.startsWith('Management SQL HTTP')?e.message:'execution error'));process.exitCode=1});
