-- Check if tables exist and show their current state

-- Check if tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('rapidapi_jobs', 'rapidapi_contacts', 'culinary_jobs_google', 'culinary_contacts_google')
ORDER BY table_name;

-- Show table structures
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('rapidapi_jobs', 'rapidapi_contacts')
ORDER BY table_name, ordinal_position;

-- Count records in each table
SELECT 'rapidapi_jobs' as table_name, COUNT(*) as record_count FROM rapidapi_jobs
UNION ALL
SELECT 'rapidapi_contacts' as table_name, COUNT(*) as record_count FROM rapidapi_contacts
UNION ALL
SELECT 'culinary_jobs_google' as table_name, COUNT(*) as record_count FROM culinary_jobs_google
UNION ALL
SELECT 'culinary_contacts_google' as table_name, COUNT(*) as record_count FROM culinary_contacts_google;

-- Show sample data from rapidapi_jobs if it exists
SELECT 
    id,
    title,
    company,
    location,
    date_added
FROM rapidapi_jobs 
ORDER BY date_added DESC 
LIMIT 5;

-- Show sample data from rapidapi_contacts if it exists
SELECT 
    id,
    job_id,
    name,
    title,
    email,
    date_added
FROM rapidapi_contacts 
ORDER BY date_added DESC 
LIMIT 5;
