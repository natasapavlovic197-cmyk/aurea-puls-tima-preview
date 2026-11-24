'use strict';
const {randomBytes,pbkdf2Sync,createHmac,createHash}=require('node:crypto');
const REF='ublzmoroanhlcgpnxilw';
const ROLES=['aurea_limiter_login','aurea_employee_login'];
const NAMES=['AUREA_STAGING_DATABASE_PASSWORD','AUREA_EMPLOYEE_DATABASE_PASSWORD','AUREA_LIMITER_SECRET'];
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
function verifier(password,salt=randomBytes(16)){
 const salted=pbkdf2Sync(password,salt,4096,32,'sha256');
 const client=createHmac('sha256',salted).update('Client Key').digest();
 const stored=createHash('sha256').update(client).digest('base64');
 const server=createHmac('sha256',salted).update('Server Key').digest('base64');
 return 'SCRAM-SHA-256$4096:'+salt.toString('base64')+'$'+stored+':'+server;
}
function validateEvidence(e){
 assert(e?.ref===REF&&e.region==='eu-west-1'&&e.status==='ACTIVE_HEALTHY','Wrong project');
 assert(e.host==='aws-1-eu-west-1.pooler.supabase.com'&&e.port===5432,'Unverified pooler');
 assert(e.secretsRead===true&&e.secretsWriteAttested===true&&e.exclusiveWindow===true&&e.sqlLoggingReviewed===true&&e.ownershipRollbackVerified===true&&e.flagsDisabled===true,'Authorization or safety gate missing');
 assert(Array.isArray(e.secretNames)&&NAMES.every(n=>!e.secretNames.includes(n)),'Secret conflict');
 assert(Array.isArray(e.roles)&&e.roles.length===2&&ROLES.every(n=>e.roles.some(r=>r.name===n&&r.passwordUnset===true&&r.restricted===true)),'Role conflict');
}
async function provision({adapter,approval,mask}={}){
 assert(approval==='PROVISION AUREA STAGING ONLY'&&typeof mask==='function','Explicit approval required');
 // Adapter is intentionally injected; live API transport must be reviewed separately.
 const e=await adapter.inspect();validateEvidence(e);
 const values=NAMES.map(()=>randomBytes(32).toString('hex'));
 assert(new Set(values).size===3,'Credential collision');
 const v=values.slice(0,2).map(p=>verifier(p));
 for(const x of [...values,...v])mask(x);
 let passwordsAttempted=false,secretsAttempted=false;
 try{
  passwordsAttempted=true;
  await adapter.setPasswordsIfUnset(ROLES.map((name,i)=>({name,verifier:v[i]})));
  await adapter.probe({host:e.host,limiterPassword:values[0],employeePassword:values[1]});
  secretsAttempted=true;
  await adapter.createSecretsIfAbsent(NAMES.map((name,i)=>({name,value:values[i]})));
  await adapter.verifySecrets(NAMES);
  return {status:'provisioned'};
 }catch{
  // Compare-and-delete only credentials owned by this attempt. Never delete by name alone.
  const rollback=[];
  if(secretsAttempted)try{await adapter.removeOwnedSecrets(NAMES.map((name,i)=>({name,value:values[i]})))}catch{rollback.push('secrets')}
  if(passwordsAttempted)try{await adapter.clearOwnedPasswords(ROLES.map((name,i)=>({name,verifier:v[i]})))}catch{rollback.push('passwords')}
  throw Error(rollback.length?'Rollback incomplete; manual reconciliation required':'Provisioning failed; rollback verified by adapter');
 }
}
module.exports={verifier,validateEvidence,provision,REF,ROLES,NAMES};
