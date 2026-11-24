'use strict';
const route='/signature-education.html';
function educationFrame(){return '<section class="panel section fade"><h2>Izaberite poslovnu situaciju.</h2><p class="muted">Edukativna simulacija. Svi likovi i situacije su izmišljeni. Izbori se ne šalju u poslovni sistem.</p><button class="btn" type="button" id="signatureEducationExit">Nazad na moj pregled</button><iframe title="AUREA edukativne simulacije" sandbox="allow-scripts" referrerpolicy="no-referrer" src="'+route+'" style="display:block;width:100%;height:78vh;min-height:540px;border:0;margin-top:12px;border-radius:16px"></iframe></section>'}
module.exports={educationFrame};
