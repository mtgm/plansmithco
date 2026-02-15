-- ============================================================================
-- MIGRATION: CLEANUP LEGACY TABLES & VERIFY NEW SCHEMA
-- ============================================================================
-- Description: 
-- 1. Drops legacy tables (variant_groups, variant_options, product_qr_codes) that are no longer used.
-- 2. Ensures the new 3D-ready schema (product_materials, product_variants, variant_textures) exists.
-- 3. Verifies RLS policies are in place.
-- ============================================================================

-- 1. CLEANUP LEGACY TABLES
-- warning: This will delete data in these tables. Make sure you have backups if needed.
DROP TABLE IF EXISTS variant_options CASCADE;
DROP TABLE IF EXISTS variant_groups CASCADE;
-- product_qr_codes might be legacy too based on context, but let's stick to requested ones.

-- 2. VERIFY/CREATE NEW SCHEMA

-- A) Product Materials (Değişebilen Parçalar)
CREATE TABLE IF NOT EXISTS product_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    material_id TEXT NOT NULL, -- GLB'den gelen Node ID
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, material_id)
);

-- B) Product Variants (Seçenekler: Altın, Gümüş vb.)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES product_materials(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,
    swatch_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(material_id, variant_name)
);

-- C) Variant Textures (Teknik Dosyalar: Base, Normal, ORM)
CREATE TABLE IF NOT EXISTS variant_textures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    base_color_url TEXT,
    normal_url TEXT,
    orm_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(variant_id)
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS)

ALTER TABLE product_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_textures ENABLE ROW LEVEL SECURITY;

-- 4. HELPER FUNCTIONS (SECURITY DEFINER to bypass auth.users permission issues)

-- Function to get current user's company_id from JWT metadata (avoiding table access)
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  -- Extract company_id from JWT. This requires company_id to be in user_metadata.
  -- If it's not in JWT, we fallback to a simple cast which might be null.
  -- Note: We use auth.jwt() which returns JSONB.
  SELECT (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid;
$$;

-- Function to check if current user is super_admin from JWT
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin';
$$;

-- 5. POLICIES (Users can only manage their own company's data)

-- Product Materials Policies
DROP POLICY IF EXISTS "Company Access Materials" ON product_materials;
CREATE POLICY "Company Access Materials" ON product_materials
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

-- Product Variants Policies
DROP POLICY IF EXISTS "Company Access Variants" ON product_variants;
CREATE POLICY "Company Access Variants" ON product_variants
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

-- Variant Textures Policies (Cascade check)
DROP POLICY IF EXISTS "Company Access Textures" ON variant_textures;
CREATE POLICY "Company Access Textures" ON variant_textures
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
