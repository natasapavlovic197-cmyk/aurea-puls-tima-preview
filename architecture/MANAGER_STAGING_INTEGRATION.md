# Manager staging integration contract

Current manager RPCs in Supabase project `aurea-puls-staging`:
- `public.aurea_my_companies()` -> authenticated user organization list
- `public.aurea_manager_cycles(p_organization_id)` -> closed weeks
- `public.aurea_manager_summary(p_organization_id)` -> thresholded question metrics
- `public.aurea_manager_actions(p_organization_id)` -> manager actions
- `public.aurea_manager_save_action(...)` -> create/edit action

## Integration order

1. Sign in with Supabase Auth using a publishable client key. Never include secret or service-role keys in HTML.
2. Fetch `aurea_my_companies()` after authentication and choose only an authorized organization ID.
3. Use the selected ID for manager RPC calls. **Server must still authorize every call**, regardless of client choice.
4. Render `summary` only as aggregate results. Never fetch `aurea_private.responses`, invitations or respondent identifiers in manager UI.
5. Preserve existing `Moj pregled` / `Moje aktivnosti` navigation and editing flow. Avoid role switching in UI.
6. Do not enable public employee endpoints until rate-limited, server-mediated one-use invitation redemption is implemented.
7. If any RPC fails authorization, show a neutral access-denied state without leaking company existence.

## Remaining blockers

The connected database currently has one real Auth user and one organization. Cross-tenant SQL simulation has passed, but real HTTP Auth tests and safe onboarding of second test account are still required. Current public employee RPCs are not granted to ordinary browser roles. Timestamp correlation, release differencing, password policy, and mobile QA remain open. No live backend is wired by this document.
