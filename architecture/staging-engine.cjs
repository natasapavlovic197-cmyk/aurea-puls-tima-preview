'use strict';
// Deterministic in-memory contract tests only; NOT a production database or authentication service.
const crypto = require('node:crypto');
const {safeDomainAverage} = require('./privacy-guard.cjs');
const key = token => crypto.createHash('sha256').update(token).digest('hex');
class StagingEngine {
  constructor() { this.tenants=new Map();this.invites=new Map();this.answers=[];this.jobs=new Set();this.sent=[]; }
  addTenant(id){if(this.tenants.has(id))throw Error('duplicate tenant');this.tenants.set(id,{id});}
  issueInvite({tenant,week,employee,now,ttlMs=7*86400000}){
    if(!this.tenants.has(tenant))throw Error('unknown tenant');
    if(!Number.isFinite(now)||ttlMs<=0)throw Error('invalid expiry');
    const token=crypto.randomBytes(32).toString('hex');
    const hash=key(token);
    this.invites.set(hash,{tenant,week,employee,expires:now+ttlMs,completed:false,reminded:false});
    return token;
  }
  redeem({token,tenant,week,domain,value,now}){
    const hash=key(token), i=this.invites.get(hash);
    if(!i||i.tenant!==tenant||i.week!==week||i.completed||now>i.expires||!Number.isInteger(value)||value<1||value>5) return false;
    // Record only aggregate answer fields. No employee ID, invitation ID or precise submission timestamp.
    this.answers.push({tenant,week,domain,value});
    i.completed=true;return true;
  }
  report({tenant,week,domain,teamSize,requester}){
    if(!this.tenants.has(tenant)||requester?.tenant!==tenant||!['manager','tenant_admin'].includes(requester.role))throw Error('forbidden');
    const answers=this.answers.filter(x=>x.tenant===tenant&&x.week===week&&x.domain===domain).map(x=>x.value);
    return safeDomainAverage({respondentCount:answers.length,teamSize,answers});
  }
  schedule({tenant,week,day,now}){
    if(!this.tenants.has(tenant))throw Error('unknown tenant');
    const job=day==='Monday'?'invite':day==='Wednesday'?'reminder':day==='Friday'?'report':null;
    if(!job)throw Error('invalid schedule');
    const id=[tenant,week,job].join('|');
    if(this.jobs.has(id))return {job,duplicate:true,sent:0};
    this.jobs.add(id);
    let sent=0;
    if(job==='reminder'){
      for(const i of this.invites.values())if(i.tenant===tenant&&i.week===week&&!i.completed&&!i.reminded&&now<=i.expires){i.reminded=true;sent++;}
    }
    if(job==='invite')sent=[...this.invites.values()].filter(i=>i.tenant===tenant&&i.week===week).length;
    this.sent.push({tenant,week,job,count:sent,simulated:true});
    return {job,duplicate:false,sent};
  }
}
module.exports={StagingEngine};
