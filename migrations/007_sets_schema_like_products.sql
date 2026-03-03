-- ============================================================================
-- MIGRATION: Sets Schema — Mirror of Products Schema
-- ============================================================================
-- Bu migration:
-- 1. Eski sets tablolarını (set_variant_groups, set_variant_options, set_qr_codes) siler
-- 2. Products şemasıyla birebir aynı yapıda yeni Set tabloları oluşturur:
--    - set_materials       (= product_materials)
--    - set_variants        (= product_variants)
--    - set_variant_textures (= variant_textures)
--    - set_qr_codes        (= product_qr_codes)
-- 3. sets.view_count kolonunu kaldırır
-- ============================================================================

-- ============================================================================
-- 0. ESKİ GEREKSIZ TABLOLARI SİL
-- ============================================================================
DROP TABLE IF EXISTS set_variant_options CASCADE;
DROP TABLE IF EXISTS set_variant_groups CASCADE;
DROP TABLE IF EXISTS set_qr_codes CASCADE;

-- ============================================================================
-- 1. SET MATERIALS (= product_materials)
-- GLB dosyasından çekilen materyalleri saklar
-- ============================================================================
CREATE TABLE IF NOT EXISTS set_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    material_id TEXT NOT NULL,  -- GLB materyal tanımlayıcısı
    name TEXT NOT NULL,         -- Görünen ad
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(set_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_set_materials_set_id
ON set_materials(set_id);

-- ============================================================================
-- 2. SET VARIANTS (= product_variants)
-- Her materyal için renk/texture varyasyonları
-- ============================================================================
CREATE TABLE IF NOT EXISTS set_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES set_materials(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,        -- "Orijinal", "Altın" vb.
    is_original BOOLEAN DEFAULT FALSE, -- GLB varsayılanı mı?
    swatch_url TEXT,                   -- Varyasyon önizleme görseli
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(material_id, variant_name)
);

CREATE INDEX IF NOT EXISTS idx_set_variants_material_id
ON set_variants(material_id);

-- ============================================================================
-- 3. SET VARIANT TEXTURES (= variant_textures)
-- Her varyasyon için Base Color, Normal Map, ORM dosyaları
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_set_variant_textures_variant_id
ON set_variant_textures(variant_id);

-- ============================================================================
-- 4. SET QR CODES (= product_qr_codes)
-- Her set için QR kod kaydı
-- ============================================================================
CREATE TABLE IF NOT EXISTS set_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    qr_code_url TEXT,
    variant_config JSONB,
    scan_count INT DEFAULT 0,
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_set_qr_codes_set_id
ON set_qr_codes(set_id);

CREATE INDEX IF NOT EXISTS idx_set_qr_codes_company_id
ON set_qr_codes(company_id);

-- ============================================================================
-- 5. UPDATED_AT TRİGGERLERI
-- ============================================================================

-- update_updated_at_column fonksiyonu zaten 001 migration'ında oluşturuldu.
-- Sadece SET tabloları için triggerlar ekliyoruz.

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

DROP TRIGGER IF EXISTS update_set_qr_codes_updated_at ON set_qr_codes;
CREATE TRIGGER update_set_qr_codes_updated_at
    BEFORE UPDATE ON set_qr_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE set_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_variant_textures ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_qr_codes ENABLE ROW LEVEL SECURITY;

-- --- set_materials Policies ---

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

-- --- set_variants Policies ---

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

-- --- set_variant_textures Policies ---

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

-- --- set_qr_codes Policies ---

DROP POLICY IF EXISTS "Company Access Set QR Codes" ON set_qr_codes;
CREATE POLICY "Company Access Set QR Codes" ON set_qr_codes
    USING (
        company_id = public.get_current_user_company_id()
        OR public.is_super_admin()
    )
    WITH CHECK (
        company_id = public.get_current_user_company_id()
        OR public.is_super_admin()
    );

-- ============================================================================
-- 7. SETS TABLOSUNA EKSİK KOLONLARI EKLE / GEREKSİZLERİ KALDIR
-- ============================================================================

-- sets tablosunda olup olmadığından emin olmak için güvenli ALTER
ALTER TABLE sets ADD COLUMN IF NOT EXISTS model_url TEXT;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS custom_attributes JSONB;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS set_category_id UUID REFERENCES set_categories(id);

-- view_count kaldır (gereksiz)
ALTER TABLE sets DROP COLUMN IF EXISTS view_count;

-- ============================================================================
-- ÖRNEK SORGU
-- ============================================================================
-- SELECT
--     sm.id as material_id,
--     sm.name as material_name,
--     sv.id as variant_id,
--     sv.variant_name,
--     sv.swatch_url,
--     svt.base_color_url,
--     svt.normal_url,
--     svt.orm_url
-- FROM set_materials sm
-- LEFT JOIN set_variants sv ON sm.id = sv.material_id
-- LEFT JOIN set_variant_textures svt ON sv.id = svt.variant_id
-- WHERE sm.set_id = 'your-set-id'
-- ORDER BY sm.name, sv.variant_name;
