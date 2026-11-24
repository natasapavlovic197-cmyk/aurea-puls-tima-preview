'use strict';
// AUREA candidate item bank v0.1. Research design only: not a validated scale.
// Anchors are identical every week. Rotating items recur on a four-week cycle.
// No scores may be interpreted as clinical diagnosis or latent construct estimates.
const anchors=Object.freeze([
 {code:'A_CLARITY',domain:'role_clarity',text:'Ove nedelje bilo mi je jasno šta se od mene očekuje na poslu.',polarity:'positive'},
 {code:'A_WORKLOAD',domain:'workload',text:'Ove nedelje mogao/la sam da završim posao bez dugotrajnog preopterećenja.',polarity:'positive'},
 {code:'A_SPEAKUP',domain:'psychological_safety',text:'Ove nedelje mogao/la sam da ukažem na problem u radu bez straha od neprijatnih posledica.',polarity:'positive'}
]);
const rotation=Object.freeze([
 Object.freeze([
 {code:'R_LEADER_HELP',domain:'leadership_support',text:'Kada mi je bila potrebna pomoć u radu, znao/la sam da mogu da računam na podršku rukovodioca.',polarity:'positive'},
 {code:'R_INFO',domain:'communication',text:'Informacije potrebne za moj rad stizale su na vreme.',polarity:'positive'},
 {code:'R_PRIORITY',domain:'role_clarity',text:'Kada su se prioriteti menjali, bilo mi je jasno šta prvo treba da uradim.',polarity:'positive'}
 ]),
 Object.freeze([
 {code:'R_COOP',domain:'team_collaboration',text:'Članovi tima međusobno su pomagali kada je posao to zahtevao.',polarity:'positive'},
 {code:'R_TRUST',domain:'team_collaboration',text:'Mogao/la sam da se oslonim na dogovore sa kolegama.',polarity:'positive'},
 {code:'R_FEEDBACK',domain:'communication',text:'Dobijao/la sam dovoljno povratnih informacija da znam kako napreduje moj rad.',polarity:'positive'}
 ]),
 Object.freeze([
 {code:'R_AUTONOMY',domain:'autonomy',text:'Imao/la sam dovoljno prostora da samostalno odlučim kako da obavim svoj posao.',polarity:'positive'},
 {code:'R_FAIRNESS',domain:'fairness_recognition',text:'Radni zadaci su u mom okruženju raspoređivani na način koji sam doživljavao/la kao pravičan.',polarity:'positive'},
 {code:'R_RECOGNITION',domain:'fairness_recognition',text:'Moj trud je bio primećen i uvažen.',polarity:'positive'}
 ]),
 Object.freeze([
 {code:'R_MEANING',domain:'engagement_meaning',text:'Ove nedelje video/la sam smisao u poslu koji obavljam.',polarity:'positive'},
 {code:'R_RECOVERY',domain:'recovery',text:'Između radnih dana imao/la sam dovoljno vremena da se oporavim od poslovnih zahteva.',polarity:'positive'},
 {code:'R_RESOURCES',domain:'workload',text:'Imao/la sam resurse potrebne da završim zadatke koji su mi dodeljeni.',polarity:'positive'}
 ])
]);
const domains=Object.freeze([
 'role_clarity','communication','workload','psychological_safety',
 'leadership_support','team_collaboration','autonomy','fairness_recognition',
 'engagement_meaning','recovery'
]);
function weeklyItems(weekStart){
 if(typeof weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart))throw TypeError('Invalid week');
 const d=new Date(weekStart+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==weekStart||d.getUTCDay()!==1)throw TypeError('Week must start Monday');
 // Monday 2026-11-23 is the reference week. Rotate both directions.
 const reference=Date.parse('2026-11-23T12:00:00Z');
 const weeks=Math.round((d.getTime()-reference)/604800000);
 const index=((weeks%4)+4)%4;
 return Object.freeze([...anchors,...rotation[index]]);
}
function validateBank(){
 const all=[...anchors,...rotation.flat()];
 if(all.length!==15||new Set(all.map(x=>x.code)).size!==15)throw Error('Duplicate or missing items');
 if(new Set(all.map(x=>x.domain)).size!==domains.length)throw Error('Domain coverage mismatch');
 if(all.some(x=>!domains.includes(x.domain)||x.polarity!=='positive'||!x.text))throw Error('Invalid item');
 return true;
}
module.exports={anchors,rotation,domains,weeklyItems,validateBank};
