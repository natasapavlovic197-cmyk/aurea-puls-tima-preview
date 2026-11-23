'use strict';
// Pure, opt-in manager decision layer. No writes, network calls or UI effects.
// The caller must persist an accepted proposal using an authorized manager RPC.
const {CATALOG}=require('./manager-interventions.cjs');
const DECISIONS=new Set(['accept','edit','reject']);
function prepareManagerDecision(recommendation,{decision,description,dueOn=null}={}){
 if(!recommendation||typeof recommendation!=='object'||Array.isArray(recommendation)||
  !CATALOG[recommendation.domain]||recommendation.title!==CATALOG[recommendation.domain].title||
  recommendation.requiresManagerJudgment!==true||recommendation.avoidsIndividualInference!==true||
  !DECISIONS.has(decision))throw TypeError('Invalid manager decision');
 if(decision==='reject')return Object.freeze({decision:'reject',persist:false,reason:'Rukovodilac nije prihvatio preporuku.'});
 const proposed=decision==='accept'?CATALOG[recommendation.domain].action:description;
 if(typeof proposed!=='string'||proposed.trim().length<8||proposed.length>600)throw TypeError('Invalid action description');
 if(dueOn!==null){
  if(typeof dueOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)||
    !Number.isFinite(Date.parse(dueOn+'T00:00:00Z'))||
    new Date(dueOn+'T00:00:00Z').toISOString().slice(0,10)!==dueOn)throw TypeError('Invalid deadline');
 }
 return Object.freeze({
  decision,persist:true,
  action:Object.freeze({description:proposed.trim(),dueOn,status:'open'}),
  source:Object.freeze({domain:recommendation.domain,itemCode:recommendation.itemCode,itemVersion:recommendation.itemVersion}),
  // Do not claim impact from action creation or completion.
  evaluation:'Efekat aktivnosti nije utvrđen; proveriti naredni uporediv agregirani signal.'
 });
}
module.exports={prepareManagerDecision};
