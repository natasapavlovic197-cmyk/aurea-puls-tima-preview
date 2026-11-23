const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const calls=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const org='c5bc8d09-e858-4f47-80ae-cd671d481304';
 const send=(route,obj,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(obj)});
 await page.route('https://ublzmoroanhlcgpnxilw.supabase.co/**',async route=>{
  const u=new URL(route.request().url()),name=u.pathname.split('/').pop();
  const body=route.request().postDataJSON?.()||{};calls.push({name,body});
  if(u.pathname==='/auth/v1/token')return send(route,{access_token:'synthetic-test-token'});
  if(name==='aurea_my_companies')return send(route,[{organization_id:org,organization_name:'AUREA TEST',member_role:'manager'}]);
  if(name==='aurea_manager_summary')return send(route,[{week_start:'2026-11-16',question_code:'J1',domain:'clarity',response_count:6,favorable_percent:66.7}]);
  if(name==='aurea_manager_cycles')return send(route,[{cycle_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',week_start:'2026-11-16',state:'closed'}]);
  if(name==='aurea_manager_actions')return send(route,calls.filter(c=>c.name==='aurea_manager_save_action').length?[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',cycle_id:null,description:'Dogovoriti prioritete na sastanku tima',due_on:null,status:'open'}]:[]);
  if(name==='aurea_manager_save_action')return send(route,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
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
  await page.locator('#logout').click();
  assert(await page.locator('#private').isHidden(),'logout hides private panel');
  assert((await page.locator('#password').inputValue())==='','logout clears password');
  assert(errors.length===0,'no browser errors');
  console.log('ALL MOCKED PORTAL TESTS PASSED — NO REAL BACKEND REQUESTS');
 }catch(e){console.error(e.stack);process.exitCode=1}finally{await browser.close()}
})();