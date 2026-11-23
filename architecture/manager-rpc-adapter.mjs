/**
 * AUREA staging adapter. No credentials, automatic calls, or DOM changes.
 * Pass a pre-authenticated Supabase client from a trusted bootstrap.
 * The server RPC must independently enforce tenant membership.
 */
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validClient(client){if(!client||typeof client.rpc!=='function')throw new TypeError('Authenticated Supabase client required')}
async function call(client,name,args={}){validClient(client);const {data,error}=await client.rpc(name,args);if(error)throw new Error('Zahtev nije uspeo. Proverite prijavu i ovlašćenja.');return data}
export async function myCompanies(client){return call(client,'aurea_my_companies')}
export function managerClient(client,companyId){
 validClient(client);
 if(!ID.test(companyId))throw new TypeError('Invalid company identifier');
 const args={p_organization_id:companyId};
 return Object.freeze({
  cycles:()=>call(client,'aurea_manager_cycles',args),
  summary:()=>call(client,'aurea_manager_summary',args),
  actions:()=>call(client,'aurea_manager_actions',args),
  saveAction:({description,dueOn=null,cycleId=null,actionId=null,status='open'})=>{
   if(typeof description!=='string'||description.trim().length<8||description.length>600)throw new TypeError('Invalid description');
   if(!['open','done'].includes(status))throw new TypeError('Unsupported status in current staging RPC');
   if(cycleId!==null&&!ID.test(cycleId))throw new TypeError('Invalid cycle identifier');
   if(actionId!==null&&!ID.test(actionId))throw new TypeError('Invalid action identifier');
   return call(client,'aurea_manager_save_action',{...args,p_description:description.trim(),p_due_on:dueOn,p_cycle_id:cycleId,p_action_id:actionId,p_status:status});
  }
 });
}
