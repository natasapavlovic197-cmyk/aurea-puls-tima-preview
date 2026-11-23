'use strict';
const {bootManagerLogin}=require('./manager-login-bootstrap.cjs');
const {createClient}=require('@supabase/supabase-js');
const root=document.getElementById('manager-login');
try{
 const config=globalThis.AUREA_STAGING_CONFIG;
 if(!config)throw Error('Missing staging configuration');
 bootManagerLogin({root,createClient,url:config.url,key:config.key,endpoint:config.endpoint});
}catch{
 root.querySelector('[role="status"]').textContent='Razvojno okruženje nije dostupno.';
}
