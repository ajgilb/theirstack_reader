-- Quick setup: Fix foreign key and add sample data

-- 1. Fix foreign key constraint
ALTER TABLE rapidapi_contacts DROP CONSTRAINT IF EXISTS rapidapi_contacts_job_id_fkey;
ALTER TABLE rapidapi_contacts ADD CONSTRAINT rapidapi_contacts_job_id_fkey FOREIGN KEY (job_id) REFERENCES rapidapi_jobs(id) ON DELETE CASCADE;

-- 2. Clear existing data
DELETE FROM rapidapi_contacts;
DELETE FROM rapidapi_jobs;

-- 3. Insert sample jobs
INSERT INTO rapidapi_jobs (title, company, location, salary, url, job_details, domain, date_added, last_updated) VALUES 
('Executive Chef', 'Fine Dining Bistro', 'New York, NY, US', '$75,000 - $85,000', 'https://finediningbistro.com/careers/executive-chef-001', 'Seeking experienced Executive Chef for fine dining restaurant.', 'finediningbistro.com', NOW(), NOW()),
('Sous Chef', 'Urban Kitchen', 'Los Angeles, CA, US', '$55,000 - $65,000', 'https://urbankitchen.com/jobs/sous-chef-la-002', 'Join our dynamic kitchen team as Sous Chef.', 'urbankitchen.com', NOW(), NOW()),
('Kitchen Manager', 'Coastal Seafood House', 'Miami, FL, US', '$60,000 - $70,000', 'https://coastalseafood.com/careers/kitchen-manager-003', 'Kitchen Manager position overseeing daily operations.', 'coastalseafood.com', NOW(), NOW());

-- 4. Insert sample contacts (using the IDs that were just created)
INSERT INTO rapidapi_contacts (job_id, name, title, email, date_added, last_updated) 
SELECT j.id, 
       CASE WHEN j.title = 'Executive Chef' THEN 'Sarah Johnson'
            WHEN j.title = 'Sous Chef' THEN 'Michael Chen'
            WHEN j.title = 'Kitchen Manager' THEN 'Lisa Rodriguez' END,
       CASE WHEN j.title = 'Executive Chef' THEN 'General Manager'
            WHEN j.title = 'Sous Chef' THEN 'Head Chef'
            WHEN j.title = 'Kitchen Manager' THEN 'Operations Manager' END,
       CASE WHEN j.title = 'Executive Chef' THEN 'sarah.johnson@finediningbistro.com'
            WHEN j.title = 'Sous Chef' THEN 'michael.chen@urbankitchen.com'
            WHEN j.title = 'Kitchen Manager' THEN 'lisa.rodriguez@coastalseafood.com' END,
       NOW(), NOW()
FROM rapidapi_jobs j;

-- 5. Verify
SELECT 'rapidapi_jobs' as table_name, COUNT(*) as count FROM rapidapi_jobs
UNION ALL
SELECT 'rapidapi_contacts' as table_name, COUNT(*) as count FROM rapidapi_contacts;
