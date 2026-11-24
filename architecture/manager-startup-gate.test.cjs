'use strict';
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
for(const flags of [{},{AUREA_B2B_MANAGER_ENABLED:'true'},{AUREA_B2B_MANAGER_DEPLOY_APPROVED:'true'},{AUREA_B2B_MANAGER_ENABLED:'false',AUREA_B2B_MANAGER_DEPLOY_APPROVED:'true'}]){
 const result=spawnSync(process.execPath,[path.join(__dirname,'start-staging-manager.cjs')],{env:flags,encoding:'utf8',timeout:3000});
 assert.notEqual(result.status,0);assert.match(result.stderr,/Manager activation not approved/);
}
console.log('PASS: manager startup denies absent or partial approval before driver load');
