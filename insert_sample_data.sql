-- Insert sample data into rapidapi_jobs and rapidapi_contacts tables
-- This helps test database insertion and provides data for duplicate checking

-- Insert sample jobs into rapidapi_jobs table
INSERT INTO rapidapi_jobs (
    title, company, parent_company, location, salary, contact_name, contact_title, 
    email, url, job_details, linkedin, domain, company_size, date_added, 
    last_updated, contacts_last_viewed, parent_url
) VALUES 
(
    'Executive Chef',
    'Fine Dining Bistro',
    NULL,
    'New York, NY, US',
    '$75,000 - $85,000',
    'Sarah Johnson',
    'General Manager',
    'sarah.johnson@finediningbistro.com',
    'https://finediningbistro.com/careers/executive-chef-001',
    'We are seeking an experienced Executive Chef to lead our kitchen team. Must have 5+ years of fine dining experience, culinary degree preferred. Responsibilities include menu development, kitchen management, staff training, and maintaining food quality standards.',
    'https://linkedin.com/company/fine-dining-bistro',
    'finediningbistro.com',
    '25-50 employees',
    NOW(),
    NOW(),
    NULL,
    'https://finediningbistro.com'
),
(
    'Sous Chef',
    'Urban Kitchen',
    NULL,
    'Los Angeles, CA, US',
    '$55,000 - $65,000',
    'Michael Chen',
    'Head Chef',
    'michael.chen@urbankitchen.com',
    'https://urbankitchen.com/jobs/sous-chef-la-002',
    'Join our dynamic kitchen team as a Sous Chef. We are looking for a passionate culinary professional with 3+ years of experience in high-volume restaurants. Must be skilled in modern cooking techniques and able to work in a fast-paced environment.',
    'https://linkedin.com/company/urban-kitchen',
    'urbankitchen.com',
    '50-100 employees',
    NOW(),
    NOW(),
    NULL,
    'https://urbankitchen.com'
),
(
    'Kitchen Manager',
    'Coastal Seafood House',
    NULL,
    'Miami, FL, US',
    '$60,000 - $70,000',
    'Lisa Rodriguez',
    'Operations Manager',
    'lisa.rodriguez@coastalseafood.com',
    'https://coastalseafood.com/careers/kitchen-manager-003',
    'Seeking an experienced Kitchen Manager to oversee daily kitchen operations. Responsibilities include inventory management, staff scheduling, food cost control, and ensuring compliance with health and safety regulations. Previous management experience required.',
    'https://linkedin.com/company/coastal-seafood-house',
    'coastalseafood.com',
    '100-200 employees',
    NOW(),
    NOW(),
    NULL,
    'https://coastalseafood.com'
),
(
    'Pastry Chef',
    'Artisan Bakery & Cafe',
    NULL,
    'San Francisco, CA, US',
    '$50,000 - $60,000',
    'David Kim',
    'Bakery Manager',
    'david.kim@artisanbakery.com',
    'https://artisanbakery.com/jobs/pastry-chef-004',
    'We are looking for a creative Pastry Chef to join our artisan bakery. Must have experience with French pastry techniques, bread making, and dessert presentation. Culinary school training preferred. Early morning shifts required.',
    'https://linkedin.com/company/artisan-bakery-cafe',
    'artisanbakery.com',
    '10-25 employees',
    NOW(),
    NOW(),
    NULL,
    'https://artisanbakery.com'
),
(
    'Restaurant Manager',
    'Mountain View Grill',
    NULL,
    'Denver, CO, US',
    '$65,000 - $75,000',
    'Jennifer Walsh',
    'Regional Director',
    'jennifer.walsh@mountainviewgrill.com',
    'https://mountainviewgrill.com/careers/restaurant-manager-005',
    'Seeking an experienced Restaurant Manager to oversee front and back of house operations. Must have 4+ years of restaurant management experience, strong leadership skills, and knowledge of POS systems. Responsible for staff management, customer service, and financial performance.',
    'https://linkedin.com/company/mountain-view-grill',
    'mountainviewgrill.com',
    '200-500 employees',
    NOW(),
    NOW(),
    NULL,
    'https://mountainviewgrill.com'
);

-- Insert corresponding contacts into rapidapi_contacts table
INSERT INTO rapidapi_contacts (
    job_id, name, title, email, date_added, last_updated
) VALUES 
(
    (SELECT id FROM rapidapi_jobs WHERE title = 'Executive Chef' AND company = 'Fine Dining Bistro'),
    'Sarah Johnson',
    'General Manager',
    'sarah.johnson@finediningbistro.com',
    NOW(),
    NOW()
),
(
    (SELECT id FROM rapidapi_jobs WHERE title = 'Sous Chef' AND company = 'Urban Kitchen'),
    'Michael Chen',
    'Head Chef',
    'michael.chen@urbankitchen.com',
    NOW(),
    NOW()
),
(
    (SELECT id FROM rapidapi_jobs WHERE title = 'Kitchen Manager' AND company = 'Coastal Seafood House'),
    'Lisa Rodriguez',
    'Operations Manager',
    'lisa.rodriguez@coastalseafood.com',
    NOW(),
    NOW()
),
(
    (SELECT id FROM rapidapi_jobs WHERE title = 'Pastry Chef' AND company = 'Artisan Bakery & Cafe'),
    'David Kim',
    'Bakery Manager',
    'david.kim@artisanbakery.com',
    NOW(),
    NOW()
),
(
    (SELECT id FROM rapidapi_jobs WHERE title = 'Restaurant Manager' AND company = 'Mountain View Grill'),
    'Jennifer Walsh',
    'Regional Director',
    'jennifer.walsh@mountainviewgrill.com',
    NOW(),
    NOW()
);

-- Add some additional contacts for the same jobs (multiple contacts per job)
INSERT INTO rapidapi_contacts (
    job_id, name, title, email, date_added, last_updated
) VALUES 
(
    (SELECT id FROM rapidapi_jobs WHERE title = 'Executive Chef' AND company = 'Fine Dining Bistro'),
    'Robert Thompson',
    'Owner',
    'robert.thompson@finediningbistro.com',
    NOW(),
    NOW()
),
(
    (SELECT id FROM rapidapi_jobs WHERE title = 'Restaurant Manager' AND company = 'Mountain View Grill'),
    'Amanda Foster',
    'HR Manager',
    'amanda.foster@mountainviewgrill.com',
    NOW(),
    NOW()
);

-- Verify the data was inserted correctly
SELECT 'rapidapi_jobs table count:' as info, COUNT(*) as count FROM rapidapi_jobs
UNION ALL
SELECT 'rapidapi_contacts table count:' as info, COUNT(*) as count FROM rapidapi_contacts;

-- Show sample of inserted data
SELECT 
    j.id,
    j.title,
    j.company,
    j.location,
    j.salary,
    COUNT(c.id) as contact_count
FROM rapidapi_jobs j
LEFT JOIN rapidapi_contacts c ON j.id = c.job_id
GROUP BY j.id, j.title, j.company, j.location, j.salary
ORDER BY j.id;
