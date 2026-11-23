'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const manager=fs.readFileSync(path.join(__dirname,'../rukovodilac/index.html'),'utf8');
const employee=fs.readFileSync(path.join(__dirname,'../zaposleni/index.html'),'utf8');
test('Approved AUREA manager palette and navigation remain present',()=>{
 for(const token of ['--wine:#40171f','--ivory:#fbf8f4','--gold:#b99a68','Moj pregled','Moje aktivnosti','v35Navigate','v35Completion'])
  assert.ok(manager.includes(token),'Missing manager design/navigation token: '+token);
});
test('Manager is still explicitly labeled as a fictional demonstration',()=>{
 assert.match(manager,/Izmišljeni primer|izmišljenim podacima|izmišljene grupne podatke/i);
 assert.match(manager,/simulacij/i);
});
test('Employee integration retains separate role and new six-question model',()=>{
 assert.ok(employee.includes('A_CLARITY'));
 assert.ok(employee.includes('A_WORKLOAD'));
 assert.ok(employee.includes('A_SPEAKUP'));
 assert.ok(employee.includes('R_RECOVERY'));
 assert.ok(employee.includes('R_RECOGNITION'));
 assert.ok(!manager.includes('A_CLARITY'),'Manager must not accidentally embed employee questionnaire');
});

test('Manager overview includes the ten-domain catalogue without claiming live results',()=>{
 const labels=['Jasnoća uloge','Komunikacija','Obim posla','Psihološka sigurnost','Podrška rukovodioca','Saradnja u timu','Autonomija','Pravičnost i priznanje','Angažovanost i smisao','Oporavak'];
 for(const label of labels)assert.ok(manager.includes(label),'Missing '+label);
 assert.match(manager,/aureaRenderTenDomainCatalogue\(\)/);
 assert.match(manager,/Nema povezanih grupnih rezultata/);
 assert.match(manager,/najmanje 5 odgovora/);
});
