# AUREA Puls tima — controlled release and credit guard

Status: development policy, 2026-11-23. This document does not itself configure Netlify.

## Verified Netlify state

- Preview project: `aurea-puls-tima-preview`, connected to this GitHub repository.
- Publish directory: `.`; no build command configured.
- Preview's **published deploy is locked** (Netlify displays `Auto Publishing Locked`). GitHub changes may still build; a deploy lock is **not** a build-cost guarantee.
- Main AUREA website `aureapsihoterapija.com` is separate and must never be modified as part of preview releases.
- On 2026-11-23 the owner approved a one-time $10 purchase for 1,500 credits. Automatic recharge remains disabled. Do not assume a future balance without checking billing.
- Prior cycle showed 203 production deploys consuming 3,045 credits. Minimize deployment count.

## Release procedure — no automatic unlock

1. Make and review changes in GitHub. Run the B2B privacy workflow; ensure all tests pass.
2. Confirm no changes to locked premium designs, manager/employee role separation, or the production AUREA website.
3. For backend features, run deployment preflight and real staging integration tests. Keep the manager endpoint disabled unless every credential, limited DB login, JWT, membership and privacy check has been verified.
4. Before any Netlify action, inspect current credit usage and verify the exact project name. Do not enable auto-recharge or upgrade plans.
5. Prepare **one** consolidated release candidate. Obtain explicit owner approval for the release and expected credit impact.
6. Only then unlock the preview published deploy if required and initiate **one** controlled publish. Check the published site and immediately re-lock auto publishing.
7. Record deploy ID, date, tests, outcome, credit balance before/after, and any rollback decision. If a release fails, investigate locally and via CI rather than repeatedly publishing.

## Cost and security invariants

- No automatic deploy loop; no deploy per small edit.
- GitHub Actions tests are not proof that Netlify has deployed new code.
- Netlify deploy lock is not a substitute for disabling automatic builds/webhooks if build credits accrue. Verify build trigger behavior before relying on cost savings.
- Never store database passwords, service-role keys or billing card details in GitHub files, browser code or logs.
- Do not expose the private employee RPCs to `anon` or `authenticated` without abuse protection.
- Do not enable auto-recharge, purchase credits, unlock the preview or modify the main site without explicit owner approval.
