'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {buildPublishedManagerReport}=require('./published-manager-report.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:850}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<main id="workspace"></main>');
 await page.addScriptTag({path:path.resolve(__dirname,'manager-workspace-client.cjs')});
 await page.addScriptTag({path:path.resolve(__dirname,'manager-workspace-view.js')});
 const report=buildPublishedManagerReport(['2026-11-23','2026-11-30'].map(weekStart=>({weekStart,itemCode:'A_WORKLOAD',itemVersion:1,domain:'workload',responseCount:5,favorablePercent:20,closed:true})));
 await page.evaluate(report=>{
 let activities=[];window.failSave=false;
 const client=createWorkspaceClient({endpoint:'/workspace',organizationId:'12345678-1234-1234-1234-123456789abc',getToken:async()=>'qa-token',fetchImpl:async(url,opts)=>{
 if(opts.headers.authorization!=='Bearer qa-token')throw Error('Missing token');
 if(opts.method==='GET')return {ok:true,json:async()=>({status:'ready',report,activities})};
 if(window.failSave)return {ok:false};
 const input=JSON.parse(opts.body);const id=input.actionId||'abcdefab-1234-1234-1234-123456789abc';
 activities=[{id,description:input.description,due_on:input.dueOn,status:input.status}];return {ok:true,json:async()=>({status:'saved',id})};
 }});
 window.workspace=mountManagerWorkspace(document.querySelector('#workspace'),client);return window.workspace.refresh();
 },report);
 assert.equal(await page.locator('.metric').count(),10);
 await page.getByRole('button',{name:'Koristi predlog kao osnovu plana'}).click();
 assert.match(await page.getByRole('textbox',{name:'Opis aktivnosti'}).inputValue(),/obim zadataka/);
 await page.getByLabel('Rok aktivnosti').fill('2026-12-15');
 await page.getByRole('button',{name:'Sačuvaj aktivnost'}).click();
 await page.getByRole('button',{name:'Izmeni',exact:true}).waitFor();
 await page.getByRole('button',{name:'Izmeni',exact:true}).click();
 await page.getByLabel('Status aktivnosti').selectOption('done');
 await page.getByRole('button',{name:'Sačuvaj aktivnost'}).click();
 await page.getByText(/Status: Završeno/).waitFor();
 await page.getByRole('button',{name:'Izmeni',exact:true}).click();
 await page.evaluate(()=>window.failSave=true);
 await page.getByRole('button',{name:'Sačuvaj aktivnost'}).click();
 await page.getByText(/Aktivnost nije potvrđena/).waitFor();
 await page.evaluate(()=>window.workspace.dispose());
 assert.equal(await page.locator('#workspace').innerText(),'');
 assert.deepEqual(errors,[]);
 await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
