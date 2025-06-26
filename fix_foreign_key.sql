-- Fix the foreign key constraint in rapidapi_contacts table
-- This script corrects the foreign key to reference rapidapi_jobs instead of culinary_jobs_google

-- First, check the current foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'rapidapi_contacts';

-- Drop the incorrect foreign key constraint
ALTER TABLE rapidapi_contacts 
DROP CONSTRAINT IF EXISTS rapidapi_contacts_job_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE rapidapi_contacts 
ADD CONSTRAINT rapidapi_contacts_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES rapidapi_jobs(id) ON DELETE CASCADE;

-- Verify the fix
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'rapidapi_contacts';

-- Clean up any orphaned contacts that reference non-existent jobs
DELETE FROM rapidapi_contacts 
WHERE job_id NOT IN (SELECT id FROM rapidapi_jobs);

-- Show the current state
SELECT 'rapidapi_jobs count:' as info, COUNT(*) as count FROM rapidapi_jobs
UNION ALL
SELECT 'rapidapi_contacts count:' as info, COUNT(*) as count FROM rapidapi_contacts;
