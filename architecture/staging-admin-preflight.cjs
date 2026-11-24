'use strict';
// Pure, offline gate: no network, credentials, filesystem writes or deployment.
const SITE='91ffeb5a-796e-4b2a-9fde-517c7e42f708', REF='ublzmoroanhlcgpnxilw', BRANCH='integration/employee-ten-domains-step5';
function evaluate(x={}) {
 const checks={site:x.siteId===SITE&&x.siteName==='aurea-puls-tima-preview',project:x.projectRef===REF,host:typeof x.host==='string'&&/^aws-\d+-eu-west-1\.pooler\.supabase\.com$/.test(x.host)&&x.hostConfirmed===true, tls:x.tlsVerified===true, login:x.user===`aurea_limiter_login.${REF}`&&x.port===5432&&x.database==='postgres',roles:x.restrictedRolesVerified===true,builds:x.buildsStopped===true,scope:x.functionsScopeAvailable===true,write:x.writeAuthorityVerified===true,context:x.branch===BRANCH&&x.productionExcluded===true,collision:x.noExistingSecretConflict===true,approval:x.ownerApproval===true,flags:x.managerFlagsDisabled===true};
 return {checks,eligibleForSeparateProvisioning: Object.values(checks).every(Boolean),executed:false,mode:'offline-dry-run'};
}
module.exports={evaluate,SITE,REF,BRANCH};
