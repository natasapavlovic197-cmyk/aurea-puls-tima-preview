# AUREA Puls tima — B2B integracioni paket / stvarni nalazi (2026-11-23)

## Šta je stvarno provereno u Supabase staging bazi
1. **Postoje DVE grupe funkcija**, a ne samo privatni RPC: `aurea_private.submit_pulse` i `pulse_summary`, ali i javne `public.aurea_employee_invitation(p_hash)`, `public.aurea_employee_submit(p_hash,p_answers)`, `public.aurea_manager_*` i `public.aurea_my_companies()`.
2. Javna employee funkcija koristi **SHA-256 hash pozivnice**, četiri odgovora u obliku `{code,rating}`, ocene **1–6** (6 = nije primenljivo). Privatna funkcija koristi **sirovi token**, `{question_id,rating}`, ocene **1–5**. Ovo su **dva različita protokola**. Ne smeju se mešati. Novi `architecture/employee-rpc-adapter.mjs` odgovara postojećem *public* protokolu.
3. `public.aurea_employee_invitation` i `public.aurea_employee_submit` trenutno **nisu izvršivi ni kao anon ni kao authenticated**. Zato novi browser adapter ostaje **neaktivna integraciona komponenta**, a ne aktivna usluga. Ne davati javni EXECUTE bez kontrole zloupotrebe, anti-enumeracije i rate limitera.
4. Pet `public.aurea_manager_*` funkcija **jesu izvršive za authenticated** i sve proverene funkcije proveravaju `auth.uid()` i `aurea_private.memberships` za odgovarajuću organizaciju. To je namerna i proverena autorizaciona barijera u SQL-u; Supabase Security Advisor upozorava na SECURITY DEFINER, ali samo upozorenje nije dokaz propusta.
5. Poziv `public.aurea_employee_invitation(repeat('0',64))` vratio je `unavailable`, a `public.aurea_employee_submit(repeat('0',64),'[]'::jsonb)` vratio je `invalid_answers`. Ovo su **bezopasne negativne provere**. Nije izvršen uspešan upis odgovora u bazu.
6. `aurea_private.pulse_summary` stvarno je izračunao agregate postojećih sintetičkih podataka (6 odgovora po pitanju za dve nedelje). To ne potvrđuje punu end-to-end produkcionu integraciju.

## Bezbednosna revizija
Supabase Security Advisor (23.11.2026):
- INFO: sedam privatnih tabela sa RLS bez politika. Nije nužno propust dok je privatni pristup zatvoren; ipak zahteva eksplicitnu odluku za serversku ulogu.
- WARN: pet authenticated SECURITY DEFINER javnih manager RPC funkcija. Provereno: njihove definicije sadrže `auth.uid()` + provere članstva u kompaniji. Potrebni dodatni **negativni testovi sa dva stvarna testna Auth korisnika** pre pilota.
- WARN: leaked password protection disabled. Uključiti u Supabase Auth podešavanjima pre realnih korisnika: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Sledeći konkretni integracioni koraci (bez preskakanja)
- [x] Povezati employee adapter sa **stvarnim potpisima** postojećih javnih RPC funkcija (kod + unit test).
- [x] U CI dodati proveru validacije employee adaptera.
- [x] Proveriti prava za anon/authenticated, manager SQL autorizaciju i bezopasne negativne pozive.
- [ ] Odlučiti se za **jedan** employee protokol; predlog: zadržati `public` hash/code/1–6 zbog već postojećih funkcija i interfejsa; drugi ostaviti kao internu rezervu.
- [ ] Postaviti pouzdan server-side rate limiter i verifikaciju pozivnica; tek zatim dozvoliti kontrolisani employee endpoint. Ne uključivati javni EXECUTE na slepo.
- [ ] Napraviti dva izolovana testna Auth naloga i dve organizacije, bez stvarnih podataka; testirati manager own-org success, cross-org denial i nemogućnost prepoznavanja pojedinca.
- [ ] Povezati testni UI i proveriti slanje, replay, istekao link, zatvaranje ciklusa, agregatni izveštaj.
- [ ] Postaviti sandbox raspored pon/sre/pet bez stvarnog slanja mejlova; potom pilot.

**Zaključak:** infrastruktura je naprednija nego što se prethodno mislilo, ali postojeći public employee RPC još nije pristupačan browseru. Ne proglašavati ga aktivnim dok ne postoji bezbedan kanal. Ništa na AUREA produkcionom sajtu niti na zaključanom dizajnu nije menjano.
