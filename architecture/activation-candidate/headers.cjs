'use strict';
const {API}=require('./policy.cjs');
const common="Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff";
const restrictive="connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'";
const active="connect-src "+API+"; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
function rule(path,csp,noStore=false){return path+'\n  '+common+'\n  Content-Security-Policy: '+csp+(noStore?'\n  Cache-Control: no-store':'')+'\n';}
// Enumerate known original routes to avoid an overlapping wildcard CSP.
// Must verify effective Netlify header semantics on a non-production test before activation.
function renderHeaders({manager=false,employee=false}={}){
 const roots=['/','/index.html','/zaposleni/*','/rukovodilac/*','/kringle/*','/assets/*','/signature-light.css','/signature-motion.js'];
 const app=['/puls-app/edukacija/*','/puls-app/assets/*','/puls-app/*.js','/puls-app/*.css'];
 return roots.concat(app).map(p=>rule(p,restrictive)).join('\n')+'\n'+rule('/puls-app/rukovodilac/*',manager?active:restrictive,true)+'\n'+rule('/puls-app/zaposleni/*',employee?active:restrictive,true);
}
module.exports={renderHeaders};
