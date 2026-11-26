'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const [repo,rc,out]=process.argv.slice(2).map(x=>path.resolve(x));
const arch=path.join(repo,'architecture'),r=createRequire(path.join(repo,'package.json')),esbuild=r('esbuild');
const git=(...x)=>cp.execFileSync('git',['-C',repo,...x],{encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!=='7e2908e4e8c234a4bb8056f2017f02c70cfdb7c5'||git('status','--porcelain'))throw Error('Pinned clean source required');
const prod=r(path.join(arch,'postgrest-runtime/production-public-config.cjs')).createProductionPublicConfig({environment:'production'}),stage=r(path.join(arch,'postgrest-runtime/staging-public-config.cjs')),policy=r(path.join(arch,'activation-candidate/policy.cjs'));
const edu=r(path.join(arch,'signature22-education.cjs')),master=fs.readFileSync(path.join(arch,'assets/signature22-kringle.locked.html'));
if(crypto.createHash('sha256').update(master).digest('hex')!==edu.LOCK)throw Error('Signature source drift');
const mkdir=p=>fs.mkdirSync(p,{recursive:true}),write=(p,s)=>{mkdir(path.dirname(p));fs.writeFileSync(p,s)},copy=(a,b)=>{mkdir(path.dirname(b));fs.copyFileSync(a,b)};
const browser={bundle:true,platform:'browser',format:'iife',minify:true,nodePaths:[path.join(repo,'node_modules')]};
const server={bundle:true,platform:'node',target:'node22',format:'esm',banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'}};
const route='/puls-app/edukacija/';
const managerFrame="module.exports={educationFrame:()=>'<section class=\"panel section fade\"><h2>Razgovori sa likovima</h2><p>Licencirani prostor. Potvrdite pristup zasebnom prijavom.</p><a class=\"btn primary\" href=\"/puls-app/edukacija/\" target=\"_blank\" rel=\"noopener noreferrer\">Otvorite edukativne simulacije</a><button class=\"btn\" type=\"button\" id=\"signatureEducationExit\">Nazad na moj pregled</button></section>'};";
const plugin={name:'protected-education-route',setup(b){b.onLoad({filter:/signature22-education-frame\.cjs$/},()=>({contents:managerFrame,loader:'js'}))}};
function pagePaths(html){return html.replaceAll('/staging-config.js','/puls-app/production-config.js').replace(/(["'])\/(signature22-(?:manager|employee)\.css|signature-motion\.js|manager-login\.bundle\.js|employee\.bundle\.js)(["'])/g,'$1/puls-app/$2$3')}
function headers(api){
 const original=r(path.join(arch,'activation-candidate/headers.cjs')).renderHeaders();let n=0;
 const result=original.trimEnd().split(/\n\s*\n/).map(b=>{const name=b.split('\n')[0];if(!['/puls-app/edukacija','/puls-app/edukacija/*'].includes(name))return b;n++;return name+"\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-src 'self' about:; connect-src 'self' "+api+"; form-action 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'\n  Cache-Control: no-store"});
 if(n!==2)throw Error('Header anchor changed');return result.join('\n\n')+'\n';
}
(async()=>{
 if(fs.existsSync(out))throw Error('Fresh output required');
 const work=path.join(out,'build-input');mkdir(work);
 for(const f of ['education-login.cjs','education-client.cjs','education-handler.cjs'])copy(path.join(rc,'runtime',f),path.join(work,f));
 write(path.join(work,'locked-document.json'),JSON.stringify(edu.educationDocument(master)));
 copy(path.join(arch,'activation-candidate/policy.cjs'),path.join(work,'policy.cjs'));
 write(path.join(work,'education-settings.cjs'),"'use strict';\nconst stage="+JSON.stringify({url:stage.url,key:stage.key})+",prod="+JSON.stringify({url:prod.url,key:prod.key,origin:policy.ORIGIN})+";\nconst {policy}=require('./policy.cjs');\nfunction settings(env={}){if(env.AUREA_ENVIRONMENT==='staging'){const origin=env.AUREA_STAGE_EDUCATION_ORIGIN||'';let valid=false;try{const x=new URL(origin);valid=x.protocol==='https:'&&x.origin===origin&&origin!==prod.origin&&!x.username&&!x.password}catch{};return {...stage,origin,enabled:valid&&env.AUREA_SUPABASE_URL===stage.url&&env.AUREA_SUPABASE_PUBLISHABLE_KEY===stage.key&&env.AUREA_STAGE_EDUCATION_APPROVAL==='approved-isolated-staging-education-v1'&&env.AUREA_ENABLE_STAGE_EDUCATION==='true'};}const p=policy(env);return {...prod,enabled:env.AUREA_SUPABASE_PUBLISHABLE_KEY===prod.key&&(p.manager||p.employee)};}\nmodule.exports={settings};");
 write(path.join(work,'aurea-education.mjs'),"import h from './education-handler.cjs';\nimport doc from './locked-document.json';\nimport settings from './education-settings.cjs';\nexport const config={path:'/api/education',method:['POST'],rateLimit:{windowLimit:20,windowSize:60,aggregateBy:['ip','domain']}};\nexport default req=>{const s=settings.settings(process.env);if(!s.enabled)return new Response('',{status:403,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});return h.createEducationHandler({url:s.url,publishableKey:s.key,origin:s.origin,document:doc,enabled:s.enabled})(req);};\n");
 const assembled=path.join(out,'production'),pub=path.join(assembled,'publish'),app=path.join(pub,'puls-app');
 for(const [env,pair] of [['production',prod],['staging',stage]]){
  const dest=path.join(out,env),p=path.join(dest,'publish'),dir=path.join(p,'puls-app/edukacija');
  for(const f of ['education.html','education.css'])copy(path.join(rc,'integration',f),path.join(dir,f==='education.html'?'index.html':f));
  write(path.join(dir,'education-config.js'),'globalThis.AUREA_EDUCATION_CONFIG=Object.freeze('+JSON.stringify({environment:env,url:pair.url,key:pair.key,origin:env==='production'?policy.ORIGIN:'',enabled:false})+');\n');
  await esbuild.build({...browser,entryPoints:[path.join(work,'education-login.cjs')],outfile:path.join(dir,'education.bundle.js')});
  await esbuild.build({...server,entryPoints:[path.join(work,'aurea-education.mjs')],outfile:path.join(dest,'server-functions/aurea-education.mjs')});
  write(path.join(p,'_headers'),headers(pair.url));
  write(path.join(p,'_redirects'),['/signature-education.html','/signature-education','/puls-app/signature-education.html','/puls-app/signature-education','/puls-app/rukovodilac/signature-education.html','/puls-app/edukacija/signature-education.html'].map(x=>x+' '+route+' 302!').join('\n')+'\n');
  write(path.join(dest,'netlify.toml'),'[build]\n  publish = "publish"\n  functions = "server-functions"\n[functions]\n  node_bundler = "esbuild"\n');
 }
 write(path.join(app,'rukovodilac/index.html'),pagePaths(r(path.join(arch,'premium-manager-template.cjs')).premiumManager(fs.readFileSync(path.join(repo,'rukovodilac/index.html'),'utf8'))));
 write(path.join(app,'zaposleni/index.html'),pagePaths(r(path.join(arch,'premium-employee-template.cjs')).premiumEmployee(fs.readFileSync(path.join(arch,'employee-six-question-preview.html'),'utf8'))));
 write(path.join(app,'production-config.js'),'globalThis.AUREA_PRODUCTION_CONFIG=Object.freeze('+JSON.stringify(prod)+');\n');
 await esbuild.build({...browser,plugins:[plugin],entryPoints:[path.join(arch,'production-manager-entry.cjs')],outfile:path.join(app,'manager-login.bundle.js')});
 await esbuild.build({...browser,entryPoints:[path.join(arch,'production-employee-entry.cjs')],outfile:path.join(app,'employee.bundle.js')});
 for(const f of ['manager-login.css','signature22-manager.css','signature22-employee.css','signature-motion.js'])copy(path.join(arch,f),path.join(app,f));
 copy(path.join(arch,'assets/natasa-guide.webp'),path.join(pub,'assets/natasa-guide.webp'));
 for(const n of ['aurea-tick','aurea-job-background','aurea-admin'])await esbuild.build({...server,entryPoints:[path.join(arch,'activation-candidate/netlify-functions',n+'.mjs')],outfile:path.join(assembled,'server-functions',n+'.mjs')});
 await esbuild.build({...browser,entryPoints:[path.join(arch,'activation-candidate/private-admin-entry.cjs')],outfile:path.join(out,'private-admin/admin.bundle.js')});
 const admin=fs.readFileSync(path.join(arch,'activation-candidate/private-admin.html'),'utf8');
 write(path.join(out,'private-admin/index.html'),admin.replace('<section id="workspace" hidden>','<section id="workspace" hidden><p>3 EUR mesečno ili 30 EUR godišnje unapred po licenciranom korisniku. Bez minimuma. Poklon licenca: 0 EUR.</p>'));
 copy(path.join(arch,'activation-candidate/admin.css'),path.join(out,'private-admin/admin.css'));
 for(const f of ['micro.review.sql','micro.rollback.sql','history.readonly.sql'])copy(path.join(rc,'database',f),path.join(out,'database',f));
 const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
 for(const p of [pub,path.join(out,'staging/publish')])for(const f of walk(p).filter(f=>/\.(?:html|js)$/.test(f))){const s=fs.readFileSync(f,'utf8');if(s.includes('signatureEducationIsolation')&&f.endsWith('.html'))throw Error('Public education payload');if(/sb_secret_[A-Za-z0-9_-]+|AUREA_RESEND_API_KEY|AUREA_WORKER_AUTH_PASSWORD/.test(s))throw Error('Server credential marker');}
 const mb=fs.readFileSync(path.join(app,'manager-login.bundle.js'),'utf8');if(mb.includes('/signature-education.html')||!mb.includes(route))throw Error('Manager route mismatch');
 fs.rmSync(work,{recursive:true,force:true});
 if(git('status','--porcelain'))throw Error('Source changed');
 write(path.join(out,'READ-ME.txt'),'REVIEW OVERLAY ONLY. No deploy. Production and staging education OFF. Merge with separately verified public static demo bytes; retain old headers and remove/redirect old education aliases. Private admin separate. Staging origin and expiring grant need owner approval. Actual Netlify header precedence and live Auth settings are not inferred from isolation.\n');
 console.log('PASS pinned build, separate stage/prod configs, protected manager route, publish/functions paths and alias rules');
})().catch(e=>{console.error(e);process.exitCode=1});
