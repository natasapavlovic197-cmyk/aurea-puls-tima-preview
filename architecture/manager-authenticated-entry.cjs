'use strict';
const {createSessionAdapter}=require('./manager-session-adapter.cjs');
const {createCompanyReader}=require('./manager-company-reader.cjs');
const {createCompanySelector}=require('./manager-company-selector.cjs');
const {startManagerWorkspace}=require('./manager-workspace-entry.cjs');
async function openAuthenticatedManager({root,provider,url,key,endpoint,fetchImpl}={}){
 const session=createSessionAdapter(provider);
 let selector;
 try{
  selector=createCompanySelector({session,readCompanies:createCompanyReader({url,key,fetchImpl}),startWorkspace:organizationId=>{
   const host=root.ownerDocument.createElement('section');
   root.replaceChildren(host);
   return startManagerWorkspace({root:host,endpoint,organizationId,session,fetchImpl});
  }});
  const companies=await selector.load();
  return Object.freeze({companies,select:id=>selector.select(id),async signOut(){try{await session.signOut();}finally{selector.dispose();session.dispose();root.replaceChildren();}},dispose(){selector.dispose();session.dispose();root.replaceChildren();}});
 }catch(e){selector?.dispose();session.dispose();root.replaceChildren();throw e;}
}
module.exports={openAuthenticatedManager};
