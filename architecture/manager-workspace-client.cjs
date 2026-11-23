'use strict';
function createWorkspaceClient({endpoint,organizationId,getToken,fetchImpl=globalThis.fetch}={}){
 if(typeof endpoint!=='string'||!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(endpoint)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)||typeof getToken!=='function')throw new TypeError('Invalid workspace configuration');
 async function request(method,input){
  const token=await getToken();
  if(typeof token!=='string'||!token)throw new Error('Session required');
  const r=await fetchImpl(endpoint+'?organization_id='+encodeURIComponent(organizationId),{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},cache:'no-store',credentials:'same-origin',redirect:'error',...(method==='POST'?{body:JSON.stringify(input)}:{})});
  if(!r.ok)throw new Error('Workspace unavailable');
  const result=await r.json();
  if(method==='GET'&&(result?.status!=='ready'||!result.report||!Array.isArray(result.activities)))throw new Error('Invalid workspace response');
  if(method==='POST'&&(result?.status!=='saved'||typeof result.id!=='string'))throw new Error('Activity not saved');
  return result;
 }
 return Object.freeze({load:()=>request('GET'),save:input=>request('POST',input)});
}
if(typeof module!=='undefined')module.exports={createWorkspaceClient};
