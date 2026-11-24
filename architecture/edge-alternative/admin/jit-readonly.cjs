'use strict';
const REF='ublzmoroanhlcgpnxilw',ROOT='https://api.supabase.com/v1/projects/'+REF;
const paths=['','/jit-access','/ssl-enforcement'];
async function inspect({token,fetchImpl=globalThis.fetch}={}){
 if(typeof token!=='string'||!token.startsWith('sbp_fc'))throw Error('Scoped token required');
 async function get(path){
  if(!paths.includes(path))throw Error('Path denied');
  try{const r=await fetchImpl(ROOT+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization:'Bearer '+token,accept:'application/json'}});
   const status=Number.isInteger(r.status)&&r.status>=100&&r.status<=599?r.status:0;
   return {status,data:status===200?await r.json():null};
  }catch{return {status:0,data:null}}
 }
 const p=await get('');
 if(p.status!==200||(p.data?.ref||p.data?.id)!==REF||p.data?.region!=='eu-west-1'||p.data?.status!=='ACTIVE_HEALTHY')return {projectHttp:p.status,projectVerified:false};
 const j=await get('/jit-access'),s=await get('/ssl-enforcement');
 const state=['enabled','disabled','unavailable'].includes(j.data?.state)?j.data.state:'unconfirmed';
 const reason=['ssl_enforcement_required'].includes(j.data?.unavailableReason)?j.data.unavailableReason:'unconfirmed';
 const bool=x=>typeof x==='boolean'?x:'unconfirmed';
 return {projectHttp:p.status,projectVerified:true,jitHttp:j.status,jitState:state,jitApplied:bool(j.data?.appliedSuccessfully),jitUnavailableReason:state==='unavailable'?reason:'not_applicable',sslHttp:s.status,sslDatabase:bool(s.data?.currentConfig?.database),sslApplied:bool(s.data?.appliedSuccessfully),sslEnforced:s.status===200&&s.data?.currentConfig?.database===true&&s.data?.appliedSuccessfully===true,writeAuthorizationVerified:false,actualTlsLoginVerified:false};
}
module.exports={inspect,REF};
if(require.main===module){
 inspect({token:process.env.SUPABASE_ACCESS_TOKEN}).then(x=>{console.log(JSON.stringify(x));if(!x.projectVerified||x.jitHttp!==200||x.sslHttp!==200||x.jitState==='unconfirmed'||x.sslDatabase==='unconfirmed'||x.sslApplied==='unconfirmed')process.exitCode=1}).catch(()=>{console.error('Read-only JIT inspection stopped');process.exitCode=1});
}
