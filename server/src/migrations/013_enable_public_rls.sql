-- ============================================================
-- AiVIS — Public Schema RLS Hardening
-- Enables and forces RLS for all user tables in public schema.
-- This closes Supabase linter findings:
-- - rls_disabled_in_public
-- - sensitive_columns_exposed (where caused by missing RLS)
-- ============================================================

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', rec.schemaname, rec.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', rec.schemaname, rec.tablename);
  END LOOP;
END
$$;
