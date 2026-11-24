'use strict';
// Offline-only candidate: no pg import, network transport, real credentials or live mutation.
const {REF,ROLES}=require('./provision.cjs');
const HOST='db.'+REF+'.supabase.co';
const SETTINGS=Object.freeze({
 log_statement:'none',log_min_error_statement:'panic',log_duration:'off',
 log_min_duration_statement:'-1',log_min_duration_sample:'-1',log_transaction_sample_rate:'0',
 log_parameter_max_length:'0',log_parameter_max_length_on_error:'0',
 'pgaudit.log':'none','pgaudit.log_parameter':'off',
 track_activities:'off','pg_stat_statements.track_utility':'off',
 password_encryption:'scram-sha-256'
});
const SETTINGS_SQL="SELECT name, setting FROM pg_settings WHERE name = ANY($1::text[])";
function directTlsConfig({host,port,database,user,ca,caVerified=false}={}){
 if(host!==HOST||port!==5432||database!=='postgres'||user!=='postgres'||caVerified!==true||typeof ca!=='string'||!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(ca))throw Error('Direct staging TLS configuration denied');
 // Only a proposed configuration. No password is accepted or returned.
 return {host,port,database,user,ssl:{ca,rejectUnauthorized:true,servername:HOST},connectionTimeoutMillis:5000};
}
function loggingGate(rows,evidence={}){
 const blockers=[];
 const entries=Array.isArray(rows)?rows:[];
 for(const [name,expected] of Object.entries(SETTINGS)){
  const hits=entries.filter(x=>x?.name===name);
  if(hits.length!==1||hits[0].setting!==expected)blockers.push(name);
 }
 for(const key of ['providerLogReview','sessionIdentityVerified','tlsPeerVerified','exclusiveWindow','rollbackOwnershipVerified','noExternalTrace','flagsDisabled']){
  if(evidence[key]!==true)blockers.push(key);
 }
 return Object.freeze({eligible:blockers.length===0,blockers:Object.freeze(blockers),liveWritesEnabled:false});
}
function maskVerifierEntries(entries,mask){
 if(!Array.isArray(entries)||entries.length!==2||typeof mask!=='function'||new Set(entries.map(x=>x?.name)).size!==2||!ROLES.every(n=>entries.some(x=>x?.name===n))||entries.some(x=>typeof x.verifier!=='string'||!/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(x.verifier))||new Set(entries.map(x=>x.verifier)).size!==2)throw Error('Invalid restricted verifier input');
 for(const x of entries)mask(x.verifier);
}
// Simulates ownership-aware, all-or-nothing catalog updates; not a PostgreSQL implementation.
function createOfflineCatalog(initial={}){
 const state=new Map(ROLES.map(n=>[n,initial[n]??null]));
 return Object.freeze({
 inspect:()=>ROLES.map(name=>({name,passwordUnset:state.get(name)===null})),
 apply(entries,{rows,evidence,mask,fault}={}){
  const gate=loggingGate(rows,evidence);
  if(!gate.eligible)throw Error('SQL logging or evidence gate denied');
  maskVerifierEntries(entries,mask);
  if(ROLES.some(n=>state.get(n)!==null))throw Error('Role conflict');
  const next=new Map(state);
  for(const x of entries){next.set(x.name,x.verifier);if(fault==='partial')throw Error('Synthetic transaction aborted')}
  for(const [n,v] of next)state.set(n,v);
  return {status:'simulated',liveWritesEnabled:false};
 },
 rollback(entries,{mask}={}){
  maskVerifierEntries(entries,mask);
  if(entries.some(x=>state.get(x.name)!==null&&state.get(x.name)!==x.verifier))throw Error('Ownership conflict; manual reconciliation required');
  for(const x of entries)if(state.get(x.name)===x.verifier)state.set(x.name,null);
  return {status:'simulated-rollback',liveWritesEnabled:false};
 }
 });
}
async function inspectMockSession({client,config,evidence}={}){
 // Only exposed through the offline harness; callers must inject a fake client.
 if(client?.offlineMock!==true)throw Error('Live SQL transport disabled');
 directTlsConfig(config);
 try{
  const result=await client.query(SETTINGS_SQL,[Object.keys(SETTINGS)]);
  return loggingGate(result.rows,evidence);
 }catch{throw Error('Offline SQL audit failed')}
 finally{await client.end()}
}
module.exports={HOST,SETTINGS,SETTINGS_SQL,directTlsConfig,loggingGate,createOfflineCatalog,inspectMockSession};
