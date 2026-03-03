-- ============================================================================
-- MIGRATION 009: Restore Set-Specific Variant Tables
-- ============================================================================
-- Bu migration:
-- 008 nolu migration'ın DÜZELTİLMEMİŞ ilk versiyonunu çalıştıranlar için
-- takım bazlı varyasyon tutma tablolarını (set_materials, set_variants,
-- set_variant_textures) geri yükler.
-- ============================================================================

-- 1. SET MATERIALS
CREATE TABLE IF NOT EXISTS set_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    material_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(set_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_set_materials_set_id ON set_materials(set_id);

-- 2. SET VARIANTS
CREATE TABLE IF NOT EXISTS set_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES set_materials(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,
    is_original BOOLEAN DEFAULT FALSE,
    swatch_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(material_id, variant_name)
);

CREATE INDEX IF NOT EXISTS idx_set_variants_material_id ON set_variants(material_id);

-- 3. SET VARIANT TEXTURES
CREATE TABLE IF NOT EXISTS set_variant_textures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES set_variants(id) ON DELETE CASCADE,
    base_color_url TEXT,
    normal_url TEXT,
    orm_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(variant_id)
);

CREATE INDEX IF NOT EXISTS idx_set_variant_textures_variant_id ON set_variant_textures(variant_id);

-- UPDATED_AT TRIGGER'LARI
DROP TRIGGER IF EXISTS update_set_materials_updated_at ON set_materials;
CREATE TRIGGER update_set_materials_updated_at
    BEFORE UPDATE ON set_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_set_variants_updated_at ON set_variants;
CREATE TRIGGER update_set_variants_updated_at
    BEFORE UPDATE ON set_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_set_variant_textures_updated_at ON set_variant_textures;
CREATE TRIGGER update_set_variant_textures_updated_at
    BEFORE UPDATE ON set_variant_textures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE set_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_variant_textures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company Access Set Materials" ON set_materials;
CREATE POLICY "Company Access Set Materials" ON set_materials
    USING (
        set_id IN (
            SELECT id FROM sets
            WHERE company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    )
    WITH CHECK (
        set_id IN (
            SELECT id FROM sets
            WHERE company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    );

DROP POLICY IF EXISTS "Company Access Set Variants" ON set_variants;
CREATE POLICY "Company Access Set Variants" ON set_variants
    USING (
        material_id IN (
            SELECT sm.id FROM set_materials sm
            JOIN sets s ON sm.set_id = s.id
            WHERE s.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    )
    WITH CHECK (
        material_id IN (
            SELECT sm.id FROM set_materials sm
            JOIN sets s ON sm.set_id = s.id
            WHERE s.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    );

DROP POLICY IF EXISTS "Company Access Set Variant Textures" ON set_variant_textures;
CREATE POLICY "Company Access Set Variant Textures" ON set_variant_textures
    USING (
        variant_id IN (
            SELECT sv.id FROM set_variants sv
            JOIN set_materials sm ON sv.material_id = sm.id
            JOIN sets s ON sm.set_id = s.id
            WHERE s.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    )
    WITH CHECK (
        variant_id IN (
            SELECT sv.id FROM set_variants sv
            JOIN set_materials sm ON sv.material_id = sm.id
            JOIN sets s ON sm.set_id = s.id
            WHERE s.company_id = public.get_current_user_company_id()
        ) OR public.is_super_admin()
    );
