-- ============================================================================
-- MIGRATION 008: Set-Product Integration (Revised)
-- ============================================================================
-- Bu migration:
-- 1. products tablosuna set_id kolonu ekler
-- 2. set_products junction tablosu oluşturur
-- NOT: set_materials, set_variants ve set_variant_textures tabloları
--      takıma özel ürün eklenmeme durumu için KORUNMUŞTUR.
-- ============================================================================

-- ============================================================================
-- 2. PRODUCTS TABLOSUNA set_id KOLONU EKLE
-- Tekil ürünlerde set_id = NULL olacak.
-- Takıma ait ürünlerde set_id = takımın ID'si.
-- ============================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS set_id UUID REFERENCES sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_set_id ON products(set_id);

-- ============================================================================
-- 3. SET_PRODUCTS JUNCTION TABLOSU
-- Takım-ürün ilişkisini ve sıralama bilgisini tutar.
-- ============================================================================
DROP TABLE IF EXISTS set_products CASCADE;

CREATE TABLE IF NOT EXISTS set_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(set_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_set_products_set_id ON set_products(set_id);
CREATE INDEX IF NOT EXISTS idx_set_products_product_id ON set_products(product_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) — set_products
-- ============================================================================
ALTER TABLE set_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company Access Set Products" ON set_products;
CREATE POLICY "Company Access Set Products" ON set_products
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
