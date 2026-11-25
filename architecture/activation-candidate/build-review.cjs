'use strict';
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const {createProductionPublicConfig}=require('../postgrest-runtime/production-public-config.cjs');
const {renderHeaders}=require('./headers.cjs');
(async()=>{
 const out=path.resolve('activation-review-output');if(fs.existsSync(out))throw Error('Output already exists');
 for(const dir of ['browser-overlay/puls-app','server-functions','private-admin','database','docs'])fs.mkdirSync(path.join(out,dir),{recursive:true});
 // Candidate is locked OFF. Browser bundles contain capability paths, but live DB and deployment remain unchanged.
 const cfg=createProductionPublicConfig({environment:'production'});
 const options={bundle:true,platform:'browser',format:'iife',minify:true};
 for(const [entry,file] of [['production-manager-entry.cjs','manager-login.bundle.js'],['production-employee-entry.cjs','employee.bundle.js']])await esbuild.build({...options,entryPoints:[path.join(__dirname,'..',entry)],outfile:path.join(out,'browser-overlay/puls-app',file)});
 fs.writeFileSync(path.join(out,'browser-overlay/puls-app/production-config.js'),'globalThis.AUREA_PRODUCTION_CONFIG=Object.freeze('+JSON.stringify(cfg)+');\n');
 fs.writeFileSync(path.join(out,'browser-overlay/_headers'),renderHeaders());
 await esbuild.build({...options,entryPoints:[path.join(__dirname,'private-admin-entry.cjs')],outfile:path.join(out,'private-admin/admin.bundle.js')});
 fs.copyFileSync(path.join(__dirname,'private-admin.html'),path.join(out,'private-admin/index.html'));fs.copyFileSync(path.join(__dirname,'admin.css'),path.join(out,'private-admin/admin.css'));
 for(const name of ['aurea-tick','aurea-job-background','aurea-admin'])await esbuild.build({entryPoints:[path.join(__dirname,'netlify-functions',name+'.mjs')],bundle:true,platform:'node',target:'node22',format:'esm',banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'},outfile:path.join(out,'server-functions',name+'.mjs')});
 for(const file of ['activation-gates.review.sql','activation-gates.rollback.sql','db-baseline-functions.json'])fs.copyFileSync(path.join(__dirname,file),path.join(out,'database',file));
 for(const file of ['INTEGRATION-REVIEW.md','README.md','netlify.toml.example'])fs.copyFileSync(path.join(__dirname,file),path.join(out,'docs',file));
 const config=fs.readFileSync(path.join(out,'browser-overlay/puls-app/production-config.js'),'utf8');
 if(!config.includes('"manager":false')||!config.includes('"employee":false'))throw Error('Unsafe output');
 const paths=fs.readdirSync(path.join(out,'browser-overlay/puls-app'));
 for(const p of paths){const s=fs.readFileSync(path.join(out,'browser-overlay/puls-app',p),'utf8');if(/AUREA_(?:WORKER_AUTH_PASSWORD|SCHEDULER_AUTH_PASSWORD|RESEND_API_KEY|INVITATION_HMAC_SECRET|BACKGROUND_HMAC_SECRET)|sb_secret_[\w-]{10,}/.test(s))throw Error('Server credential marker in public bundle');}
 console.log('PASS compiled browser, private admin and three server entrypoints; candidate flags OFF');
})().catch(e=>{console.error(e);process.exitCode=1});
