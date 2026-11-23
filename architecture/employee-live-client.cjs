'use strict';
function createEmployeeClient({token,fetchImpl=globalThis.fetch}={}){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid invitation');
 let questions=null,saved=false,busy=false;
 async function call(path,payload){
 const r=await fetchImpl('/api/employee/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,...payload}),cache:'no-store',redirect:'error',credentials:'same-origin'});
 if(!r.ok)throw Error('Invitation unavailable');
 return r.json();
 }
 return Object.freeze({
 async load(){
 const data=await call('invitation',{});
 if(data.status!=='ready'||!Array.isArray(data.questions)||data.questions.length!==6)throw Error('Invitation unavailable');
 const q=data.questions.slice().sort((a,b)=>a.position-b.position);
 if(new Set(q.map(x=>x.code)).size!==6||q.some((x,i)=>x.position!==i+1||typeof x.code!=='string'||!/^[A-Z_]+$/.test(x.code)||typeof x.wording!=='string'||!x.wording.trim()))throw Error('Invalid questions');
 questions=q.map(x=>Object.freeze({code:x.code,wording:x.wording,position:x.position}));return questions.slice();
 },
 async submit(answers){
 if(!questions||saved||busy)throw Error('Submission unavailable');
 if(!answers||Object.keys(answers).length!==6||questions.some(q=>!Number.isInteger(answers[q.code])||answers[q.code]<1||answers[q.code]>6))throw Error('Invalid answers');
 busy=true;
 try{const result=await call('submit',{answers:questions.map(q=>({code:q.code,rating:answers[q.code]}))});if(result.status!=='submitted')throw Error('Submission not confirmed');saved=true;return true;}finally{busy=false;}
 }
 });
}
module.exports={createEmployeeClient};
