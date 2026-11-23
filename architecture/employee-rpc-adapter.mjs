/** AUREA employee staging adapter for EXISTING public Supabase RPCs.
 * The browser sends only the SHA-256 invitation hash, never the raw token.
 * The public SQL functions enforce single-use and cycle/question checks.
 * Do not enable on production until per-IP/token rate limiting is installed.
 */
const HASH=/^[a-f0-9]{64}$/i;
const CODE=/^[A-Za-z0-9_-]{1,32}$/;
function checkHash(hash){if(typeof hash!=='string'||!HASH.test(hash))throw new TypeError('Invalid invitation hash')}
function checkClient(client){if(!client||typeof client.rpc!=='function')throw new TypeError('Supabase client required')}
function checkAnswers(answers){
 if(!Array.isArray(answers)||answers.length!==4)throw new TypeError('Exactly four answers required');
 const codes=new Set();
 for(const a of answers){
  if(!a||typeof a!=='object'||Array.isArray(a)||typeof a.code!=='string'||!CODE.test(a.code)||codes.has(a.code)||!Number.isInteger(a.rating)||a.rating<1||a.rating>6)throw new TypeError('Invalid answers');
  codes.add(a.code);
 }
}
export function employeeClient(client,hash){
 checkClient(client);checkHash(hash);
 return Object.freeze({
  async invitation(){
   const {data,error}=await client.rpc('aurea_employee_invitation',{p_hash:hash});
   if(error)throw new Error('Pozivnica trenutno nije dostupna.');
   if(!data||!['ready','unavailable','invalid'].includes(data.status))throw new Error('Neispravan odgovor servisa.');
   if(data.status!=='ready')return {status:'unavailable'};
   if(!Array.isArray(data.questions)||data.questions.length!==4||!data.questions.every(q=>typeof q.code==='string'&&typeof q.wording==='string'))throw new Error('Nepotpuna pitanja.');
   return {status:'ready',questions:data.questions.map(q=>({code:q.code,wording:q.wording,position:q.position}))};
  },
  async submit(answers){
   checkAnswers(answers);
   const {data,error}=await client.rpc('aurea_employee_submit',{p_hash:hash,p_answers:answers.map(({code,rating})=>({code,rating}))});
   if(error)throw new Error('Odgovori trenutno nisu prihvaćeni.');
   if(data?.status==='submitted')return {status:'submitted'};
   if(['unavailable','invalid','invalid_answers'].includes(data?.status))return {status:'unavailable'};
   throw new Error('Nepotvrđeno slanje.');
  }
 });
}
