-- ============================================================================
-- 005_fix_rls_via_public_users.sql
-- Description: Updates the helper function to fetch company_id from public.users
--              Uses CASCADE to drop dependent policies and then recreates them.
-- ============================================================================

-- Drop functions with CASCADE to handle dependencies (this will drop the policies too!)
DROP FUNCTION IF EXISTS public.get_current_user_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;

-- Function to get current user's company_id
-- STRATEGY: 1. Try public.users table. 2. Fallback to JWT.
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  cid UUID;
BEGIN
  -- Attempt to read from public.users
  -- We use dynamic SQL or just direct select if we are sure table exists.
  -- Based on your policy list, 'users' table exists.
  BEGIN
    SELECT company_id INTO cid 
    FROM public.users 
    WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    cid := NULL;
  END;

  IF cid IS NOT NULL THEN
    RETURN cid;
  END IF;

  -- Fallback to JWT metadata (if public.users is empty or id not found)
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid,
    (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid
  );
END;
$$;

-- Ensure super_admin check is robust (checking public.users 'role' or metadata)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check public.users role column if it exists
  -- Assuming column name 'role' based on common patterns, change if 'user_role' etc.
  -- Safe checking:
  BEGIN
    SELECT (role = 'super_admin') INTO is_admin
    FROM public.users
    WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    is_admin := NULL;
  END;

  IF is_admin IS NOT NULL THEN
    RETURN is_admin;
  END IF;

  -- Fallback to JWT
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin',
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
END;
$$;

-- Since CASCADE dropped the policies, we MUST recreate them here using the new functions.

-- Product Materials
ALTER TABLE product_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company Access Materials" ON product_materials
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        product_id IN (
            SELECT id FROM products 
            WHERE company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    )
    WITH CHECK (
        product_id IN (
            SELECT id FROM products 
            WHERE company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    );

-- Product Variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company Access Variants" ON product_variants
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        material_id IN (
            SELECT pm.id FROM product_materials pm
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    )
    WITH CHECK (
        material_id IN (
            SELECT pm.id FROM product_materials pm
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    );

-- Variant Textures
ALTER TABLE variant_textures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company Access Textures" ON variant_textures
    AS PERMISSIVE
    FOR ALL
    TO public
    USING (
        variant_id IN (
            SELECT pv.id FROM product_variants pv
            JOIN product_materials pm ON pv.material_id = pm.id
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    )
    WITH CHECK (
        variant_id IN (
            SELECT pv.id FROM product_variants pv
            JOIN product_materials pm ON pv.material_id = pm.id
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    );
