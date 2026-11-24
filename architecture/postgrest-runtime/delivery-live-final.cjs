'use strict';
// One dedicated session, zero company scopes. No scheduler, sender or HMAC access.
const {randomUUID}=require('node:crypto');
const {createDeliveryCredentialReader}=require('./delivery-credentials.cjs');
const {createSupabaseDeliveryAuth}=require('./delivery-supabase-auth.cjs');
const {createDeliverySession}=require('./delivery-identity.cjs');
const cfg=require('./staging-public-config.cjs');
const TARGET='3070286d-a61b-43f2-8d2b-d3c0461bf54c';
const BRANCH='refs/heads/integration/employee-ten-domains-step5';
const REPO='natasapavlovic197-cmyk/aurea-puls-tima-preview';
let phase='guard';
function check(ok,label){if(!ok)throw Error('Control failed');console.log('PASS '+label)}
async function database(){
 const r=await fetch('https://api.supabase.com/v1/projects/ublzmoroanhlcgpnxilw/database/query',{method:'POST',headers:{authorization:'Bearer '+process.env.SUPABASE_ACCESS_TOKEN,'content-type':'application/json'},body:JSON.stringify({query:"BEGIN READ ONLY; SELECT (SELECT count(*) FROM aurea_delivery_rpc.identities)::int AS identities,(SELECT count(*) FROM aurea_delivery_rpc.identities i JOIN auth.users u ON u.id=i.user_id WHERE i.user_id='"+TARGET+"' AND u.email='aurea-delivery-staging@example.invalid' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) AND u.is_anonymous IS FALSE)::int AS target,(SELECT count(*) FROM aurea_delivery_rpc.scopes)::int AS scopes,(SELECT count(*) FROM aurea_private.memberships WHERE user_id='"+TARGET+"')::int AS memberships,(SELECT count(*) FROM auth.sessions WHERE user_id='"+TARGET+"')::int AS sessions; ROLLBACK;"}),redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Database check failed');
 const a=await r.json();
 if(!Array.isArray(a)||a.length!==1)throw Error('Database shape');
 return a[0];
}
const isolated=d=>d.identities===1&&d.target===1&&d.scopes===0&&d.memberships===0;
async function rpc(name,body,token){
 const r=await fetch(cfg.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.key,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
 if(r.status===200)return {status:r.status,data:await r.json()};
 // Error bodies may contain sensitive information; do not log or parse them.
 await r.body?.cancel();return {status:r.status};
}
(async()=>{
 let session,token,failed=false;
 const lease=randomUUID();
 try{
  check(process.env.GITHUB_REPOSITORY===REPO&&process.env.GITHUB_REF===BRANCH&&!!process.env.SUPABASE_ACCESS_TOKEN,'exact repository and branch');
  phase='isolation before login';
  const before=await database();
  check(isolated(before)&&before.sessions===0,'isolated identity with zero sessions');
  phase='auth login and identity verification';
  const env={...process.env,AUREA_DELIVERY_AUTH_USER_ID:TARGET,AUREA_DELIVERY_AUTH_EMAIL:'aurea-delivery-staging@example.invalid'};
  const auth=createSupabaseDeliveryAuth({url:cfg.url,key:cfg.key,identityId:TARGET,readCredentials:createDeliveryCredentialReader(env)});
  session=createDeliverySession({auth,identityId:TARGET});
  token=await session.readToken();
  check(typeof token==='string'&&token.length>0,'verified dedicated Auth session');
  phase='live session isolation';
  const active=await database();
  check(isolated(active)&&active.sessions===1,'exactly one dedicated session');
  phase='delivery claim empty scope';
  const claim=await rpc('aurea_delivery_claim',{p_lease_token:lease},token);
  check(claim.status===200&&Array.isArray(claim.data)&&claim.data.length===0,'zero scoped jobs returned');
  phase='manager access denied';
  const manager=await rpc('aurea_my_companies',{},token);
  check(manager.status===403,'manager access denied');
 }catch{console.error('BLOCKED '+phase+'; raw diagnostics suppressed');failed=true;}
 finally{
  if(session){
   try{await session.close();console.log('PASS session manager closed');}
   catch{console.error('BLOCKED session revocation unconfirmed');failed=true;}
  }
  try{
   const after=await database();
   check(isolated(after)&&after.sessions===0,'zero remaining dedicated sessions');
   if(token&&isolated(after)&&after.sessions===0){
    const denied=await rpc('aurea_delivery_claim',{p_lease_token:lease},token);
    check([401,403].includes(denied.status),'revoked session denied by delivery RPC');
   }
  }catch{console.error('BLOCKED post-session isolation; raw diagnostics suppressed');failed=true;}
  token=undefined;
 }
 console.log('LIMITATION: no provider log-redaction proof or Netlify runtime secret readback; no scheduler, sends or deployment.');
 if(failed)process.exitCode=1;
})().catch(()=>{console.error('BLOCKED unexpected failure');process.exitCode=1});
