'use strict';
const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const {premiumManager}=require('./premium-manager-template.cjs');
const {premiumEmployee}=require('./premium-employee-template.cjs');
async function main(){
 const out=path.resolve('dist-staging-manager');
 fs.mkdirSync(out,{recursive:true});
 require('./signature22-education.cjs').writeEducation(out);
 fs.writeFileSync(path.join(out,'index.html'),premiumManager(fs.readFileSync(path.join(__dirname,'../rukovodilac/index.html'),'utf8')));
 fs.copyFileSync(path.join(__dirname,'manager-login.css'),path.join(out,'manager-login.css'));
 for(const name of ['signature22-manager.css','signature22-employee.css']) fs.copyFileSync(path.join(__dirname,name),path.join(out,name));
 fs.mkdirSync(path.join(out,'assets'),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'assets/natasa-guide.webp'),path.join(out,'assets/natasa-guide.webp'));
 fs.copyFileSync(path.join(__dirname,'signature-motion.js'),path.join(out,'signature-motion.js'));
 await esbuild.build({entryPoints:[path.join(__dirname,'staging-manager-entry.cjs')],bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'manager-login.bundle.js'),minify:true});
 fs.writeFileSync(path.join(out,'employee.html'),premiumEmployee(fs.readFileSync(path.join(__dirname,'employee-six-question-preview.html'),'utf8')));
 await esbuild.build({entryPoints:[path.join(__dirname,'employee-staging-entry.cjs')],bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'employee.bundle.js'),minify:true});
 if(process.env.AUREA_POSTGREST_STAGING_BUILD==='true'){
 const cfg=require('./postgrest-runtime/staging-public-config.cjs');
 fs.writeFileSync(path.join(out,'staging-config.js'),'globalThis.AUREA_STAGING_CONFIG=Object.freeze('+JSON.stringify(cfg)+');\n');
 }
 for(const file of ['index.html','manager-login.css','manager-login.bundle.js','employee.html','employee.bundle.js'])if(!fs.statSync(path.join(out,file)).size)throw Error('Empty artifact');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
