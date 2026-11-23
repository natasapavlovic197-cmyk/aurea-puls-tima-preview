'use strict';
function createEmployeePostgresBridge({query}={}){
 if(typeof query!=='function')throw TypeError('Restricted database query required');
 return async function rpc(name,args){
 if(typeof args?.p_hash!=='string'||!/^[a-f0-9]{64}$/.test(args.p_hash))throw Error('Invalid invitation hash');
 let result;
 if(name==='aurea_employee_invitation'){
 result=await query('select public.aurea_employee_invitation($1::text) as result',[args.p_hash]);
 }else if(name==='aurea_employee_submit'){
 if(!Array.isArray(args.p_answers)||args.p_answers.length!==6)throw Error('Invalid answers');
 result=await query('select public.aurea_employee_submit($1::text,$2::jsonb) as result',[args.p_hash,JSON.stringify(args.p_answers)]);
 }else throw Error('RPC not permitted');
 const value=result?.rows?.[0]?.result;
 if(!value||typeof value.status!=='string')throw Error('Invalid database response');
 return value;
 };
}
module.exports={createEmployeePostgresBridge};
