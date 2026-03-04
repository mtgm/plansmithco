-- ============================================================================
-- 004_fix_company_id_func.sql
-- Description: Improves the company ID check function to look in app_metadata too.
-- ============================================================================

-- Function to get current user's company_id from JWT (Checking user_metadata AND app_metadata)
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Checks user_metadata FIRST, then app_metadata.
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid,
    (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );
$$;

-- Ensure super_admin check is robust
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin',
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
$$;
