'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStagingServer}=require('./staging-manager-server.cjs');
test('local HTTP server serves only allowed assets and fails closed',async()=>{
 const dist=await fs.mkdtemp(path.join(os.tmpdir(),'aurea-'));
 await fs.writeFile(path.join(dist,'index.html'),'<h1>AUREA</h1>');
 const server=createStagingServer({dist,env:{}});
 try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/AUREA/);assert.equal(home.headers.get('cache-control'),'no-store');
 assert.equal((await fetch(base+'/private.txt')).status,404);
 assert.equal((await fetch(base+'/api/manager-workspace')).status,400);
 assert.equal((await fetch(base+'/api/manager-workspace?organization_id=a&organization_id=b')).status,400);
 assert.equal((await fetch(base+'/api/manager-workspace?organization_id=11111111-1111-4111-8111-111111111111')).status,503);
 assert.equal((await fetch(base+'/api/manager-workspace?organization_id=a',{method:'POST',body:'x'.repeat(16001)})).status,413);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dist,{recursive:true,force:true});}
});
