'use strict';
// Release candidate structural checks. Does not replace browser or real HTTP tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const routes=['index.html','zaposleni/index.html','rukovodilac/index.html','portal/index.html','radni-prostor/index.html'];
for(const route of routes){
 const html=read(route);
 assert.match(html,/<!doctype html>/i,route+' needs HTML doctype');
 assert.match(html,/<html\b/i,route+' needs HTML root');
 assert.match(html,/<meta\s+name=["']viewport["']/i,route+' needs mobile viewport');
 assert.match(html,/<title\b[^>]*>[^<]+<\/title>/i,route+' needs title');
 assert.doesNotMatch(html,/<script[^>]+src=["']https?:\/\/[^"']*service_role/i,route+' must not embed privileged client');
}
const home=read('index.html');
assert.match(home,/zaposleni\//,'Home must link to employee demo');
assert.match(home,/rukovodilac\//,'Home must link to manager demo');
const employee=read('zaposleni/index.html');
const manager=read('rukovodilac/index.html');
assert.match(employee,/Interaktivna demonstracija/);
assert.match(manager,/Interaktivna demonstracija/);
// The V3.5 snapshot is historical; the ten-domain manager source is pinned by premium-manager-template.cjs.
// Provenance: commit 872e50a287fee66b80ab87c19f09f39ea03a5fa5, exact Git blob.
const managerBytes=fs.readFileSync(path.join(root,'rukovodilac/index.html'));
const managerHash=crypto.createHash('sha1').update('blob '+managerBytes.length+'\0').update(managerBytes).digest('hex');
assert.equal(managerHash,'49a9839e8a007a588d2150e2ff79bbc3a88f3324','Pinned ten-domain manager demo changed');
assert.deepEqual(Buffer.from(read('portal/index.html')),fs.readFileSync(path.join(root,'locked/portal-b2b-approved.html')),'Approved portal changed');
const managerEndpoint=read('netlify/functions/aurea-manager-summary.cjs');
assert.match(managerEndpoint,/AUREA_B2B_MANAGER_DEPLOY_APPROVED/,'Manager deployment gate required');
const employeeEndpoint=read('netlify/functions/aurea-employee.cjs');
assert.match(employeeEndpoint,/statusCode:503/,'Employee endpoint must remain disabled before production readiness');
console.log('PASS: five entry pages, mobile viewport, approved designs, separate demos and locked server entrypoints');
