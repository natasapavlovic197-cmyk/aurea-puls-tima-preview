'use strict';
// Supabase Management API v1-get-pooler-config; shared Supavisor port 5432 is session, 6543 transaction.
// Never return a URI, username, password, or arbitrary response text.
const REF='ublzmoroanhlcgpnxilw';
const HOST=/^aws-\d+-eu-west-1\.pooler\.supabase\.com$/;
function sessionEndpoint(rows){
 if(!Array.isArray(rows)||rows.length===0||rows.length>100)throw Error('Pooler schema not accepted');
 const hosts=new Set();
 for(const row of rows){
  if(!row||row.database_type!=='PRIMARY')continue;
  if(typeof row.db_host!=='string'||!HOST.test(row.db_host))continue;
  if(!['session','transaction'].includes(row.pool_mode)||![5432,6543].includes(row.db_port)||row.db_name!=='postgres'||row.db_user!=='postgres.'+REF)continue;
  if(row.db_port!==(row.pool_mode==='session'?5432:6543))continue;
  const uris=[row.connection_string,row.connectionString].filter(v=>typeof v==='string'&&v.length);
  if(!uris.length)continue;
  let valid=true;
  for(const raw of uris){
   try{
    // Documentation may use a password placeholder. URL parser handles it without exposing it.
    const u=new URL(raw);
    if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!==row.db_host||u.port!==String(row.db_port)||u.pathname!=='/postgres'||decodeURIComponent(u.username)!=='postgres.'+REF||u.hash)valid=false;
   }catch{valid=false}
  }
  if(valid)hosts.add(row.db_host);
 }
 if(hosts.size!==1)throw Error('Shared primary pooler not uniquely identified');
 return Object.freeze({host:[...hosts][0],port:5432,mode:'session',connectionVerified:false});
}
module.exports={sessionEndpoint,REF};
