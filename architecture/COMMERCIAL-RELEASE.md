# AUREA Puls tima — release candidate
Baseline c919c132; integrated pilot run 45387443430 successful. Staging only.
## Launch gates (not yet approved)
1. Separate production project and migration inventory; remove staging URL hardcoding through reviewed configuration, never expose privileged keys.
2. Retire legacy employee Edge endpoint after dependency inventory; review five public manager SECURITY DEFINER functions and password policy. Private RLS deny is intentional.
3. Dedicated scoped delivery identity separate from manager, secret store, stable HMAC key and rotation procedure (retain key for outstanding invitations).
4. Verified sending domain SPF/DKIM/DMARC, provider idempotency and reconciliation for uncertain receipts. No automatic resend of uncertain delivery.
5. Durable timer in Europe/Belgrade, Monday/Wednesday/Friday 09:00 proposed; alert on missed day, queue backlog and notReady; Friday cutoff disclosed. No timer installed.
6. Production browser acceptance on employee and manager entrypoints; locked design, six questions, ten domains, mobile and desktop.
7. Backup/restore drill, incident owner, retention/deletion, privacy notice and processing agreement; no individual scores or diagnosis, threshold five valid answers.
8. First company: approved contract, named manager, roster validated and consent/legal basis reviewed, test access, activate only its scope. Recommend 15–30 employees and four weeks to cover rotation. Weekly review with AUREA; expand only after acceptance.
9. Explicit approval for production deployment and live sending separately. Stop by disabling timer/provider and revoking delivery scope; preserve records and reconcile outstanding jobs.
## Current evidence
2026-11-24 staging: zero synthetic organizations, active recipients and scopes; pg_cron absent. Legacy employee Edge active. Security advisor: five manager definer warnings and leaked-password protection disabled. No production readiness assertion.
The gate module is a checklist evaluator, not an enforcement mechanism in a deployed runtime.
