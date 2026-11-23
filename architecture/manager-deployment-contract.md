# Manager workspace deployment contract

Do not deploy or merge without explicit approval. Keep the existing demo unchanged.

## Required runtime
- AUREA_SUPABASE_URL and AUREA_SUPABASE_PUBLISHABLE_KEY: staging only.
- AUREA_LIMITER_SECRET: server-only, at least 32 characters.
- Restricted PostgreSQL connection with only required rate-limit table permissions; no service-role fallback.
- Trusted platform source IP, not arbitrary client headers.
- Compose createServerEntry with restricted query adapter in the actual hosting handler.
- Browser session provider must supply current access token and sign-out notification. Never put bearer tokens in URLs.

## Acceptance gates
1. Real staging JWT can load its own organization.
2. Missing, expired and invalid JWT denied.
3. Valid JWT for another organization denied.
4. Activity create, edit and completion survive reload.
5. Sign-out removes visible data and prevents further requests.
6. Direct private table access denied.
7. Existing demonstration and homepage unchanged.

Current status: isolated infrastructure and browser QA passed; real deployment and JWT tests remain pending.
