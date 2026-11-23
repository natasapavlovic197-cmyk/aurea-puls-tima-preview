'use strict';
const {createWorkspaceClient}=require('./manager-workspace-client.cjs');
const {mountManagerWorkspace}=require('./manager-workspace-view.js');
async function startManagerWorkspace({root,endpoint,organizationId,session,fetchImpl}={}){
 if(!root||typeof session?.getAccessToken!=='function'||typeof session?.onSignOut!=='function')throw new TypeError('Authenticated session required');
 let closed=false,view;
 const stop=()=>{closed=true;view?.dispose();root.replaceChildren();};
 const unsubscribe=session.onSignOut(stop);
 try{
  const client=createWorkspaceClient({endpoint,organizationId,fetchImpl,getToken:async()=>closed?null:session.getAccessToken()});
  if(!await session.getAccessToken()||closed)throw new Error('Session required');
  view=mountManagerWorkspace(root,client);
  await view.refresh();
  return Object.freeze({refresh:()=>closed?Promise.resolve():view.refresh(),dispose(){stop();if(typeof unsubscribe==='function')unsubscribe();}});
 }catch(error){stop();if(typeof unsubscribe==='function')unsubscribe();throw error;}
}
module.exports={startManagerWorkspace};
