'use strict';
// Immutable disabled gate: enabling requires a separately approved code change.
// No env flag, URL parameter, browser config or service credential can enable this candidate.
const {createProductionPublicConfig}=require('./production-public-config.cjs');
const canonical=createProductionPublicConfig({environment:'production'});
function verifyPublic({url,key}={}) {
 if(url!==canonical.url||key!==canonical.key)throw Error('Production project/key mismatch');
 return canonical;
}
function verifyBrowser(config) {
 if(config?.environment!=='production'||config.enabled!==false||config.transport!=='postgrest'||config.endpoint!=='/api/manager-workspace')throw Error('Invalid disabled production configuration');
 return verifyPublic(config);
}
function assertActive(){throw Error('Production activation not approved');}
function assertBrowser(role,config){verifyBrowser(config);if(!['manager','employee'].includes(role)||config[role]!==true)throw Error('Role activation not approved');}
module.exports=Object.freeze({verifyPublic,verifyBrowser,assertActive,assertBrowser,activated:false});
