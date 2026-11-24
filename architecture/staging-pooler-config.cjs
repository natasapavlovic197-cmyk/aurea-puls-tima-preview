'use strict';
const REF='ublzmoroanhlcgpnxilw';
const LOGIN='aurea_limiter_login';
function poolerConfig(env={}){
  const host=env.AUREA_STAGING_DATABASE_HOST;
  if(typeof host!=='string'||!/^aws-\d+-eu-west-1\.pooler\.supabase\.com$/.test(host)) throw new Error('Unexpected database host');
  if(env.AUREA_SUPABASE_URL!==`https://${REF}.supabase.co`) throw new Error('Unexpected staging project');
  if(env.AUREA_STAGING_DATABASE_USER!==`${LOGIN}.${REF}`) throw new Error('Restricted pooler login required');
  if(env.AUREA_STAGING_DATABASE_NAME!=='postgres') throw new Error('Unexpected database name');
  return Object.freeze({host,port:5432,database:'postgres',user:`${LOGIN}.${REF}`,ssl:{rejectUnauthorized:true}});
}
module.exports={poolerConfig,REF,LOGIN};
