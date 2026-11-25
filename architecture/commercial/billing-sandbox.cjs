'use strict';
// Sandbox only; never accepts live provider events or initiates a real charge.
const {createHmac,timingSafeEqual}=require('node:crypto');
function adapter(key){
 if(typeof key!=='string'||key.length<32)throw Error('sandbox key');
 const sign=raw=>createHmac('sha256',key).update(raw).digest('hex');
 function verify(raw,signature,now=Date.now()){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>8192||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(sign(raw),'hex'),Buffer.from(signature,'hex')))throw Error('signature');
  const e=JSON.parse(raw);
  if(e.mode!=='sandbox'||e.status!=='captured'||!Number.isSafeInteger(e.timestamp)||Math.abs(now-e.timestamp)>300000||!Number.isSafeInteger(e.amount)||e.amount<=0||!['RSD','EUR'].includes(e.currency)||!['monthly','annual'].includes(e.plan)||!['org','invoice'].every(k=>typeof e[k]==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e[k]))||typeof e.reference!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(e.reference))throw Error('event');
  return Object.freeze({organizationId:e.org,invoiceId:e.invoice,method:'sandbox',reference:e.reference,amount:e.amount,currency:e.currency});
 }
 return {sign,verify};
}
function due(a,now){
 if(a.complimentary||a.suspended||!a.renewal_enabled||a.open_invoice||!a.consent||!['monthly','annual'].includes(a.renewal_plan))return false;
 const end=Math.max(Date.parse(a.trial_end),a.paid_until?Date.parse(a.paid_until):0);
 return Number.isFinite(end)&&end<=now;
}
module.exports={adapter,due};
