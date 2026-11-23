# AUREA Puls tima — consolidated B2B test matrix

Status: **staging preparation only**. No production deployment, actual invitation delivery or real employees.

| Area | Current automated coverage | Required before pilot |
|---|---|---|
| Company isolation | In-memory A/B test and SQL claim simulation for one existing company | Two real authenticated test identities and two organizations, API-level cross-tenant read/write denial |
| Invitation | Random token, hashed lookup, expiry, single use and wrong-company denial in simulation | Server-side token endpoint, replay/rate-limit tests, transactional rollback and HTTP checks |
| Weekly cadence | Belgrade timezone, Monday/Wednesday/Friday, daylight-saving tests, idempotency keys | Persistent job queue, retry policy, sandbox email provider, observable delivery failures |
| Employee privacy | Aggregate minimum 5, missing/invalid response suppression, no response identity FK in simulation | Real database timestamp-correlation audit, anti-differencing, retention and small-team review |
| Manager reporting | Thresholded domain average in simulation; existing staging RPC minimum 5 | Verify repeated weekly disclosures and manager role tests through authenticated API |
| Manager actions | Existing staging RPC code checks role, tenant, cycle ownership | API-level create/update/edit and cross-tenant negative tests |
| Mobile UX | Existing manager smoke test passed; larger mobile functional QA previously failed | Fix full mobile QA; test iPhone Safari, keyboard, navigation, persistence |
| Visual experience | Original Kringle preserved; isolated Anđela experiment unsuccessful | Separate targeted transition investigation; no unverified changes to original |

## Hard release gates

- No employee contact data or invitation hashes in public HTML/JavaScript.
- No secret/service-role credentials in GitHub repo or browser bundle.
- Never claim a privacy guarantee from five-response minimum alone.
- No public launch until authenticated API tests, consent/privacy documents, threat review, staging job dry run and rollback plan pass.
