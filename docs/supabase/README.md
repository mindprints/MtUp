# Supabase Migration Assets

## Files
- `docs/supabase/001_initial_group_aware_schema.sql`
- `docs/supabase/002_seed_example_profiles_and_group.sql`
- `docs/supabase/003_seed_second_group_isolation.sql`
- `docs/supabase/004_rls_isolation_verification.sql`
- `docs/supabase/005_rls_hotfix_group_memberships_recursion.sql`

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

## Notes
- Schema is intentionally group-aware even while UI remains single-group.
- Current dev runtime supports `VITE_DATA_SOURCE=supabase` with:
  - Supabase auth
  - proposals + availabilities migrated
  - decision entities still pending migration
