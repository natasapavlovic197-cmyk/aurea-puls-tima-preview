'use strict';
// Server-only PostgreSQL bootstrap. No secrets embedded in source.
const {createRestrictedLimiterQuery}=require('./restricted-pg-query.cjs');
const {createManagerRuntime}=require('./manager-runtime.cjs');
function createStagingManagerService({env,Pool,fetchImpl}={}){
 if(typeof Pool!=='function'||!env||typeof env!=='object')throw new TypeError('Missing runtime');
 const required=['AUREA_STAGING_DATABASE_HOST','AUREA_STAGING_DATABASE_NAME','AUREA_STAGING_DATABASE_PASSWORD','AUREA_LIMITER_SECRET','AUREA_SUPABASE_URL','AUREA_SUPABASE_PUBLISHABLE_KEY'];
 if(required.some(k=>typeof env[k]!=='string'||!env[k]))throw new TypeError('Missing required server configuration');
 if(env.AUREA_STAGING_DATABASE_USER!=='aurea_limiter_login')throw new TypeError('Restricted SQL login required');
 if(env.AUREA_B2B_MANAGER_ENABLED!=='true')throw new TypeError('Manager service not approved');
 if(!/^[a-z0-9.-]+$/i.test(env.AUREA_STAGING_DATABASE_HOST)||!env.AUREA_STAGING_DATABASE_HOST.endsWith('.supabase.com'))throw new TypeError('Unexpected database host');
 if(env.AUREA_STAGING_DATABASE_PASSWORD.length<24)throw new TypeError('Weak server password');
 const pool=new Pool({
  host:env.AUREA_STAGING_DATABASE_HOST,
  port:5432,
  database:env.AUREA_STAGING_DATABASE_NAME,
  user:'aurea_limiter_login',
  password:env.AUREA_STAGING_DATABASE_PASSWORD,
  ssl:{rejectUnauthorized:true},
  max:3,
  connectionTimeoutMillis:4000,
  idleTimeoutMillis:10000
 });
 const query=createRestrictedLimiterQuery({pool});
 const handler=createManagerRuntime({supabaseUrl:env.AUREA_SUPABASE_URL,publishableKey:env.AUREA_SUPABASE_PUBLISHABLE_KEY,limiterSecret:env.AUREA_LIMITER_SECRET,fetchImpl,query});
 return Object.freeze({handler,close:()=>pool.end()});
}
module.exports={createStagingManagerService};
