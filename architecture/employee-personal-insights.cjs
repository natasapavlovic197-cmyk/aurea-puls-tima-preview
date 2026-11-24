'use strict';
const {anchors,rotation,domains}=require('./psychometric-item-bank.cjs');
const bank=new Map([...anchors,...rotation.flat()].map(q=>[q.code,q]));
const names={role_clarity:'Jasnoća uloge',communication:'Komunikacija',workload:'Održivo opterećenje',psychological_safety:'Psihološka sigurnost',leadership_support:'Podrška rukovodioca',team_collaboration:'Saradnja u timu',autonomy:'Autonomija',fairness_recognition:'Pravičnost i priznanje',engagement_meaning:'Angažovanost i smisao',recovery:'Oporavak'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function snapshot(questions,answers){
 if(!Array.isArray(questions)||questions.length!==6||new Set(questions.map(q=>q.code)).size!==6)throw Error('Invalid questions');
 return questions.map(q=>{const item=bank.get(q.code),rating=answers[q.code];if(!item||q.wording!==item.text||!Number.isInteger(rating)||rating<1||rating>6)throw Error('Invalid personal insight input');return {code:q.code,domain:item.domain,rating:rating===6?null:rating};});
}
function renderPersonalInsights(rows){
 const center=150,r=94,point=(i,v)=>[center+r*v*Math.sin(i*Math.PI/5),center-r*v*Math.cos(i*Math.PI/5)].map(n=>n.toFixed(2)).join(',');
 const grid=[.2,.4,.6,.8,1].map(v=>'<polygon points="'+domains.map((_,i)=>point(i,v)).join(' ')+'" fill="none" stroke="#e4d6cb"/>').join('');
 const axes=domains.map((_,i)=>'<line x1="150" y1="150" x2="'+point(i,1).split(',')[0]+'" y2="'+point(i,1).split(',')[1]+'" stroke="#e4d6cb"/>').join('');
 const marks=domains.map((d,i)=>rows.filter(x=>x.domain===d&&x.rating!==null).map((x,j)=>{const [cx,cy]=point(i,x.rating/5).split(',');return '<circle cx="'+cx+'" cy="'+cy+'" r="'+(j?5:4)+'" fill="#653441" stroke="#fffdfa" stroke-width="1.5"/>';}).join('')).join('');
 const nums=domains.map((_,i)=>{const [x,y]=point(i,1.16).split(',');return '<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#653441">'+(i+1)+'</text>';}).join('');
 const list=domains.map((d,i)=>{const a=rows.filter(x=>x.domain===d);return '<div class="event"><span class="dot">'+(i+1)+'</span><div><strong>'+esc(names[d])+'</strong><div class="fine">'+(a.length?a.map(x=>esc(bank.get(x.code).text)+' — '+(x.rating===null?'Nije primenljivo':x.rating+'/5')).join('<br>'):'Nije mereno ove nedelje')+'</div></div></div>';}).join('');
 const low=rows.filter(x=>x.rating!==null&&x.rating<=2);return '<section class="section" aria-label="Lični uvid"><div class="panel fade"><div class="eyebrow" style="color:var(--wine2)">AUREA · MOJ LIČNI PULS</div><h2>Vaš lični pregled</h2><p class="fine">Prikaz Vaših odgovora na pojedinačna pitanja, ne psihološki test ili zbirni skor oblasti.</p><svg class="chart" viewBox="0 0 300 300" role="img" aria-label="Radar pojedinačnih odgovora od 1 do 5. Brojevi osa odgovaraju spisku ispod.">'+grid+axes+marks+nums+'</svg><p class="fine">Tačke predstavljaju pojedinačne odgovore. Prazne ose nisu procene; više pitanja u oblasti može imati više tačaka.</p>'+list+'<div class="notice" style="margin-top:20px">'+(low.length?'Ako želite, razmislite šta bi Vam naredne nedelje olakšalo iskustvo u oblasti: '+esc([...new Set(low.map(x=>names[x.domain]))].join(', '))+'.':'Ako želite, razmislite šta Vam je ove nedelje pomoglo i šta biste želeli da zadržite.')+'</div><p class="fine">Ovaj lični prikaz postoji samo u trenutnoj stranici i nije dodatno sačuvan. Rukovodiocu nije dostupan. Zatvaranjem ili osvežavanjem stranice nestaje.</p><button type="button" class="btn" id="personal-dismiss">Zatvori lični pregled</button></div></section>';
}
module.exports={snapshot,renderPersonalInsights};
