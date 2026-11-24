'use strict';
const assert=require('node:assert/strict');
const {poolerConfig,REF,LOGIN}=require('./staging-pooler-config.cjs');
// Synthetic host index: actual endpoint must be confirmed in the project Connect panel.
const env={AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:`${LOGIN}.${REF}`,AUREA_SUPABASE_URL:`https://${REF}.supabase.co`};
const c=poolerConfig(env);assert.equal(c.port,5432);assert.equal(c.ssl.rejectUnauthorized,true);assert.equal(c.user,`${LOGIN}.${REF}`);assert.equal(c.password,undefined);
for(const patch of [{AUREA_STAGING_DATABASE_USER:`postgres.${REF}`},{AUREA_STAGING_DATABASE_USER:LOGIN},{AUREA_STAGING_DATABASE_USER:`${LOGIN}.foreign`},{AUREA_SUPABASE_URL:'https://foreign.supabase.co'},{AUREA_STAGING_DATABASE_HOST:'evil.com'},{AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com.evil.net'},{AUREA_STAGING_DATABASE_HOST:'aws-9-us-east-1.pooler.supabase.com'},{AUREA_STAGING_DATABASE_HOST:'db.ublzmoroanhlcgpnxilw.supabase.co'},{AUREA_STAGING_DATABASE_NAME:'other'}]) assert.throws(()=>poolerConfig({...env,...patch}));
assert.throws(()=>poolerConfig());
console.log('PASS: pooler configuration and rejection tests (synthetic only)');
