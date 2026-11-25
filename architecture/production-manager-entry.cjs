'use strict';
const {verifyPublic,verifyBrowser,assertBrowser}=require('./postgrest-runtime/production-runtime-gate.cjs');
const {bootManagerLogin}=require('./production-manager-login-bootstrap.cjs');
const {createClient}=require('@supabase/supabase-js');
const root=document.getElementById('manager-login');
try{
 const config=globalThis.AUREA_PRODUCTION_CONFIG;
 assertBrowser('manager',config);
 const transport=config.transport==='postgrest'?require('./postgrest-runtime/production-browser-transport.cjs').createPostgrestTransport({...config,role:'manager'}):undefined;
 bootManagerLogin({root,createClient,config,url:config.url,key:config.key,endpoint:config.endpoint,fetchImpl:transport});
}catch{
 root.querySelector('[role="status"]').textContent='Produkcijsko okruženje još nije aktivirano.';
}
