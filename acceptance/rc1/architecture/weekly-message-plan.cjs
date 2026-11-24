'use strict';
const {createHash}=require('node:crypto');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function planMessages({job,recipients,origin,now=new Date()}){
 if(!uuid.test(job?.organizationId||'')||!['invite','reminder','report'].includes(job.action))throw Error('Invalid job');
 const week=new Date(job.weekStart+'T12:00:00Z');
 if(!Number.isFinite(+week)||week.getUTCDay()!==1||week.toISOString().slice(0,10)!==job.weekStart)throw Error('Invalid week');
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Invalid origin');
 if(!Array.isArray(recipients)||!Number.isFinite(+now))throw Error('Invalid recipients');
 const seen=new Set(),messages=[];
 for(const r of recipients){
 if(r.organizationId!==job.organizationId||r.weekStart!==job.weekStart)throw Error('Recipient scope mismatch');
 if(!uuid.test(r.id||'')||typeof r.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)||seen.has(r.id))throw Error('Invalid recipient');
 seen.add(r.id);
 let subject,text;
 if(job.action==='report'){
 if(!job.cycleClosed||!['owner','manager'].includes(r.role)||r.active!==true)continue;
 subject='AUREA | Vaš nedeljni pregled';
 text='Poštovani, nedeljni pregled je spreman za proveru u poslovnom prostoru. Dostupni su samo grupni rezultati koji ispunjavaju uslove privatnosti. Prijavite se: '+base.origin+'/portal/';
 }else{
 if(job.cycleClosed||r.redeemedAt||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=+now)continue;
 if(job.action==='invite'&&r.sentAt)continue;
 if(job.action==='reminder'&&(!r.sentAt||r.reminderAt))continue;
 if(typeof r.token!=='string'||!/^[a-f0-9]{64}$/.test(r.token))throw Error('Invalid invitation');
 subject=job.action==='invite'?'AUREA | Vaš nedeljni puls':'AUREA | Kratak podsetnik';
 text=(job.action==='invite'?'Pozivamo Vas da odgovorite na šest kratkih pitanja o radnom iskustvu.':'Ukoliko želite, još uvek možete popuniti nedeljni puls.')+' Učešće je dobrovoljno. Vaš lični link: '+base.origin+'/odgovor/#'+r.token+' . Molimo Vas da link ne prosleđujete.';
 }
 const idempotencyKey=createHash('sha256').update([job.organizationId,job.weekStart,job.action,r.id].join(':')).digest('hex');
 messages.push({recipientId:r.id,to:r.email,subject,text,idempotencyKey});
 }
 return messages;
}
module.exports={planMessages};
