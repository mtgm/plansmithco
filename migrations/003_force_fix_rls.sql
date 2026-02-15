-- ============================================================================
-- 003_FORCE_FIX_RLS.sql
-- Description: Aggressively drops and recreates RLS policies and functions
-- to ensure NO reference to 'users' table remains.
-- ============================================================================

-- 1. DROP EVERYTHING RELATED TO THESE POLICIES
DROP POLICY IF EXISTS "Company Access Materials" ON product_materials;
DROP POLICY IF EXISTS "Company Access Variants" ON product_variants;
DROP POLICY IF EXISTS "Company Access Textures" ON variant_textures;

DROP POLICY IF EXISTS "Users can view materials from their company's products" ON product_materials;
DROP POLICY IF EXISTS "Users can insert materials for their company's products" ON product_materials;
DROP POLICY IF EXISTS "Users can update materials from their company's products" ON product_materials;
DROP POLICY IF EXISTS "Users can delete materials from their company's products" ON product_materials;

DROP POLICY IF EXISTS "Users can view variants" ON product_variants;
DROP POLICY IF EXISTS "Users can insert variants" ON product_variants;
DROP POLICY IF EXISTS "Users can update variants" ON product_variants;
DROP POLICY IF EXISTS "Users can delete variants" ON product_variants;

DROP POLICY IF EXISTS "Users can view textures" ON variant_textures;
DROP POLICY IF EXISTS "Users can insert textures" ON variant_textures;
DROP POLICY IF EXISTS "Users can update textures" ON variant_textures;
DROP POLICY IF EXISTS "Users can delete textures" ON variant_textures;

-- Drop functions to ensure clean slate
DROP FUNCTION IF EXISTS public.get_current_user_company_id();
DROP FUNCTION IF EXISTS public.is_super_admin();

-- 2. RE-CREATE FUNCTIONS (USING JWT ONLY - NO TABLE ACCESS)

CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Reads from JWT metadata. Does NOT touch any table.
  -- Ensure your users have 'company_id' in their raw_user_meta_data.
  SELECT (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Reads from JWT metadata. Does NOT touch any table.
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin';
$$;

-- 3. RE-CREATE POLICIES using the new safe functions

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
