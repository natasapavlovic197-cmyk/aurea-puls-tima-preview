'use strict';
// Candidate only: no automatic installation or network calls.
const URL='https://dlibifwlmbfkboerlmqd.supabase.co';
const KEY='sb_publishable_XFEcctH-xzU6X6ABeIu7mw_IUWVmUhD';
function createProductionPublicConfig({environment,enabled=false,manager=false,employee=false,url=URL,key=KEY}={}) {
 if(environment!=='production'||enabled!==false||typeof manager!=='boolean'||typeof employee!=='boolean'||url!==URL||key!==KEY) throw Error('Invalid or activated production candidate');
 return Object.freeze({environment,enabled:false,manager,employee,url,key,endpoint:'/api/manager-workspace',transport:'postgrest'});
}
module.exports={createProductionPublicConfig};
