'use strict';
const {API}=require('./policy.cjs');
const common="X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff";
const restrictive="connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'";
const active="connect-src "+API+"; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
function rule(path,csp,noStore=false){return path+'\n  '+(csp?'Content-Security-Policy: '+csp+'\n  ':'')+(noStore?'Cache-Control: no-store\n  ':'')+'\n';}
function renderHeaders({manager=false,employee=false}={}){
 const general='/*\n  '+common+'\n';
 const fixed=['/','/index','/index.html','/zaposleni','/zaposleni/*','/rukovodilac','/rukovodilac/*','/kringle','/kringle/*','/assets/*','/signature-light.css','/signature-motion.js','/puls-app/edukacija','/puls-app/edukacija/*','/puls-app/assets/*','/puls-app/employee.bundle.js','/puls-app/manager-login.bundle.js','/puls-app/manager-login.css','/puls-app/signature-motion.js','/puls-app/signature22-employee.css','/puls-app/signature22-manager.css'];
 const r=(path,csp,ns=false)=>path+'\n  Content-Security-Policy: '+csp+'\n'+(ns?'  Cache-Control: no-store\n':'');
 return general+'\n'+fixed.map(p=>r(p,restrictive)).join('\n')+'\n'+r('/puls-app/production-config.js',restrictive,true)+['rukovodilac','zaposleni'].map((p,i)=>r('/puls-app/'+p,(i===0?manager:employee)?active:restrictive,true)+'\n'+r('/puls-app/'+p+'/*',(i===0?manager:employee)?active:restrictive,true)).join('\n');
}
module.exports={renderHeaders};
