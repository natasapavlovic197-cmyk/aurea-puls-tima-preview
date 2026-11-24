'use strict';
// REVIEW ONLY: candidate disclosure rule; not a guarantee of anonymity.
// Exact binary counts are used internally only, never emitted by this helper.
function eligibleForPublication({valid,favorable,invited}={}){
 if(![valid,favorable,invited].every(Number.isSafeInteger)||valid<5||valid>invited||favorable<0||favorable>valid)return false;
 // Protect both favorable and other valid responses from singleton/unanimity disclosure.
 return favorable>=2&&valid-favorable>=2;
}
module.exports={eligibleForPublication};
