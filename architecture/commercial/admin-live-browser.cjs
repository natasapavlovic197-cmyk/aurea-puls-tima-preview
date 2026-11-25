'use strict';
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const server=http.createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404);return res.end()}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(__dirname+'/admin-staging-portal.html'))});
 await new Promise((r,j)=>{server.once('error',j);server.listen(4173,'127.0.0.1',r)});
 let browser;
 try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173');
 await page.locator('#key').fill(process.env.QA_PUBLIC_KEY);
 await page.locator('#email').fill(process.env.QA_EMAIL);
 await page.locator('#password').fill(process.env.QA_PASSWORD);
 const endpoint='https://ublzmoroanhlcgpnxilw.supabase.co/functions/v1/aurea-admin-staging';
 const response=page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==='POST');
 await page.locator('#connect').click();
 assert.equal((await response).status(),200);
 await page.locator('#result').getByText('Sačuvano u QA bazi.',{exact:true}).waitFor();
 console.log('PASS Chromium login and CORS');
 await page.locator('#company').fill(process.env.QA_ORG);
 await page.locator('#seats').fill('12');
 await page.locator('#plan').selectOption('gift');
 await page.locator('#quote button').click();
 const article=page.locator('article').filter({hasText:process.env.QA_ORG});
 await article.getByText(/Poklonjena · 12 zaposlenih/).waitFor();
 await article.getByLabel('Novi broj zaposlenih').fill('15');
 await article.getByRole('button',{name:'Sačuvaj broj'}).click();
 await article.getByText(/Poklonjena · 15 zaposlenih/).waitFor();
 console.log('PASS Chromium registration and hard count');
 await page.locator('#logout').click();
 await page.locator('#result').getByText('Odjavljeni ste.',{exact:true}).waitFor();
 assert.equal(await page.locator('article').count(),0);
 console.log('PASS Chromium logout');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(()=>{console.error('FAIL Chromium admin interaction');process.exitCode=1});
