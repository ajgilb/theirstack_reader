-- Create excluded_companies table for TheirStack API filtering
-- This table stores companies that should be excluded from job searches

CREATE TABLE IF NOT EXISTS public.excluded_companies (
  id SERIAL NOT NULL,
  company_name CHARACTER VARYING(255) NOT NULL,
  parent_company CHARACTER VARYING(255) NULL,
  domain CHARACTER VARYING(255) NULL,
  excluded_by CHARACTER VARYING(100) NULL DEFAULT 'user'::CHARACTER VARYING,
  excluded_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  reason CHARACTER VARYING(500) NULL,
  is_active BOOLEAN NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT excluded_companies_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_excluded_companies_name 
ON public.excluded_companies USING btree (company_name) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_excluded_companies_parent 
ON public.excluded_companies USING btree (parent_company) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_excluded_companies_domain 
ON public.excluded_companies USING btree (domain) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_excluded_companies_active 
ON public.excluded_companies USING btree (is_active) TABLESPACE pg_default;

-- Unique constraint to prevent duplicate active exclusions
CREATE UNIQUE INDEX IF NOT EXISTS idx_excluded_companies_unique 
ON public.excluded_companies USING btree (
  LOWER((company_name)::text),
  LOWER((COALESCE(parent_company, ''::CHARACTER VARYING))::text)
) TABLESPACE pg_default
WHERE (is_active = TRUE);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_excluded_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
CREATE TRIGGER trigger_update_excluded_companies_updated_at 
    BEFORE UPDATE ON excluded_companies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_excluded_companies_updated_at();

-- Insert some initial fast food and budget hotel exclusions
INSERT INTO public.excluded_companies (company_name, reason, excluded_by) VALUES
  ('McDonald''s', 'Fast food chain', 'system'),
  ('Burger King', 'Fast food chain', 'system'),
  ('KFC', 'Fast food chain', 'system'),
  ('Taco Bell', 'Fast food chain', 'system'),
  ('Subway', 'Fast food chain', 'system'),
  ('Pizza Hut', 'Fast food chain', 'system'),
  ('Domino''s', 'Fast food chain', 'system'),
  ('Wendy''s', 'Fast food chain', 'system'),
  ('Arby''s', 'Fast food chain', 'system'),
  ('Dairy Queen', 'Fast food chain', 'system'),
  ('Sonic Drive-In', 'Fast food chain', 'system'),
  ('Chipotle', 'Fast food chain', 'system'),
  ('Panera Bread', 'Fast food chain', 'system'),
  ('Five Guys', 'Fast food chain', 'system'),
  ('In-N-Out Burger', 'Fast food chain', 'system'),
  ('Whataburger', 'Fast food chain', 'system'),
  ('Chick-fil-A', 'Fast food chain', 'system'),
  ('Popeyes', 'Fast food chain', 'system'),
  ('Dunkin''', 'Fast food chain', 'system'),
  ('Starbucks', 'Fast food chain', 'system'),
  ('Tim Hortons', 'Fast food chain', 'system'),
  ('White Castle', 'Fast food chain', 'system'),
  ('Jack in the Box', 'Fast food chain', 'system'),
  ('Carl''s Jr.', 'Fast food chain', 'system'),
  ('Hardee''s', 'Fast food chain', 'system'),
  ('Qdoba', 'Fast food chain', 'system'),
  ('Moe''s Southwest Grill', 'Fast food chain', 'system'),
  ('Panda Express', 'Fast food chain', 'system'),
  ('Shake Shack', 'Fast food chain', 'system'),
  ('Hampton Inn', 'Budget hotel chain', 'system'),
  ('Holiday Inn Express', 'Budget hotel chain', 'system'),
  ('Comfort Inn', 'Budget hotel chain', 'system'),
  ('Quality Inn', 'Budget hotel chain', 'system'),
  ('Days Inn', 'Budget hotel chain', 'system'),
  ('Super 8', 'Budget hotel chain', 'system'),
  ('Motel 6', 'Budget hotel chain', 'system'),
  ('Red Roof Inn', 'Budget hotel chain', 'system'),
  ('La Quinta Inn', 'Budget hotel chain', 'system'),
  ('Best Western', 'Budget hotel chain', 'system')
ON CONFLICT (LOWER(company_name), LOWER(COALESCE(parent_company, ''))) 
WHERE is_active = TRUE 
DO NOTHING;

-- Display summary
SELECT 
  COUNT(*) as total_excluded_companies,
  COUNT(CASE WHEN reason LIKE '%Fast food%' THEN 1 END) as fast_food_chains,
  COUNT(CASE WHEN reason LIKE '%Budget hotel%' THEN 1 END) as budget_hotels
FROM excluded_companies 
WHERE is_active = TRUE;
