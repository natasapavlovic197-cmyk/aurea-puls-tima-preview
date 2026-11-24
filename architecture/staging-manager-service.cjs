'use strict';
// Server-only PostgreSQL bootstrap. No secrets embedded in source.
const {createRestrictedLimiterQuery}=require('./restricted-pg-query.cjs');
const {poolerConfig}=require('./staging-pooler-config.cjs');
const {createManagerRuntime}=require('./manager-runtime.cjs');
function createStagingManagerService({env,Pool,fetchImpl}={}){
 if(typeof Pool!=='function'||!env||typeof env!=='object')throw new TypeError('Missing runtime');
 const required=['AUREA_STAGING_DATABASE_HOST','AUREA_STAGING_DATABASE_NAME','AUREA_STAGING_DATABASE_PASSWORD','AUREA_LIMITER_SECRET','AUREA_SUPABASE_URL','AUREA_SUPABASE_PUBLISHABLE_KEY'];
 if(required.some(k=>typeof env[k]!=='string'||!env[k]))throw new TypeError('Missing required server configuration');
 if(env.AUREA_B2B_MANAGER_ENABLED!=='true'||env.AUREA_B2B_MANAGER_DEPLOY_APPROVED!=='true')throw new TypeError('Manager service not approved');
 const connection=poolerConfig(env);
 if(env.AUREA_STAGING_DATABASE_PASSWORD.length<24)throw new TypeError('Weak server password');
 const pool=new Pool({
  ...connection,
  password:env.AUREA_STAGING_DATABASE_PASSWORD,
  max:3,
  connectionTimeoutMillis:4000,
  idleTimeoutMillis:10000
 });
 const query=createRestrictedLimiterQuery({pool});
 const handler=createManagerRuntime({supabaseUrl:env.AUREA_SUPABASE_URL,publishableKey:env.AUREA_SUPABASE_PUBLISHABLE_KEY,limiterSecret:env.AUREA_LIMITER_SECRET,fetchImpl,query});
 return Object.freeze({handler,close:()=>pool.end()});
}
module.exports={createStagingManagerService};
