'use strict';
function createCompanyReader({url,key,fetchImpl=globalThis.fetch}={}){
 const base=new URL(url);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash||!base.hostname.endsWith('.supabase.co')||typeof key!=='string'||!key.startsWith('sb_publishable_'))throw TypeError('Invalid public API configuration');
 return async function readCompanies(token){
 if(typeof token!=='string'||!token)throw Error('Session required');
 const response=await fetchImpl(base.origin+'/rest/v1/rpc/aurea_my_companies',{method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},body:'{}',cache:'no-store',redirect:'error',credentials:'omit'});
 if(!response.ok)throw Error('Companies unavailable');
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>1000||rows.some(r=>!r||!['owner','manager'].includes(r.member_role)||typeof r.organization_id!=='string'||typeof r.organization_name!=='string'))throw Error('Invalid company response');
 return rows.map(r=>({id:r.organization_id,name:r.organization_name}));
 };
}
module.exports={createCompanyReader};
