-- Clear existing data and populate with sample data
-- Run this to reset the tables with fresh sample data

-- First ensure the foreign key is correct (run fix_foreign_key.sql first if needed)

-- Clear existing data (be careful - this deletes all data!)
-- Delete contacts first due to foreign key constraint
DELETE FROM rapidapi_contacts;
DELETE FROM rapidapi_jobs;

-- Reset the sequence counters (if they exist)
-- First check what sequences exist and reset them
DO $$
BEGIN
    -- Reset rapidapi_jobs sequence if it exists
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename LIKE '%rapidapi_jobs%id%seq%') THEN
        PERFORM setval(pg_get_serial_sequence('rapidapi_jobs', 'id'), 1, false);
    END IF;

    -- Reset rapidapi_contacts sequence if it exists
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename LIKE '%rapidapi_contacts%id%seq%') THEN
        PERFORM setval(pg_get_serial_sequence('rapidapi_contacts', 'id'), 1, false);
    END IF;
END $$;

-- Insert sample jobs
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
 'coastalseafood.com', NOW(), NOW()),

('Pastry Chef', 'Artisan Bakery & Cafe', 'San Francisco, CA, US', '$50,000 - $60,000',
 'https://artisanbakery.com/jobs/pastry-chef-004',
 'Creative Pastry Chef for artisan bakery. French pastry techniques experience preferred.',
 'artisanbakery.com', NOW(), NOW()),

('Restaurant Manager', 'Mountain View Grill', 'Denver, CO, US', '$65,000 - $75,000',
 'https://mountainviewgrill.com/careers/restaurant-manager-005',
 'Restaurant Manager for front and back of house operations. 4+ years management experience.',
 'mountainviewgrill.com', NOW(), NOW());

-- Insert sample contacts
INSERT INTO rapidapi_contacts (job_id, name, title, email, date_added, last_updated) VALUES 
(1, 'Sarah Johnson', 'General Manager', 'sarah.johnson@finediningbistro.com', NOW(), NOW()),
(2, 'Michael Chen', 'Head Chef', 'michael.chen@urbankitchen.com', NOW(), NOW()),
(3, 'Lisa Rodriguez', 'Operations Manager', 'lisa.rodriguez@coastalseafood.com', NOW(), NOW()),
(4, 'David Kim', 'Bakery Manager', 'david.kim@artisanbakery.com', NOW(), NOW()),
(5, 'Jennifer Walsh', 'Regional Director', 'jennifer.walsh@mountainviewgrill.com', NOW(), NOW());

-- Verify the data
SELECT 'Jobs inserted:' as status, COUNT(*) as count FROM rapidapi_jobs
UNION ALL
SELECT 'Contacts inserted:' as status, COUNT(*) as count FROM rapidapi_contacts;

-- Show the sample data
SELECT 
    j.id,
    j.title,
    j.company,
    j.location,
    c.name as contact_name,
    c.email as contact_email
FROM rapidapi_jobs j
LEFT JOIN rapidapi_contacts c ON j.id = c.job_id
ORDER BY j.id;
