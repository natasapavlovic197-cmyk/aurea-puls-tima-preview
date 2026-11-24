'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createServerEntry}=require('./manager-server-entry.cjs');
const {createHttpAdapter}=require('./manager-http-adapter.cjs');
function createStagingServer({env,query,fetchImpl,employeeHandler,dist=path.resolve('dist-staging-manager')}={}){
 const dispatch=createHttpAdapter({handler:createServerEntry({env,query,fetchImpl})});
 const assets=new Map([['/employee','employee.html'],['/employee.bundle.js','employee.bundle.js'],['/','index.html'],['/index.html','index.html'],['/manager-login.css','manager-login.css'],['/manager-login.bundle.js','manager-login.bundle.js'],['/staging-config.js','staging-config.js'],['/signature22-employee.css','signature22-employee.css'],['/signature22-manager.css','signature22-manager.css'],['/signature-motion.js','signature-motion.js'],['/assets/natasa-guide.webp','assets/natasa-guide.webp'],['/signature-education.html','signature-education.html']]);
 return http.createServer(async(req,res)=>{
 res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/manager-workspace'||url.pathname.startsWith('/api/employee/')){
 let body='',size=0;
 for await(const chunk of req){size+=chunk.length;if(size>16000){res.writeHead(413);res.end();return;}body+=chunk.toString();}
 const result=url.pathname.startsWith('/api/employee/')? (employeeHandler?await employeeHandler({method:req.method,path:url.pathname,body,headers:req.headers,sourceIp:req.socket.remoteAddress}):{statusCode:503,headers:{},body:'Unavailable'}):await dispatch({method:req.method,url:req.url,headers:req.headers,body,sourceIp:req.socket.remoteAddress});
 res.writeHead(result.statusCode,result.headers);res.end(result.body);return;
 }
 if(req.method!=='GET'||!assets.has(url.pathname)){res.writeHead(404);res.end();return;}
 const file=assets.get(url.pathname);
 const data=await fs.readFile(path.join(dist,file));
 res.setHeader('content-type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.webp')?'image/webp':'text/html; charset=utf-8');
 res.end(data);
 }catch{if(!res.headersSent)res.writeHead(503);res.end();}
 });
}
module.exports={createStagingServer};
