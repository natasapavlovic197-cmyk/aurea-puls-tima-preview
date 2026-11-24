'use strict';
const crypto=require('node:crypto');
const LOCK='49a9839e8a007a588d2150e2ff79bbc3a88f3324';
function premiumManager(source){
 const b=Buffer.from(source);
 if(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')!==LOCK)throw Error('Locked manager source changed');
 return source.slice(0,source.indexOf('<script>'))
 .replace(/<nav aria-label="Povratak na početnu stranicu">[\s\S]*?<\/nav>/,'')
 .replace('Interaktivna demonstracija','Poslovni prostor')
 .replace('Kroz jednu situaciju iz svakodnevnog rada upoznajte kako grupni odgovori zaposlenih mogu pomoći da jasnije sagledate odnose, opterećenje i naredne korake.','Pratite objavljene grupne rezultate i planirajte naredne korake.')
 .replace(/<nav class="v35nav"[\s\S]*?<\/nav>/,'')
 .replace('<section id="manager" class="fade"></section>','<section id="manager-login" class="panel section"><p role="status">Razvojno okruženje nije konfigurisano.</p></section>')
 .replace(/<footer class="footer">[\s\S]*?<\/footer>/,'<footer class="footer">AUREA · Puls tima · Grupni rezultati, bez individualnih odgovora.</footer>')
 .replace('</head>','<link rel="stylesheet" href="/signature22-manager.css"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"></head>')
 +'<script src="/signature-motion.js" defer></script><script src="/staging-config.js" defer></script><script src="/manager-login.bundle.js" defer></script></body></html>';
}
module.exports={premiumManager};
