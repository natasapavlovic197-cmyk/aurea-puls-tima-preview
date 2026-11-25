Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin");
 const allowed="http://127.0.0.1:4173";
 const cors:Record<string,string>={"Vary":"Origin"};
 if(origin===allowed){cors["Access-Control-Allow-Origin"]=allowed;cors["Access-Control-Allow-Headers"]="authorization, apikey, content-type";cors["Access-Control-Allow-Methods"]="POST, OPTIONS";}
 if(req.method==="OPTIONS")return new Response(null,{status:origin===allowed?204:403,headers:cors});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json",...cors,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 if(origin&&origin!==allowed)return reply(403,{error:"origin"});
 if(req.method!=="POST")return reply(405,{error:"method"});
 const authorization=req.headers.get("authorization")||"";
 if(!/^Bearer [^\s]+$/.test(authorization))return reply(401,{error:"unauthorized"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!key||new URL(url).hostname!=="ublzmoroanhlcgpnxilw.supabase.co")return reply(503,{error:"configuration"});
 const headers={apikey:key,Authorization:authorization,"Content-Type":"application/json"};
 try{
 const user=await fetch(url+"/auth/v1/user",{headers});
 if(!user.ok)return reply(401,{error:"unauthorized"});
 if(req.headers.get("content-type")?.split(";")[0]!=="application/json")return reply(415,{error:"content type"});
 const reader=req.body?.getReader();if(!reader)return reply(400,{error:"body"});
 let bytes=0;const decoder=new TextDecoder();let body="";
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>8192){await reader.cancel();return reply(413,{error:"size"});}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();
 const x=JSON.parse(body);if(!x||!["list","register","change"].includes(x.action)||!x.payload||typeof x.payload!=="object"||Array.isArray(x.payload))return reply(400,{error:"invalid"});
 const r=await fetch(url+"/rest/v1/rpc/aurea_admin_dispatch_v1",{method:"POST",headers,body:JSON.stringify({p_action:x.action,p_payload:x.payload})});
 if(!r.ok)return reply(r.status===401?401:r.status===403?403:400,{error:"request rejected"});
 return reply(200,await r.json());
 }catch{return reply(400,{error:"request rejected"});}
});