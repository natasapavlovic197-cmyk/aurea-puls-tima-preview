# AUREA RC1 — staging acceptance (lokalni kandidat)

Izvor: korisnički GitHub ZIP commita 51b64e0d7a2c812406bc78ca5153b42785fdff4e i prethodni lokalni AUREA-technical-final/source-patch/architecture/weekly-message-plan.cjs. Bez HTML/CSS izmena. Ne instalirati kao javni site.

## Lokalno
Node 22 preporučen, bez npm zavisnosti: `node --test acceptance-auth.test.cjs architecture/a3-weekly-delivery-rehearsal.test.cjs`. Testovi koriste lažne odgovore Auth API-ja i memorijski pool, ne mrežu. Rehearsal je adaptacija ranijeg A3 testa: novi kriterijum su RC1 pozivnica, podsetnik i portal linkovi kroz ceo ciklus. 12 pozivnica, 3 podsetnika, 2 izveštaja, dva sintetička tenant-a, prag 5 naspram 4, 17 različitih idempotency ključeva. Ne tvrdi da su realni HTTP, baza ili browser testirani.

## GitHub konfiguracija (samo predlog)
- `aurea-staging-admin` / postojeća dozvoljena integration grana.
- `AUREA_DELIVERY_AUTH_PASSWORD`: već postoji; ne menjati.
- `AUREA_MANAGER_QA_PASSWORD`: novi secret samo ako korisnik već zna postojeću lozinku QA naloga; uneti direktno u GitHub, nikad u čet. Ako nije poznata, STOP; nema resetovanja u ovom odobrenju.
- `AUREA_SUPABASE_PUBLISHABLE_KEY`: nova environment variable, javni publishable ključ tačno staging projekta (ne anon JWT, ne secret/service_role). Nema vrednosti u paketu.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_ADMIN_DB_PASSWORD`, `NETLIFY_AUTH_TOKEN`: ne koriste se ovim workflowom.
- Predloženi folder `acceptance/rc1/`; YAML se tek po odobrenju kopira u `.github/workflows/rc1-staging-acceptance.yml`. Ručno pokretanje, bez schedule/push/deploy. Pre pokretanja proveriti da nema druge automatske akcije koja bi deployment pokrenula na commit.

Stvarni auth test koristi postojeće UUID identitete, password grant, getUser, QA listu kompanija, sopstveni manager actions, odbijanje nepostojećeg UUID-a, odbijanje manager API-ja delivery identitetu, lokalni logout samo novih sesija. Pretpostavka: delivery identitet nema manager članstvo, mora se potvrditi pre pokretanja. Nepostojeći UUID nije dokaz izolacije između dve stvarne kompanije. Poziv manager RPC-u može promeniti tehnički rate-limit brojač; test ne dira poslovne podatke. Ne loguje lozinke/tokene/sirove odgovore. Nema direktnih upisa u Auth tabele. Ako provider izda neispravnu sesiju pre nego što adapter može da je zabeleži, cleanup nije garantovan; proveriti sesije nakon neuspeha.

## Preostali live acceptance
Ne pokretati stare weekly/commercial skripte koje direktno upisuju Auth tabele. Za live nedeljni ciklus potreban je zaseban privremeni sintetički tenant, eksplicitno ograničenje postojećeg delivery identiteta samo na njega, QA članstvo samo za test i provera/rollback tih grantova. Ne koristiti AUREA DEMO cikluse niti postojeće prave adrese. Potrebno je odobriti i kontrolisani testni sat; javni scheduler koristi stvarni sat servera, a privatne time-injection funkcije nisu javno dostupne. Ne simulirati JWT u živom okruženju. Stvarni lifecycle harness nije implementiran ovim paketom; fake provider je lokalni. Za pravi cross-tenant test potreban je postojeći zaseban sintetički tenant, ne samo nepostojeći UUID. HTTP 403 za Auth Admin ostaje nerešen; postojeći nalozi mogu omogućiti auth test bez njega. Browser navigacija i leaked password protection takođe ostaju otvoreni. Nema automatskog puštanja proizvoda.
