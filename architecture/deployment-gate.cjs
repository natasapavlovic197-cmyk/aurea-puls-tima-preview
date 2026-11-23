'use strict';
// Non-deployed deployment gate: an API runtime is only eligible when ALL
// externally supplied production dependencies have been configured and tested.
// This is not a substitute for real environment checks or penetration testing.
const REQUIRED=['database','durableRateLimiter','authVerifier','membershipVerifier','publicationStore','auditRedactor'];
function checkDeploymentGate(deps={}){
 const missing=REQUIRED.filter(key=>typeof deps[key]!=='function');
 return Object.freeze({ready:missing.length===0,missing,employeeEndpointEnabled:missing.length===0,managerEndpointEnabled:missing.length===0});
}
module.exports={checkDeploymentGate,REQUIRED};
