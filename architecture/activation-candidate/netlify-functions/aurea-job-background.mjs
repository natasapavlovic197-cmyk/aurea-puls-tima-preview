import auth from '../background-auth.cjs';
import runtime from '../runtime.cjs';
export const config={background:true,path:'/.netlify/functions/aurea-job-background',method:'POST',rateLimit:{windowLimit:6,windowSize:60,aggregateBy:['ip','domain']}};
export default async function(req){
 const env=process.env,kind=req.headers.get('x-aurea-kind');
 if(req.method!=='POST'||!auth.verify(kind,req.headers.get('x-aurea-stamp'),req.headers.get('x-aurea-signature'),env))return;
 try{const r=await runtime.execute(kind,{env});console.log(JSON.stringify({kind,status:r.status,action:r.action,queued:r.queued,notReady:r.notReady}));}catch{console.error('AUREA job failed; inspect private queue and reconcile uncertain receipts.');}
}
