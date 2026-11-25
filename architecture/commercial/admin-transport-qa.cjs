'use strict';
// Disposable QA only. The listener is loopback and no production connection is accepted.
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile);
function start({port=0,token,db}){
 if(process.env.AUREA_ADMIN_QA!=='1'||db!=='aurea_admin_fixture'||typeof token!=='string'||token.length<32)throw Error('QA gate');
 const sql=async(q,vars={})=>{
  const args=['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5432','-U','aurea_admin_transport_qa','-d',db];
  for(const [k,v] of Object.entries(vars))args.push('-v',k+'='+v);
  // psql variable quoting happens on stdin, never interpolate request values into SQL.
  return new Promise((resolve,reject)=>{const p=require('node:child_process').spawn('psql',args,{env:{PATH:process.env.PATH,PGPASSWORD:process.env.AUREA_QA_DB_PASSWORD},stdio:['pipe','pipe','pipe']});let out='';p.stdout.on('data',x=>out+=x);p.stderr.resume();p.on('error',reject);p.on('close',c=>c===0?resolve(out.trim()):reject(Error('database rejected')));p.stdin.end(q+'\n')});
 };
 const same=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(n,v)=>{res.writeHead(n,{'Content-Type':'application/json'});res.end(JSON.stringify(v))};
  if(req.headers.host!=='127.0.0.1:'+server.address().port)return send(403,{error:'host'});
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(__dirname+'/admin-qa.html'))}
  if(!same(req.headers.authorization,'Bearer '+token))return send(401,{error:'unauthorized'});
  if(req.method==='GET'&&req.url==='/api/accounts'){try{return send(200,JSON.parse(await sql("SELECT coalesce(json_agg(x),'[]'::json) FROM aurea_admin.list_accounts() x;")))}catch{return send(403,{error:'denied'})}}
  if(req.method!=='POST'||!['/api/register','/api/change'].includes(req.url))return send(404,{error:'not found'});
  if(req.headers.origin!=='http://127.0.0.1:'+server.address().port||req.headers['content-type']!=='application/json')return send(403,{error:'origin'});
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192){return send(413,{error:'size'})}}
   const x=JSON.parse(body);
   if(req.url==='/api/register'){
    if(typeof x.name!=='string'||!x.name.trim()||x.name.length>120||!Number.isSafeInteger(x.seats)||x.seats<1||x.seats>100000||!['monthly','annual','gift'].includes(x.plan))return send(400,{error:'invalid'});
    const id=await sql("SELECT aurea_admin.register_company(:'name',:'seats'::integer,:'plan');",{name:x.name,seats:String(x.seats),plan:x.plan});return send(201,{id});
   }
   if(typeof x.id!=='string'||! /^[0-9a-f-]{36}$/i.test(x.id)||!['seats','plan','renewal','suspended'].includes(x.operation)||x.value===undefined)return send(400,{error:'invalid'});
   await sql("SELECT aurea_admin.change_company(:'id'::uuid,:'op',:'value'::jsonb);",{id:x.id,op:x.operation,value:JSON.stringify(x.value)});return send(200,{ok:true});
  }catch{return send(400,{error:'request rejected'})}
 });
 return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server))});
}
module.exports={start};
