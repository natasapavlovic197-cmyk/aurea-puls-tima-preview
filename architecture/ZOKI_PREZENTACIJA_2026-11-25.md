# AUREA Puls tima — prezentacija za Zoki, sreda 25.11.2026.

## Cilj sastanka
Pokazati premium iskustvo AUREA Puls tima i proveriti interesovanje za pilot. Ne predstavljati simulaciju kao već aktiviran SaaS.

## Redosled demonstracije (8–12 minuta)
1. Otvoriti **https://aurea-puls-tima-preview.netlify.app/** i predstaviti ideju: kratak nedeljni puls zaposlenih, diskretna povratna informacija, odluka rukovodioca.
2. U zasebnom tabu otvoriti **https://aurea-puls-tima-preview.netlify.app/zaposleni/**. Proći četiri kratka pitanja, mogućnost povratka i završni ekran. Naglasiti da je ovo DEMO i da se odgovori ne šalju u produkcionu bazu.
3. U zasebnom tabu otvoriti **https://aurea-puls-tima-preview.netlify.app/rukovodilac/**. Pokazati pregled, signal, predlog aktivnosti, rok/status i praćenje. Podaci su sintetički, namenjeni demonstraciji.
4. Objasniti planirani ritam: ponedeljak jedinstvena pozivnica; sreda jedan diskretan podsetnik; petak agregirani izveštaj i sledeći korak. Ritam je planiran, ali stvarno slanje još nije aktivirano.
5. Pokazati princip privatnosti: rezultati se prikazuju tek kada je ispunjen prag najmanje pet odgovora; potrebno je završno testiranje izolacije kompanija.

## Šta je danas stvarno
- Premium portal, odvojena iskustva zaposlenog i rukovodioca i simulacija toka rada.
- Serverska arhitektura, ograničeni SQL nalog bez lozinke, pripremljen i zaključan manager endpoint, testovi i bezbednosne kontrole.
- **Nije aktivno:** javno slanje odgovora zaposlenih (Netlify employee endpoint vraća 503), stvarno nedeljno slanje poruka, produkciona obrada podataka, autentifikovani pilot sa dve firme, live limiter konekcija.
- Demo nije dokaz završenog pravnog i ugovornog okvira.

## Pitanja za Zoki
- Koje vrste i veličine firmi bi najlakše prihvatile pilot?
- Ko bi bio kupac/odlučilac: vlasnik, direktor, HR ili tim lider?
- Da li je jasnija pretplata po firmi ili po broju zaposlenih?
- Koji je najjači razlog za kupovinu: rano prepoznavanje problema, angažovanost ili konkretne akcije rukovodioca?
- Može li povezati AUREA sa jednom firmom za **neobavezujući razgovor** o pilotu, bez prikupljanja stvarnih odgovora pre bezbednosnog odobrenja?

## Zabranjene tvrdnje na sastanku
- „Sistem već automatski šalje pozive i izveštaje.“
- „Sada može da obrađuje stvarne podatke zaposlenih.“
- „Izolacija svih firmi je testirana uživo.“
- „Sve je pravno i produkciono odobreno.“

## Puštanje stvarnog pilota — obavezni uslovi
- Pokrenuti kompletne testove i proveriti stvarnu SQL konekciju preko sigurnog tajnog podatka.
- Implementirati i testirati employee submission, slanje, jedan podsetnik i petkov izveštaj.
- Proveriti autorizaciju dva odvojena tenant-a, prag privatnosti i otkaz baze.
- Urediti pravni osnov, obaveštenje o obradi podataka, ugovor i procedure brisanja/retencije.
- Posebno odobriti preview izdanje; nikada ne dirati glavni AUREA sajt.
