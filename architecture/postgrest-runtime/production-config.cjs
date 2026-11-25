'use strict';
// Isolated production candidate. No network, deployment, auth or scheduler calls.
const {createHash}=require('node:crypto');
const PUBLIC_KEY_SHA256='5f6e6c5b238556f20798c66e80fa682a8462e0a959704ff24df14ac29a74bf59';
const PROD='https://dlibifwlmbfkboerlmqd.supabase.co';
const STAGING='https://ublzmoroanhlcgpnxilw.supabase.co';
const BASELINE='fa49fe282b08939a002369b2fefdffa5cf601bc1';
const ACTIVATION=['AUREA_DELIVERY_ENABLED','AUREA_DELIVERY_DEPLOY_APPROVED','AUREA_B2B_MANAGER_ENABLED','AUREA_B2B_MANAGER_DEPLOY_APPROVED','AUREA_POSTGREST_STAGING_BUILD'];
const SERVER=['AUREA_DELIVERY_AUTH_USER_ID','AUREA_DELIVERY_AUTH_EMAIL','AUREA_DELIVERY_AUTH_PASSWORD','AUREA_INVITATION_HMAC_SECRET'];
function inspect(env={}){
 const errors=[], missing=[];
 if(env.AUREA_ENVIRONMENT!=='production')errors.push('environment_not_production');
 if(env.AUREA_SUPABASE_URL!==PROD)errors.push('wrong_project');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.AUREA_SUPABASE_PUBLISHABLE_KEY||''))errors.push('publishable_key_required');
 else if(createHash('sha256').update(env.AUREA_SUPABASE_PUBLISHABLE_KEY).digest('hex')!==PUBLIC_KEY_SHA256)errors.push('wrong_project_key');
 for(const k of ACTIVATION)if(env[k]!==undefined&&env[k]!==''&&env[k]!=='false')errors.push('activation_forbidden:'+k);
 for(const k of SERVER)if(env[k])errors.push('deferred_server_identity_or_secret_present:'+k);else missing.push(k);
 // Legacy runtime credentials have no place in the selected HTTPS path.
 for(const k of Object.keys(env))if(env[k]&&(/^(AUREA_STAGING_DATABASE_|AUREA_DELIVERY_DB_)/.test(k)||['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ACCESS_TOKEN','AUREA_LIMITER_SECRET'].includes(k)))errors.push('forbidden_runtime_credential:'+k);
 return {configurationValid:errors.length===0,errors,deferred:missing,activationAllowed:false};
}
function publicConfig(env){
 const r=inspect(env);if(!r.configurationValid)throw Error('Production config rejected: '+r.errors.join(','));
 return Object.freeze({url:PROD,key:env.AUREA_SUPABASE_PUBLISHABLE_KEY,endpoint:'/api/manager-workspace',transport:'postgrest',environment:'production'});
}
module.exports={PROD,STAGING,BASELINE,inspect,publicConfig};
