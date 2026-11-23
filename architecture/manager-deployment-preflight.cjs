'use strict';
// Deployment preflight: never prints environment variable values or secrets.
// This does not enable the live endpoint; checks only required configuration.
const REQUIRED=['AUREA_STAGING_DATABASE_HOST','AUREA_STAGING_DATABASE_NAME','AUREA_STAGING_DATABASE_USER','AUREA_STAGING_DATABASE_PASSWORD','AUREA_LIMITER_SECRET','AUREA_SUPABASE_URL','AUREA_SUPABASE_PUBLISHABLE_KEY'];
function managerDeploymentPreflight({env={},driverAvailable=false}={}){
 const missing=REQUIRED.filter(k=>typeof env[k]!=='string'||env[k].length===0);
 const problems=[];
 if(missing.length)problems.push('missing_server_configuration');
 if(env.AUREA_STAGING_DATABASE_USER!=='aurea_limiter_login')problems.push('restricted_login_required');
 if(typeof env.AUREA_STAGING_DATABASE_HOST!=='string'||!/^[a-z0-9.-]+$/i.test(env.AUREA_STAGING_DATABASE_HOST)||!env.AUREA_STAGING_DATABASE_HOST.endsWith('.supabase.com'))problems.push('database_host_invalid');
 if(typeof env.AUREA_STAGING_DATABASE_NAME!=='string'||!env.AUREA_STAGING_DATABASE_NAME.trim())problems.push('database_name_invalid');
 if(typeof env.AUREA_SUPABASE_URL!=='string'||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(env.AUREA_SUPABASE_URL))problems.push('supabase_url_invalid');
 if(typeof env.AUREA_LIMITER_SECRET!=='string'||env.AUREA_LIMITER_SECRET.length<32)problems.push('limiter_secret_invalid');
 if(typeof env.AUREA_STAGING_DATABASE_PASSWORD!=='string'||env.AUREA_STAGING_DATABASE_PASSWORD.length<24)problems.push('database_password_invalid');
 if(!driverAvailable)problems.push('postgres_driver_unavailable');
 if(env.AUREA_B2B_MANAGER_ENABLED!=='true'||env.AUREA_B2B_MANAGER_DEPLOY_APPROVED!=='true')problems.push('deployment_not_approved');
 return Object.freeze({ready:problems.length===0,problems:[...new Set(problems)]});
}
module.exports={managerDeploymentPreflight};
