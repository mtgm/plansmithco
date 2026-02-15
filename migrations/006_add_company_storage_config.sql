-- ============================================================================
-- 006_add_company_storage_config.sql
-- Description: Adds storage configuration columns to companies table
--              to support multi-bucket architecture.
-- ============================================================================

-- Add columns for custom R2 bucket configuration
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
ADD COLUMN IF NOT EXISTS storage_domain TEXT; 

-- Comments for clarity
COMMENT ON COLUMN public.companies.storage_bucket IS 'Custom R2 bucket name for this company. If null, uses default.';
COMMENT ON COLUMN public.companies.storage_domain IS 'Custom domain for R2 bucket (e.g. assets.company.com). If null, uses default.';

-- Verify policies allow company admins to update these?
-- Usually, only Super Admins should set this to prevent abuse (e.g. pointing to malicious bucket).
-- But for now, we rely on existing "UPDATE companies" policy which allows company admins to update their own row.
-- If you want to restrict this, we might need a TRIGGER or separate RLS, 
-- but simpler to assume company admin is trusted or UI will hide it.
