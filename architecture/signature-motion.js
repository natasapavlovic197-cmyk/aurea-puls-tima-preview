(()=>{'use strict';
 const seen=new WeakSet();
 function enhance(){
  for(const svg of document.querySelectorAll('svg.chart,.aurea-v3-chart svg,.chart-panel svg,svg[aria-label*="povezanim tačkama"]')){
   if(seen.has(svg))continue;seen.add(svg);
   let i=0;
   for(const line of svg.querySelectorAll('path[stroke-width="3.5"][fill="none"],polyline[stroke-width="3.5"],line[stroke-width="2.5"]')){line.setAttribute('pathLength','1');line.setAttribute('data-signature-draw','');line.style.setProperty('--signature-delay',Math.min(i++*35,210)+'ms');}
   let j=0;
   for(const bar of svg.querySelectorAll('rect[data-bar],rect.bar,rect[class*="bar-fill"]')){bar.setAttribute('data-signature-bar','');bar.style.setProperty('--signature-delay',Math.min(j++*40,200)+'ms');}
  }
 }
 let pending=false;
 const queue=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;enhance()})};
 new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});queue();
})();
