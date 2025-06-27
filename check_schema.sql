-- Check the exact schema of rapidapi_jobs to see what fields are required

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'rapidapi_jobs'
ORDER BY ordinal_position;

-- Also check rapidapi_contacts schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'rapidapi_contacts'
ORDER BY ordinal_position;
