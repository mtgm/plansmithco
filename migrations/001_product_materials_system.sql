-- Migration: Add Product Materials, Variants and Textures Support
-- Description: Creates tables for managing product materials extracted from GLB files,
--              their variants, and associated texture files (BaseColor, Normal, ORM)

-- ============================================================================
-- 1. Product Materials Table
-- Stores the materials extracted from a GLB file
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    material_id TEXT NOT NULL, -- GLB material identifier (e.g., "polished brass.001")
    name TEXT NOT NULL, -- Display name for the material
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique material_id per product
    UNIQUE(product_id, material_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_materials_product_id 
ON product_materials(product_id);

-- ============================================================================
-- 2. Product Variants Table
-- Stores different color/texture variants for each material
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES product_materials(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL, -- e.g., "Orijinal", "Yeni Seçenek"
    is_original BOOLEAN DEFAULT FALSE, -- Whether this is the GLB default
    swatch_url TEXT, -- R2 URL for the variant preview image
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique variant names per material
    UNIQUE(material_id, variant_name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_variants_material_id 
ON product_variants(material_id);

-- ============================================================================
-- 3. Variant Textures Table
-- Stores the texture files for each variant
-- ============================================================================
CREATE TABLE IF NOT EXISTS variant_textures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    base_color_url TEXT, -- R2 URL for base color texture
    normal_url TEXT, -- R2 URL for normal map
    orm_url TEXT, -- R2 URL for ORM (Occlusion, Roughness, Metallic) map
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Each variant should have only one set of textures
    UNIQUE(variant_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_variant_textures_variant_id 
ON variant_textures(variant_id);

-- ============================================================================
-- 4. Update Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_materials_updated_at
    BEFORE UPDATE ON product_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variant_textures_updated_at
    BEFORE UPDATE ON variant_textures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE product_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_textures ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access materials from their company's products
CREATE POLICY "Users can view materials from their company's products"
    ON product_materials FOR SELECT
    USING (
        product_id IN (
            SELECT id FROM products 
            WHERE company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can insert materials for their company's products"
    ON product_materials FOR INSERT
    WITH CHECK (
        product_id IN (
            SELECT id FROM products 
            WHERE company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can update materials from their company's products"
    ON product_materials FOR UPDATE
    USING (
        product_id IN (
            SELECT id FROM products 
            WHERE company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can delete materials from their company's products"
    ON product_materials FOR DELETE
    USING (
        product_id IN (
            SELECT id FROM products 
            WHERE company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

-- Similar policies for product_variants (cascade through materials)
CREATE POLICY "Users can view variants"
    ON product_variants FOR SELECT
    USING (
        material_id IN (
            SELECT pm.id FROM product_materials pm
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can insert variants"
    ON product_variants FOR INSERT
    WITH CHECK (
        material_id IN (
            SELECT pm.id FROM product_materials pm
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can update variants"
    ON product_variants FOR UPDATE
    USING (
        material_id IN (
            SELECT pm.id FROM product_materials pm
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can delete variants"
    ON product_variants FOR DELETE
    USING (
        material_id IN (
            SELECT pm.id FROM product_materials pm
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

-- Similar policies for variant_textures
CREATE POLICY "Users can view textures"
    ON variant_textures FOR SELECT
    USING (
        variant_id IN (
            SELECT pv.id FROM product_variants pv
            JOIN product_materials pm ON pv.material_id = pm.id
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can insert textures"
    ON variant_textures FOR INSERT
    WITH CHECK (
        variant_id IN (
            SELECT pv.id FROM product_variants pv
            JOIN product_materials pm ON pv.material_id = pm.id
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can update textures"
    ON variant_textures FOR UPDATE
    USING (
        variant_id IN (
            SELECT pv.id FROM product_variants pv
            JOIN product_materials pm ON pv.material_id = pm.id
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

CREATE POLICY "Users can delete textures"
    ON variant_textures FOR DELETE
    USING (
        variant_id IN (
            SELECT pv.id FROM product_variants pv
            JOIN product_materials pm ON pv.material_id = pm.id
            JOIN products p ON pm.product_id = p.id
            WHERE p.company_id = (
                SELECT company_id FROM auth.users 
                WHERE id = auth.uid()
            )
        )
        OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

-- ============================================================================
-- Sample Query Examples
-- ============================================================================

-- Get all materials and variants for a product
-- SELECT 
--     pm.id as material_id,
--     pm.name as material_name,
--     pv.id as variant_id,
--     pv.variant_name,
--     pv.swatch_url,
--     vt.base_color_url,
--     vt.normal_url,
--     vt.orm_url
-- FROM product_materials pm
-- LEFT JOIN product_variants pv ON pm.id = pv.material_id
-- LEFT JOIN variant_textures vt ON pv.id = vt.variant_id
-- WHERE pm.product_id = 'your-product-id'
-- ORDER BY pm.name, pv.variant_name;
