'use strict';
const {bootManagerLogin}=require('./manager-login-bootstrap.cjs');
const {createClient}=require('@supabase/supabase-js');
const root=document.getElementById('manager-login');
try{
 const config=globalThis.AUREA_STAGING_CONFIG;
 if(!config)throw Error('Missing staging configuration');
 const transport=config.transport==='postgrest'?require('./postgrest-runtime/browser-transport.cjs').createPostgrestTransport(config):undefined;
 bootManagerLogin({root,createClient,url:config.url,key:config.key,endpoint:config.endpoint,fetchImpl:transport});
}catch{
 root.querySelector('[role="status"]').textContent='Razvojno okruženje nije dostupno.';
}
