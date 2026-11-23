const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const calls=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const org='c5bc8d09-e858-4f47-80ae-cd671d481304';
 let savedAction=null;
 const send=(route,obj,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(obj)});
 await page.route('https://ublzmoroanhlcgpnxilw.supabase.co/**',async route=>{
  const u=new URL(route.request().url()),name=u.pathname.split('/').pop();
  const body=route.request().postDataJSON?.()||{};calls.push({name,body});
  if(u.pathname==='/auth/v1/token')return send(route,{access_token:'synthetic-test-token'});
  if(name==='aurea_my_companies')return send(route,[{organization_id:org,organization_name:'AUREA TEST',member_role:'manager'}]);
  if(name==='aurea_manager_summary')return send(route,[{week_start:'2026-11-16',question_code:'J1',domain:'clarity',response_count:6,favorable_percent:66.7}]);
  if(name==='aurea_manager_cycles')return send(route,[{cycle_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',week_start:'2026-11-16',state:'closed'}]);
  if(name==='aurea_manager_actions')return send(route,savedAction?[savedAction]:[]);
  if(name==='aurea_manager_save_action'){
   savedAction={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',cycle_id:body.p_cycle_id,description:body.p_description,due_on:body.p_due_on,status:body.p_status};
   return send(route,savedAction.id);
  }
  if(u.pathname==='/auth/v1/logout')return send(route,{});
  return send(route,{message:'Unexpected API request'},404);
 });
 const assert=(v,msg)=>{if(!v)throw Error(msg);console.log('PASS '+msg)};
 try{
  await page.goto(pathToFileURL(path.resolve('portal/index.html')).href);
  await page.locator('#email').fill('synthetic@example.invalid');
  await page.locator('#password').fill('not-a-real-password');
  await page.locator('#login').click();
  await page.locator('.aurea-metric').first().waitFor();
  assert(await page.locator('#private').isVisible(),'authenticated portal reveals manager panel');
  assert((await page.locator('#results').innerText()).includes('66,7%'),'aggregate summary rendered');
  await page.locator('#actionDescription').fill('Dogovoriti prioritete na sastanku tima');
  await page.locator('#actionSave').click();
  await page.locator('.aurea-action-card').first().waitFor();
  assert(calls.some(c=>c.name==='aurea_manager_save_action'&&c.body.p_organization_id===org),'action saved to selected company');
  await page.locator('.aurea-action-card button').click();
  await page.waitForFunction(()=>document.querySelector('.aurea-action-card small')?.textContent.includes('Završeno'));
  assert(savedAction.status==='done','activity status persisted through API');
  await page.locator('#logout').click();
  await page.locator('#private').waitFor({state:'hidden',timeout:5000});
  assert(await page.locator('#private').isHidden(),'logout hides private panel');
  assert(calls.some(c=>c.name==='logout'),'logout API invoked');
  assert(await page.locator('.aurea-action-card').count()===0,'logout clears activity cards');
  assert((await page.locator('#password').inputValue())==='','logout clears password');
  assert(errors.length===0,'no browser errors');
  console.log('ALL MOCKED PORTAL TESTS PASSED — NO REAL BACKEND REQUESTS');
 }catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close()}
})();