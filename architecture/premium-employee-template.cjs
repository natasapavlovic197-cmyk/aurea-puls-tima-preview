'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const LOCK='af3b1944cfa30c71e1bb3c0adcb2c8005193c125';
function premiumEmployee(source){
 const bytes=Buffer.from(source);
 const sha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(sha!==LOCK)throw Error('Locked employee source changed');
 return source.slice(0,source.indexOf('<script>'))
 .replace(/<nav aria-label="Povratak na početnu stranicu">[\s\S]*?<\/nav>/,'')
 .replace('Interaktivna demonstracija','Nedeljni puls')
 .replace(', uz mogućnost dodatnog komentara','')
 .replace(/<footer class="footer">[\s\S]*?<\/footer>/,'<footer class="footer">Rukovodiocu se prikazuju samo grupni rezultati koji ispunjavaju prag privatnosti. Ne unosite lične podatke.</footer>')
 +'<script src="/employee.bundle.js"></script></body></html>';
}
module.exports={premiumEmployee};
