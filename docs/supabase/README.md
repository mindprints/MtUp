# Supabase Migration Assets

## Files
- `docs/supabase/001_initial_group_aware_schema.sql`
- `docs/supabase/002_seed_example_profiles_and_group.sql`
- `docs/supabase/003_seed_second_group_isolation.sql`
- `docs/supabase/004_rls_isolation_verification.sql`
- `docs/supabase/005_rls_hotfix_group_memberships_recursion.sql`
- `docs/supabase/006_proposal_authorship_split.sql`

## Usage
1. Create a Supabase project.
2. Open SQL editor.
3. Run migration file contents in order.
4. Verify tables + RLS policies exist.
5. Create dev auth users in Supabase Auth UI.
6. Run seed file 002 to upsert `profiles`, create default group, and memberships.
7. Run seed file 003 to create a second group for isolation testing.
8. Run file 004 as different users to validate RLS visibility boundaries.
9. If you see `stack depth limit exceeded (54001)` on `group_memberships`, run file 005.
10. Run file 006 to split proposal authorship (`authored_by`) from row ownership (`created_by`) before using Resolver-created variants in Supabase mode.

## Notes
- Schema is intentionally group-aware even while UI remains single-group.
- Current dev runtime supports `VITE_DATA_SOURCE=supabase` with:
  - Supabase auth
  - proposals + availabilities migrated
  - decision entities still pending migration
- File 006 is additive and backfills `authored_by = created_by` for existing proposal rows.
