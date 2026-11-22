# AUREA Puls tima — provera integracije (staging)

Provereno 22.11.2026. Ovo je interni razvojni zapis, ne dokument za klijente.

## Potvrđeno
- Preview repozitorijum objavljuje početnu stranu, iskustvo zaposlenog, rukovodilački demo, testni portal i originalni Kringle.
- Supabase staging ima 1 organizaciju, ali **0 ciklusa, 0 pitanja, 0 pozivnica, 0 odgovora i 0 ocena odgovora**.
- Aktivne su Edge Functions `aurea-manager-session-staging` i `aurea-manager-summary-staging`, obe sa JWT proverom.
- `/zaposleni/` je samostalni demonstracioni upitnik; završetak eksplicitno ne šalje podatke na server.
- `/rukovodilac/` je demonstracioni pregled sa izmišljenim podacima; `/portal/` je odvojena stvarna testna prijava.

## Sledeći bezbedni koraci pre uključivanja stvarnog prikupljanja
1. Potvrditi šifarnik pitanja i raspored pitanja po ciklusu; tek tada uneti verzionisane testne podatke.
2. Definisati bezbedno izdavanje jednokratnih pozivnica zaposlenima, proveru tokena na serveru, rok važenja, sprečavanje ponovnog slanja i minimalizaciju podataka.
3. Implementirati serversku funkciju za prijem odgovora; bez service_role ili drugih tajni u javnom HTML-u.
4. Proveriti izolaciju organizacija, autorizaciju menadžera, RLS i prag grupnog prikaza (minimum 5) i otpornost na ponovno identifikovanje u malim grupama.
5. Testirati sa isključivo sintetičkim podacima, uključujući odbijene/istekle pozivnice, duplikate, neovlašćen pristup i manje od pet odgovora.
6. Tek nakon provere promeniti natpis da se odgovori zaista čuvaju.

**Nije urađeno:** povezivanje demonstracionog upitnika sa stvarnim prijemom odgovora. Ne koristiti za stvarne zaposlene.
