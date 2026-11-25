'use strict';
const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const {premiumManager}=require('./premium-manager-template.cjs');
const {premiumEmployee}=require('./premium-employee-template.cjs');
async function main(){
 const cfg=require('./postgrest-runtime/production-public-config.cjs').createProductionPublicConfig({environment:process.env.AUREA_ENVIRONMENT,url:process.env.AUREA_SUPABASE_URL||null,key:process.env.AUREA_SUPABASE_PUBLISHABLE_KEY||null});
 const verdict=require('./postgrest-runtime/production-config.cjs').inspect(process.env);
 if(!verdict.configurationValid)throw Error('Production build configuration rejected');
 const out=path.resolve('dist-production-manager');
 if(fs.existsSync(out))throw Error('Refusing existing output directory');
 fs.mkdirSync(out,{recursive:true});
 require('./signature22-education.cjs').writeEducation(out);
 fs.writeFileSync(path.join(out,'index.html'),premiumManager(fs.readFileSync(path.join(__dirname,'../rukovodilac/index.html'),'utf8')).replace('/staging-config.js','/production-config.js'));
 fs.copyFileSync(path.join(__dirname,'manager-login.css'),path.join(out,'manager-login.css'));
 for(const name of ['signature22-manager.css','signature22-employee.css']) fs.copyFileSync(path.join(__dirname,name),path.join(out,name));
 fs.mkdirSync(path.join(out,'assets'),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'assets/natasa-guide.webp'),path.join(out,'assets/natasa-guide.webp'));
 fs.copyFileSync(path.join(__dirname,'signature-motion.js'),path.join(out,'signature-motion.js'));
 await esbuild.build({entryPoints:[path.join(__dirname,'production-manager-entry.cjs')],bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'manager-login.bundle.js'),minify:true});
 fs.writeFileSync(path.join(out,'employee.html'),premiumEmployee(fs.readFileSync(path.join(__dirname,'employee-six-question-preview.html'),'utf8')).replace('/staging-config.js','/production-config.js'));
 await esbuild.build({entryPoints:[path.join(__dirname,'production-employee-entry.cjs')],bundle:true,platform:'browser',format:'iife',outfile:path.join(out,'employee.bundle.js'),minify:true});
 fs.writeFileSync(path.join(out,'production-config.js'),'globalThis.AUREA_PRODUCTION_CONFIG=Object.freeze('+JSON.stringify(cfg)+');\n');
 for(const file of ['index.html','manager-login.css','manager-login.bundle.js','employee.html','employee.bundle.js'])if(!fs.statSync(path.join(out,file)).size)throw Error('Empty artifact');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
