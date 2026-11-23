'use strict';
function createCompanySelector({session,readCompanies,startWorkspace}={}){
 if(typeof session?.getAccessToken!=='function'||typeof session?.onSignOut!=='function'||typeof readCompanies!=='function'||typeof startWorkspace!=='function')throw TypeError('Missing company dependencies');
 let companies=new Map(),active=null,closed=false,generation=0;
 const stop=()=>{closed=true;generation++;companies.clear();active?.dispose();active=null;};
 const unsubscribe=session.onSignOut(stop);
 return Object.freeze({
 async load(){
  const g=++generation;companies.clear();active?.dispose();active=null;
  const token=await session.getAccessToken();if(closed||!token)throw Error('Session required');
  const rows=await readCompanies(token);
  if(closed||g!==generation)throw Error('Selection expired');
  if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid companies');
  const next=new Map();
  for(const row of rows){if(!row||typeof row.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)||typeof row.name!=='string'||!row.name.trim()||next.has(row.id))throw Error('Invalid company');next.set(row.id,{id:row.id,name:row.name});}
  companies=next;return [...companies.values()].map(x=>({...x}));
 },
 async select(id){
  if(closed||!companies.has(id))throw Error('Company unavailable');
  const g=++generation;active?.dispose();active=null;
  const workspace=await startWorkspace(id);
  if(closed||g!==generation){workspace.dispose();throw Error('Selection expired');}
  active=workspace;return workspace;
 },
 dispose(){stop();if(typeof unsubscribe==='function')unsubscribe();}
 });
}
module.exports={createCompanySelector};
