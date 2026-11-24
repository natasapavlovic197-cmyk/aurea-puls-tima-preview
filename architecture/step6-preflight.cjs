'use strict';
// Pure evidence checklist. Never activates, writes, reads secrets or calls network.
const {SITE,REF,BRANCH}=require('./staging-admin-preflight.cjs');
const REQUIRED=['step5LockVerified','lockedBlobsVerified','targetVerified','hostConfirmed','tlsVerified','restrictedRolesVerified','employeeReadOnlyVerified','managerAuthVerified','tenantIsolationVerified','publicationPrivacyVerified','differencingReviewed','secretScopeVerified','rollbackReviewed','buildsStopped','productionExcluded','ownerApprovalForSeparateActivation'];
function step6Preflight({evidence={},env={}}={}){
 const flags=['AUREA_B2B_MANAGER_ENABLED','AUREA_B2B_MANAGER_DEPLOY_APPROVED','AUREA_B2B_EMPLOYEE_ENABLED','AUREA_B2B_EMPLOYEE_DEPLOY_APPROVED'];
 const checks={site:evidence.siteId===SITE,project:evidence.projectRef===REF,branch:evidence.branch===BRANCH,flagsDisabled:flags.every(k=>env[k]===undefined||env[k]==='false')};
 for(const k of REQUIRED)checks[k]=evidence[k]===true;
 return Object.freeze({mode:'offline-evidence-only',checks:Object.freeze(checks),eligibleForSeparateActivationReview:Object.values(checks).every(Boolean),activated:false,executed:false});
}
module.exports={step6Preflight,REQUIRED};
