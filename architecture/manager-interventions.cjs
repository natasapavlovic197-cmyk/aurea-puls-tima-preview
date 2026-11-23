'use strict';
// AUREA intervention decision-support v0.1: non-clinical, low-risk manager actions.
// Consumes privacy-cleared item-level signals only; never individual answers.
const {anchors,rotation}=require('./psychometric-item-bank.cjs');
const ITEM_DOMAIN=new Map([...anchors,...rotation.flat()].map(item=>[item.code,item.domain]));
const CATALOG=Object.freeze({
 role_clarity:{title:'Razjasniti prioritete',action:'Na kratkom timskom sastanku dogovorite najviše tri prioriteta i odgovorne osobe za narednu nedelju.',check:'Sledeće nedelje proverite da li su očekivanja i prioriteti jasniji.'},
 communication:{title:'Urediti tok informacija',action:'Dogovorite jedan pouzdan kanal i rok za prenošenje informacija važnih za rad.',check:'Pri sledećem merenju iste stavke proverite pravovremenost informacija.'},
 workload:{title:'Preispitati opterećenje',action:'Sa timom proverite obim zadataka, dostupne resurse i mogućnost odlaganja manje važnih obaveza.',check:'Proverite da li je održivost opterećenja poboljšana pri sledećem uporedivom merenju.'},
 psychological_safety:{title:'Otvoriti bezbedan kanal za probleme',action:'Jasno objasnite kako zaposleni mogu prijaviti prepreke bez odmazde; obezbedite poverljiv nezavisan kanal za ozbiljne prijave.',check:'Proverite da li su kanali dostupni i da li se prijave obrađuju bez otkrivanja identiteta.'},
 leadership_support:{title:'Povećati dostupnost podrške',action:'Uvedite kratak redovan termin kada zaposleni mogu tražiti pomoć oko radnih prepreka.',check:'Pri narednom uporedivom merenju proverite dostupnost podrške.'},
 team_collaboration:{title:'Poboljšati koordinaciju',action:'Dogovorite kako članovi tima traže i nude pomoć pri zastoju u radu.',check:'Proverite funkcionisanje dogovora i sledeći uporediv signal.'},
 autonomy:{title:'Razjasniti prostor za odluke',action:'Odredite koje operativne odluke zaposleni mogu donositi samostalno, uz jasne granice odgovornosti.',check:'Proverite da li su ovlašćenja razumljiva i korisna.'},
 fairness_recognition:{title:'Povećati transparentnost raspodele',action:'Objasnite kriterijume raspodele zadataka i način uvažavanja doprinosa, bez javnog poređenja pojedinaca.',check:'Proverite razumevanje kriterijuma i sledeći uporediv signal.'},
 engagement_meaning:{title:'Povezati zadatke sa svrhom',action:'Na timskom sastanku povežite tekuće zadatke sa konkretnim ciljem i korisnicima rada.',check:'Pri sledećem uporedivom merenju proverite opaženi smisao rada.'},
 recovery:{title:'Zaštititi vreme za oporavak',action:'Preispitajte očekivanja van radnog vremena, raspored pauza i predvidljivost radnih zahteva.',check:'Proverite da li se opterećenje i mogućnost oporavka poboljšavaju.'}
});
function recommendInterventions(signals,{max=1}={}){
 if(!Array.isArray(signals)||!Number.isInteger(max)||max<1||max>3)throw TypeError('Invalid recommendation request');
 const eligible=[];
 for(const s of signals){
  if(!s||typeof s!=='object'||Array.isArray(s)||typeof s.domain!=='string'||
   typeof s.itemCode!=='string'||!/^([AR]_[A-Z_]+)$/.test(s.itemCode)||
   !Number.isInteger(s.itemVersion)||s.itemVersion<1||
   typeof s.latestWeek!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.latestWeek)||
   typeof s.latestFavorablePercent!=='number'||!Number.isFinite(s.latestFavorablePercent)||
   s.latestFavorablePercent<0||s.latestFavorablePercent>100||
   typeof s.persistentUnfavorable!=='boolean'||!Number.isInteger(s.observedCount)||s.observedCount<1)
   throw TypeError('Invalid privacy-cleared signal');
  if(!CATALOG[s.domain])throw TypeError('Unknown domain');
  if(ITEM_DOMAIN.get(s.itemCode)!==s.domain)throw TypeError('Item/domain mismatch');
  // A single unfavorable observation is not a basis for an intervention alert.
  if(s.persistentUnfavorable&&s.observedCount>=2)eligible.push(s);
 }
 eligible.sort((a,b)=>a.latestFavorablePercent-b.latestFavorablePercent||a.domain.localeCompare(b.domain)||a.itemCode.localeCompare(b.itemCode));
 const selected=[],seen=new Set();
 for(const s of eligible){
  if(seen.has(s.domain))continue;
  seen.add(s.domain);
  selected.push(Object.freeze({
   domain:s.domain,itemCode:s.itemCode,itemVersion:s.itemVersion,
   evidence:'Ponovljen nepovoljan agregirani signal na istoj stavci; uzrok nije utvrđen.',
   ...CATALOG[s.domain],priority:'review',requiresManagerJudgment:true,
   avoidsIndividualInference:true
  }));
  if(selected.length===max)break;
 }
 return Object.freeze(selected);
}
module.exports={CATALOG,recommendInterventions};
