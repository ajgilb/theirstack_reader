-- Simple script to populate rapidapi tables with sample data
-- No sequence resets, just clear and insert

-- Clear existing data (contacts first due to foreign key)
DELETE FROM rapidapi_contacts;
DELETE FROM rapidapi_jobs;

-- Insert sample jobs (let the ID auto-increment naturally)
INSERT INTO rapidapi_jobs (
    title, company, location, salary, url, job_details, domain, date_added, last_updated
) VALUES 
('Executive Chef', 'Fine Dining Bistro', 'New York, NY, US', '$75,000 - $85,000', 
 'https://finediningbistro.com/careers/executive-chef-001', 
 'Seeking experienced Executive Chef for fine dining restaurant. 5+ years experience required.',
 'finediningbistro.com', NOW(), NOW()),

('Sous Chef', 'Urban Kitchen', 'Los Angeles, CA, US', '$55,000 - $65,000',
 'https://urbankitchen.com/jobs/sous-chef-la-002',
 'Join our dynamic kitchen team as Sous Chef. 3+ years experience in high-volume restaurants.',
 'urbankitchen.com', NOW(), NOW()),

('Kitchen Manager', 'Coastal Seafood House', 'Miami, FL, US', '$60,000 - $70,000',
 'https://coastalseafood.com/careers/kitchen-manager-003',
 'Kitchen Manager position overseeing daily operations. Management experience required.',
 'coastalseafood.com', NOW(), NOW());

-- Insert sample contacts using the actual job IDs that were just created
INSERT INTO rapidapi_contacts (job_id, name, title, email, date_added, last_updated) 
SELECT 
    j.id,
    CASE 
        WHEN j.title = 'Executive Chef' THEN 'Sarah Johnson'
        WHEN j.title = 'Sous Chef' THEN 'Michael Chen'
        WHEN j.title = 'Kitchen Manager' THEN 'Lisa Rodriguez'
    END as name,
    CASE 
        WHEN j.title = 'Executive Chef' THEN 'General Manager'
        WHEN j.title = 'Sous Chef' THEN 'Head Chef'
        WHEN j.title = 'Kitchen Manager' THEN 'Operations Manager'
    END as title,
    CASE 
        WHEN j.title = 'Executive Chef' THEN 'sarah.johnson@finediningbistro.com'
        WHEN j.title = 'Sous Chef' THEN 'michael.chen@urbankitchen.com'
        WHEN j.title = 'Kitchen Manager' THEN 'lisa.rodriguez@coastalseafood.com'
    END as email,
    NOW() as date_added,
    NOW() as last_updated
FROM rapidapi_jobs j
WHERE j.title IN ('Executive Chef', 'Sous Chef', 'Kitchen Manager');

-- Verify the data was inserted
SELECT 'Jobs inserted:' as status, COUNT(*) as count FROM rapidapi_jobs
UNION ALL
SELECT 'Contacts inserted:' as status, COUNT(*) as count FROM rapidapi_contacts;

-- Show the sample data with relationships
SELECT 
    j.id as job_id,
    j.title,
    j.company,
    j.location,
    c.name as contact_name,
    c.email as contact_email
FROM rapidapi_jobs j
LEFT JOIN rapidapi_contacts c ON j.id = c.job_id
ORDER BY j.id;
