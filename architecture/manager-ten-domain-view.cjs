'use strict';
const {domains,weeklyItems}=require('./psychometric-item-bank.cjs');
const {analyzeItemSeries}=require('./item-aware-trends.cjs');
const DOMAIN_LABELS=Object.freeze({
 role_clarity:'Jasnoća uloge',communication:'Komunikacija',workload:'Obim posla',
 psychological_safety:'Psihološka sigurnost',leadership_support:'Podrška rukovodioca',
 team_collaboration:'Saradnja u timu',autonomy:'Autonomija',
 fairness_recognition:'Pravičnost i priznanje',engagement_meaning:'Angažovanost i smisao',
 recovery:'Oporavak'
});
// Input must be privacy-cleared item-level aggregates, never individual responses.
// This adapter does not query a database or turn illustrative data into live data.
function buildManagerTenDomainView(rows,opts={}){
 const items=analyzeItemSeries(rows,opts);
 const byDomain=new Map(domains.map(domain=>[domain,[]]));
 for(const item of items)byDomain.get(item.domain).push(item);
 return {kind:'privacy_cleared_item_aggregates',validatedScale:false,
  domains:domains.map(code=>({code,label:DOMAIN_LABELS[code],items:byDomain.get(code),
   measured:byDomain.get(code).length>0,
   // No domain average: distinct rotating items cannot be treated as one validated scale.
   domainScore:null})),
  coverage:{totalDomains:domains.length,measuredDomains:domains.filter(d=>byDomain.get(d).length>0).length},
  limitations:['Porede se samo identična pitanja iste verzije.','Rotirajuća pitanja ponavljaju se na četiri nedelje.','Bez individualnih odgovora i bez zbirnog psihometrijskog skora.']
 };
}
module.exports={buildManagerTenDomainView,DOMAIN_LABELS};
