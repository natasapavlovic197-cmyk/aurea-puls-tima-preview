'use strict';
const assert=require('node:assert/strict');
const {managerDeploymentPreflight}=require('./manager-deployment-preflight.cjs');
const env={AUREA_STAGING_DATABASE_HOST:'aws-9-eu-west-1.pooler.supabase.com',AUREA_STAGING_DATABASE_NAME:'postgres',AUREA_STAGING_DATABASE_USER:'aurea_limiter_login.ublzmoroanhlcgpnxilw',AUREA_STAGING_DATABASE_PASSWORD:'x'.repeat(32),AUREA_LIMITER_SECRET:'y'.repeat(64),AUREA_SUPABASE_URL:'https://ublzmoroanhlcgpnxilw.supabase.co',AUREA_SUPABASE_PUBLISHABLE_KEY:'test-key',AUREA_B2B_MANAGER_ENABLED:'true',AUREA_B2B_MANAGER_DEPLOY_APPROVED:'true'};
const ready=managerDeploymentPreflight({env,driverAvailable:true});assert.equal(ready.ready,true);
const blocked=managerDeploymentPreflight({env:{...env,AUREA_STAGING_DATABASE_USER:'postgres',AUREA_STAGING_DATABASE_PASSWORD:'SENSITIVE_TEST_SECRET'},driverAvailable:false});
assert.equal(blocked.ready,false);assert.ok(blocked.problems.includes('restricted_login_required'));assert.ok(blocked.problems.includes('postgres_driver_unavailable'));assert.equal(JSON.stringify(blocked).includes('SENSITIVE_TEST_SECRET'),false);
for(const [patch,expected] of [[{AUREA_STAGING_DATABASE_HOST:'evil.com'},'database_host_invalid'],[{AUREA_STAGING_DATABASE_HOST:'db.example.supabase.com.evil.net'},'database_host_invalid'],[{AUREA_STAGING_DATABASE_NAME:'   '},'database_name_invalid'],[{AUREA_SUPABASE_URL:'http://example.supabase.co'},'supabase_url_invalid'],[{AUREA_SUPABASE_URL:'https://example.supabase.co.evil.net'},'supabase_url_invalid']]){
 const result=managerDeploymentPreflight({env:{...env,...patch},driverAvailable:true});
 assert.equal(result.ready,false);assert.ok(result.problems.includes(expected));
}
assert.equal(managerDeploymentPreflight().ready,false);
console.log('PASS: safe deployment preflight rejects missing driver, privileged login and secrets without echoing values');
