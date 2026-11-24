# AUREA Puls tima — methodology interface lock
Date: 2026-11-24
Status: LOCKED FOR OFFLINE DEMONSTRATION / DEVELOPMENT BASELINE
Approved integration baseline: add0e4b6439819a3dffff5b3f7e95126e1533aba
Manager implementation: 872e50a287fee66b80ab87c19f09f39ea03a5fa5
Verified immutable Git blob identities:
- zaposleni/index.html: af3b1944cfa30c71e1bb3c0adcb2c8005193c125
- rukovodilac/index.html: 49a9839e8a007a588d2150e2ff79bbc3a88f3324
- architecture/psychometric-item-bank.cjs: 1e4b41b7fd52db1112e0eb362568150f75c23bb0
- architecture/manager-step5-browser-qa.cjs: af75d2e2e3a0648946ed8b939254d26acfe697d2

## Evidence
- CI 45363749274, job 138340049592: unit and Chromium PASS; log: PASS: 10 domains, 15 items, 12 weeks, graphs, employee consistency, navigation and offline privacy at mobile/desktop widths.
- CI 45363575357: manager intervention and activity unit and Chromium PASS on manager implementation.
- Manager CSS and guided scenario were unchanged by methodology alignment.
## Locked contract
Separate employee and manager experiences; six questions weekly (three anchors and three rotating), fifteen canonical items, ten domains, four-week rotation. Five primary manager cards plus expandable ten-domain view; concrete item selector, matching item identity, measurement week and historical labeling; favorable responses 4/5 among valid 1–5, not option 6; no fabricated live results, no validated domain score. Keep original approved visual style, guided scenarios, navigation and activity workflow.
Changes to locked files require explicit review, updated baseline and regression QA. This record is a development convention, not a GitHub branch protection or technical write lock. Existing locked assets remain untouched.
## Remaining release gates
Offline illustrative results are not empirical validation. Real SQL scoring (including exclusion of option 6), live privacy/tenant authorization, real connection, suppression/differencing, actual data freshness, automation and controlled deployment remain separate release gates. No actual employee data tested by this lock. No deployment, credential changes or TinyFish use. Main unchanged.
