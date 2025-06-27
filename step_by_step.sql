-- Step by step setup - run each section separately to see where it fails

-- STEP 1: Check current state
SELECT 'STEP 1: Current table counts' as step;
SELECT 'rapidapi_jobs' as table_name, COUNT(*) as count FROM rapidapi_jobs
UNION ALL
SELECT 'rapidapi_contacts' as table_name, COUNT(*) as count FROM rapidapi_contacts;

-- STEP 2: Clear data
SELECT 'STEP 2: Clearing existing data' as step;
DELETE FROM rapidapi_contacts;
DELETE FROM rapidapi_jobs;

-- STEP 3: Check foreign key constraint
SELECT 'STEP 3: Current foreign key constraints' as step;
SELECT 
    tc.constraint_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'rapidapi_contacts';

-- STEP 4: Fix foreign key if needed
SELECT 'STEP 4: Fixing foreign key constraint' as step;
ALTER TABLE rapidapi_contacts DROP CONSTRAINT IF EXISTS rapidapi_contacts_job_id_fkey;
ALTER TABLE rapidapi_contacts ADD CONSTRAINT rapidapi_contacts_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES rapidapi_jobs(id) ON DELETE CASCADE;

-- STEP 5: Insert ONE job first
SELECT 'STEP 5: Inserting one test job' as step;
INSERT INTO rapidapi_jobs (title, company, location, salary, url, job_details, domain, date_added, last_updated) 
VALUES ('Executive Chef', 'Fine Dining Bistro', 'New York, NY, US', '$75,000 - $85,000', 
        'https://finediningbistro.com/careers/executive-chef-001', 
        'Seeking experienced Executive Chef for fine dining restaurant.', 
        'finediningbistro.com', NOW(), NOW())
RETURNING id, title, company;

-- STEP 6: Check what job ID was created
SELECT 'STEP 6: Job that was just inserted' as step;
SELECT id, title, company FROM rapidapi_jobs WHERE title = 'Executive Chef';

-- STEP 7: Insert ONE contact for that job
SELECT 'STEP 7: Inserting one contact for the job' as step;
INSERT INTO rapidapi_contacts (job_id, name, title, email, date_added, last_updated)
SELECT id, 'Sarah Johnson', 'General Manager', 'sarah.johnson@finediningbistro.com', NOW(), NOW()
FROM rapidapi_jobs 
WHERE title = 'Executive Chef' AND company = 'Fine Dining Bistro'
RETURNING id, job_id, name, email;

-- STEP 8: Verify the relationship works
SELECT 'STEP 8: Final verification' as step;
SELECT 
    j.id as job_id,
    j.title,
    j.company,
    c.id as contact_id,
    c.name as contact_name,
    c.email
FROM rapidapi_jobs j
LEFT JOIN rapidapi_contacts c ON j.id = c.job_id
ORDER BY j.id;
