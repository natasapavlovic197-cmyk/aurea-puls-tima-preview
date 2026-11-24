'use strict';
// Readiness gate only. Does not schedule, send, deploy or access credentials.
const required=['productionProject','legacyEndpointRetired','managerSecurityReviewed','passwordPolicyReviewed','dedicatedRuntimeIdentity','stableHmacSecret','verifiedSender','schedulerConfigured','providerReconciliation','browserAcceptance','backupRestore','privacyAgreement','tenantOnboarding','operatorApproval'];
function assessRelease(evidence={}){
 const missing=required.filter(k=>evidence[k]!==true);
 return Object.freeze({ready:missing.length===0,missing:Object.freeze(missing),activationPerformed:false});
}
module.exports={assessRelease,required:Object.freeze(required)};
