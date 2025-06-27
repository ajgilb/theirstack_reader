-- Debug script to see what's happening with the tables and foreign keys

-- 1. Check what tables exist
SELECT 'Tables that exist:' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%rapidapi%' OR table_name LIKE '%culinary%'
ORDER BY table_name;

-- 2. Check foreign key constraints
SELECT 'Foreign key constraints:' as info;
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

-- 3. Check current data in tables
SELECT 'rapidapi_jobs data:' as info;
SELECT id, title, company FROM rapidapi_jobs ORDER BY id;

SELECT 'rapidapi_contacts data:' as info;
SELECT id, job_id, name, email FROM rapidapi_contacts ORDER BY id;

-- 4. Try to insert one job manually and see what happens
INSERT INTO rapidapi_jobs (title, company, location, url, date_added, last_updated)
VALUES ('Test Job', 'Test Company', 'Test Location', 'https://test.com/job', NOW(), NOW())
RETURNING id, title, company;

-- 5. Check what ID was created
SELECT 'After insert - rapidapi_jobs data:' as info;
SELECT id, title, company FROM rapidapi_jobs ORDER BY id;

-- 6. Try to insert a contact for that job
INSERT INTO rapidapi_contacts (job_id, name, email, date_added, last_updated)
SELECT id, 'Test Contact', 'test@example.com', NOW(), NOW()
FROM rapidapi_jobs 
WHERE title = 'Test Job'
RETURNING id, job_id, name, email;
