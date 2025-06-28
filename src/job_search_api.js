/**
 * Job Search API Integration
 * Uses PR Labs Job Search API to get jobs from LinkedIn, Indeed, ZipRecruiter, and Glassdoor
 */

import fetch from 'node-fetch';

// Import filtering functions from existing modules
import { isSalaryCompanyName } from './bing_search_api.js';

// Simple exclusion function to avoid import issues
function shouldExcludeCompany(company) {
    if (!company || company === 'Unknown Company') return { isExcluded: false, reason: null };

    const lowerCompany = company.toLowerCase();

    // Fast food chains and restaurants to exclude
    const fastFoodChains = [
        'mcdonalds', 'burger king', 'kfc', 'taco bell', 'subway', 'pizza hut', 'dominos',
        'wendys', 'arbys', 'dairy queen', 'sonic', 'jack in the box', 'carl\'s jr',
        'hardees', 'popeyes', 'chick-fil-a', 'chipotle', 'panda express', 'five guys',
        'in-n-out', 'whataburger', 'white castle', 'little caesars', 'papa johns',
        'papa murphys', 'blaze pizza', 'mod pizza', 'qdoba', 'moes', 'del taco',
        'el pollo loco', 'church\'s chicken', 'bojangles', 'culvers', 'shake shack',
        'starbucks', 'dunkin', 'tim hortons', 'baskin robbins', 'cold stone',
        'orange julius', 'auntie annes', 'cinnabon', 'jamba juice', 'smoothie king'
    ];

    // Check for fast food chains
    for (const chain of fastFoodChains) {
        if (lowerCompany.includes(chain)) {
            return { isExcluded: true, reason: 'restaurant_chain', match: chain };
        }
    }

    // Hotel chains to exclude
    const excludedHotelChains = [
        'embassy suites', 'embassy suites by hilton', 'courtyard by marriott',
        'springhill suites', 'fairfield inn & suites', 'towneplace suites',
        'residence inn', 'moxy hotels', 'ac hotels', 'hampton by hilton',
        'tru by hilton', 'home2 suites by hilton', 'homewood suites by hilton',
        'hilton garden inn', 'holiday inn express', 'avid hotels',
        'candlewood suites', 'staybridge suites', 'comfort inn', 'comfort suites',
        'sleep inn', 'quality inn', 'clarion', 'mainstay suites',
        'suburban studios', 'woodspring suites', 'econo lodge', 'rodeway inn',
        'la quinta inn & suites', 'microtel inn & suites', 'days inn',
        'super 8', 'travelodge', 'baymont inn & suites', 'howard johnson',
        'americinn', 'best western', 'best western plus', 'surestay',
        'surestay plus', 'surestay studio', 'executive residency',
        'motel 6', 'studio 6', 'red roof inn', 'red roof plus+',
        'hometowne studios by red roof', 'my place hotels', 'cobblestone inn & suites',
        'boarders inn & suites', 'centerstone hotels', "america's best value inn",
        'canadas best value inn', 'budget inn', 'scottish inns', 'knights inn',
        'signature inn', 'americas best inns', 'greentree inn', 'stayable'
    ];

    for (const chain of excludedHotelChains) {
        if (lowerCompany.includes(chain)) {
            return { isExcluded: true, reason: 'excluded_hotel_chain', match: chain };
        }
    }

    // Healthcare and senior living companies to exclude
    const excludedHealthcare = [
        'brookdale senior living', 'atria senior living', 'sunrise senior living',
        'benchmark senior living', 'holiday retirement', 'genesis healthcare',
        'encompass health', 'amedisys', 'kindred healthcare', 'life care centers of america',
        'trilogy health services', 'lcs', 'life care services', 'compassus',
        'the ensign group', 'savaseniorcare', 'hcr manorcare', 'consulate health care',
        'pruitthealth', 'avalon health care', 'covenant care', 'promedica',
        'ascension', 'commonspirit health', 'hca healthcare', 'tenet healthcare',
        'kaiser permanente', 'mayo clinic', 'cleveland clinic', 'mass general brigham',
        'adventhealth', 'baylor scott & white health', 'uhs', 'universal health services',
        'vibra healthcare', 'select medical', 'chi living communities'
    ];

    for (const healthcare of excludedHealthcare) {
        if (lowerCompany.includes(healthcare)) {
            return { isExcluded: true, reason: 'excluded_healthcare', match: healthcare };
        }
    }

    // Education and institutional dining to exclude
    const excludedEducation = [
        'university', 'college', 'school district', 'k-12', 'elementary school',
        'middle school', 'high school', 'public school', 'private school',
        'charter school', 'academy', 'campus dining', 'student dining',
        'dining services', 'faculty dining', 'education', 'higher education',
        'cafeteria', 'resident hall', 'institutional dining', 'child nutrition',
        'meal program', 'food service worker'
    ];

    for (const education of excludedEducation) {
        if (lowerCompany.includes(education)) {
            return { isExcluded: true, reason: 'excluded_education', match: education };
        }
    }

    // Exclude companies with 'College' and 'Health Care' in the name
    if (lowerCompany.includes('college') || lowerCompany.includes('health care')) {
        return { isExcluded: true, reason: 'excluded_industry' };
    }

    return { isExcluded: false, reason: null };
}

/**
 * Scrape jobs using the Job Search API
 * @param {Object} options - Search options
 * @returns {Array} Array of job objects
 */
async function scrapeJobsWithAPI(options = {}) {
    const {
        jobTypes = ['restaurant manager'],
        location = 'United States',
        salaryMin = 55000,
        testMode = false,
        maxPagesPerSearch = 10 // Maximum pages to fetch per search term
    } = options;

    console.log(`🚀 Starting Job Search API scraping...`);
    console.log(`📋 Job types: ${jobTypes.join(', ')}`);
    console.log(`📍 Location: ${location}`);
    console.log(`💰 Min salary: $${salaryMin.toLocaleString()}`);
    console.log(`🧪 Test mode: ${testMode}`);

    const allJobs = [];
    const apiKey = process.env.RAPIDAPI_KEY || process.env['X-RapidAPI-Key'] || '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
    const apiUrl = 'https://jobs-search-api.p.rapidapi.com/getjobs';

    // Process each job type with pagination to get maximum results
    for (const jobType of jobTypes) {
        console.log(`\n🔍 Searching for "${jobType}" jobs...`);

        const jobTypeResults = [];
        let currentPage = 0;
        let hasMoreResults = true;
        const maxPages = maxPagesPerSearch; // Configurable limit to prevent infinite loops

        // Use pagination to get more than 100 jobs per search term
        while (hasMoreResults && currentPage < maxPages) {
            console.log(`📡 Making API request for "${jobType}" - Page ${currentPage + 1}...`);

            try {
                // Request with pagination offset
                const requestBody = {
                    search_term: jobType,
                    location: location,
                    results_wanted: 100, // API returns ~100 jobs max per request
                    offset: currentPage * 100, // Pagination offset
                    site_name: [
                        'indeed',
                        'linkedin',
                        'zip_recruiter',
                        'glassdoor'
                    ],
                    distance: 50, // 50 mile radius
                    job_type: 'fulltime',
                    is_remote: false,
                    linkedin_fetch_description: true, // Get full descriptions
                    hours_old: 168 // Jobs posted in last week (7 days * 24 hours)
                };

                console.log(`🔍 DEBUG: Request body:`, JSON.stringify(requestBody, null, 2));
                console.log(`🔍 DEBUG: API URL: ${apiUrl}`);
                console.log(`🔍 DEBUG: API Key: ${apiKey.substring(0, 10)}...`);

                console.log(`🔍 DEBUG: Making fetch request...`);
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'x-rapidapi-key': apiKey,
                        'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                console.log(`🔍 DEBUG: Response status: ${response.status} ${response.statusText}`);
                console.log(`🔍 DEBUG: Response headers:`, Object.fromEntries(response.headers.entries()));

                if (!response.ok) {
                    console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
                    // Try to get error details
                    try {
                        const errorText = await response.text();
                        console.error(`❌ Error response body:`, errorText);
                    } catch (e) {
                        console.error(`❌ Could not read error response`);
                    }
                    break; // Stop trying more batches for this job type
                }

                console.log(`🔍 DEBUG: Parsing JSON response...`);
                const data = await response.json();
                console.log(`✅ API response received for "${jobType}" - Page ${currentPage + 1}`);
                console.log(`🔍 DEBUG: Response data keys:`, Object.keys(data));
                console.log(`🔍 DEBUG: Jobs array exists:`, !!data.jobs);
                console.log(`🔍 DEBUG: Jobs array length:`, data.jobs ? data.jobs.length : 'N/A');

                if (!data.jobs || !Array.isArray(data.jobs)) {
                    console.log(`⚠️  No jobs found for "${jobType}" on page ${currentPage + 1}`);
                    console.log(`🔍 DEBUG: Full response data:`, JSON.stringify(data, null, 2));
                    hasMoreResults = false; // Stop pagination if no jobs returned
                } else {
                    const pageJobCount = data.jobs.length;
                    console.log(`📊 Found ${pageJobCount} jobs for "${jobType}" on page ${currentPage + 1}`);

                    // Process and normalize the job data
                    const processedJobs = data.jobs.map(job => normalizeJobData(job, jobType));
                    jobTypeResults.push(...processedJobs);

                    // Check if we should continue pagination
                    if (pageJobCount < 100) {
                        console.log(`📄 Received ${pageJobCount} jobs (less than 100), assuming last page`);
                        hasMoreResults = false;
                    } else {
                        console.log(`📄 Received full page of ${pageJobCount} jobs, checking for more...`);
                        currentPage++;

                        // Add delay between paginated requests
                        console.log(`⏱️  Waiting 2 seconds before next page...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

            } catch (error) {
                console.error(`❌ Error fetching jobs for "${jobType}" on page ${currentPage + 1}:`, error.message);
                console.error(`🔍 DEBUG: Full error:`, error);
                hasMoreResults = false; // Stop pagination on error
            }
        }

        console.log(`📊 Total collected for "${jobType}": ${jobTypeResults.length} jobs across ${currentPage + 1} pages`);

        // Now filter all the jobs for this job type
        if (jobTypeResults.length > 0) {
            try {
            console.log(`🔍 Starting filtering for ${jobTypeResults.length} jobs for "${jobType}"`);

            // Debug: Show first few company names before filtering
            console.log(`📋 Sample company names before filtering:`);
            jobTypeResults.slice(0, 5).forEach((job, index) => {
                console.log(`   ${index + 1}. "${job.company}" (title: "${job.title}")`);
            });

            // Apply comprehensive filtering
            let excludedByCompany = 0;
            let excludedByFastFood = 0;
            let excludedBySalary = 0;
            let excludedBySalaryCompanyName = 0;

            const filteredJobs = jobTypeResults.filter(job => {
                // Filter out entry-level/hourly job titles
                if (job.title) {
                    const titleLower = job.title.toLowerCase();
                    const excludedTitles = [
                        // Front of House
                        'server', 'waiter', 'waitress', 'host', 'hostess', 'busser', 'buser',
                        'food runner', 'runner', 'barback', 'bartender', 'cashier',
                        'counter server', 'drive-thru', 'drive thru', 'takeout specialist',
                        'takeout', 'delivery driver', 'delivery',

                        // Kitchen Staff
                        'line cook', 'prep cook', 'dishwasher', 'expeditor', 'expo',
                        'kitchen porter', 'pastry assistant', 'fry cook', 'pantry cook',
                        'butcher', 'commissary worker', 'cook',

                        // Hotel/Hospitality
                        'housekeeper', 'room attendant', 'laundry attendant', 'houseman',
                        'housekeeping aide', 'maintenance technician', 'janitor', 'custodian',
                        'steward', 'kitchen porter', 'banquet server', 'event setup',
                        'security officer', 'security guard',

                        // Additional exclusions
                        'assistant', 'associate', 'crew member', 'team member', 'staff'
                    ];

                    if (excludedTitles.some(excludedTitle => titleLower.includes(excludedTitle))) {
                        console.log(`🚫 Excluding entry-level job title: "${job.title}"`);
                        return false;
                    }
                }

                // Check if company name is a salary-related word
                if (isSalaryCompanyName(job.company)) {
                    console.log(`🚫 Excluding job with salary-like company name: "${job.title}" at "${job.company}"`);
                    excludedBySalaryCompanyName++;
                    return false;
                }

                // Filter out hourly salary positions
                if (job.salary) {
                    const salaryLower = job.salary.toLowerCase();
                    if (salaryLower.includes('hour') || salaryLower.includes('/hr') || salaryLower.includes('an hour')) {
                        console.log(`🚫 Excluding hourly salary job: "${job.title}" at "${job.company}" - "${job.salary}"`);
                        return false;
                    }
                }

                // Check if company should be excluded (fast food, chains, recruiters)
                const exclusionCheck = shouldExcludeCompany(job.company);
                if (exclusionCheck.isExcluded) {
                    if (exclusionCheck.reason === 'fast_food') {
                        console.log(`🚫 Excluding fast food job: "${job.title}" at "${job.company}" (matched: ${exclusionCheck.match})`);
                        excludedByFastFood++;
                    } else {
                        console.log(`🚫 Excluding excluded company job: "${job.title}" at "${job.company}" (matched: ${exclusionCheck.match})`);
                        excludedByCompany++;
                    }
                    return false;
                }

                // Filter by salary if available
                if (job.salary && job.salaryMin && job.salaryMin < salaryMin) {
                    console.log(`🚫 Excluding low salary job: "${job.title}" at "${job.company}" (${job.salary})`);
                    excludedBySalary++;
                    return false;
                }

                return true; // Include job if it passes all filters
            });

            console.log(`📊 Filtering results for "${jobType}":`);
            console.log(`   - ${excludedBySalaryCompanyName} excluded for salary-like company names`);
            console.log(`   - ${excludedByCompany} excluded for recruiter/excluded companies`);
            console.log(`   - ${excludedByFastFood} excluded for fast food restaurants`);
            console.log(`   - ${excludedBySalary} excluded for low salary`);
            console.log(`   - ${filteredJobs.length} jobs passed all filters`);

            // Debug: Show first few company names after filtering
            if (filteredJobs.length > 0) {
                console.log(`✅ Sample companies that passed filtering:`);
                filteredJobs.slice(0, 5).forEach((job, index) => {
                    console.log(`   ${index + 1}. "${job.company}" (title: "${job.title}")`);
                });
            }

            allJobs.push(...filteredJobs);

            } catch (error) {
                console.error(`❌ Error filtering jobs for "${jobType}":`, error.message);
                // Still add unfiltered jobs if filtering fails
                allJobs.push(...jobTypeResults);
            }
        }

        // Add delay between job types to respect rate limits
        if (jobTypes.indexOf(jobType) < jobTypes.length - 1) {
            console.log(`⏱️  Waiting 2 seconds before next job type...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log(`\n🎉 Job Search API completed!`);
    console.log(`📊 Total jobs found: ${allJobs.length}`);

    return allJobs;
}

/**
 * Normalize job data from different sources into consistent format
 * @param {Object} job - Raw job data from API
 * @param {string} searchTerm - Original search term
 * @returns {Object} Normalized job object
 */
function normalizeJobData(job, searchTerm) {
    // Extract salary information
    let salaryMin = null;
    let salaryMax = null;
    let salaryText = '';

    if (job.salary) {
        salaryText = job.salary;
        // Try to extract numeric salary values
        const salaryMatch = job.salary.match(/\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/);
        if (salaryMatch) {
            salaryMin = parseInt(salaryMatch[1].replace(/,/g, ''));
            if (salaryMatch[2]) {
                salaryMax = parseInt(salaryMatch[2].replace(/,/g, ''));
            }
        }
    }

    // Map to database schema (culinary_jobs_google table)
    return {
        title: job.title || 'No title',
        company: job.company || 'No company',
        parent_company: null, // Will be filled by company enhancement
        location: job.location || 'No location',
        salary: salaryText,
        contact_name: null, // Will be filled by contact enhancement
        contact_title: null, // Will be filled by contact enhancement
        email: null, // Will be filled by contact enhancement
        url: job.job_url || job.url || '', // This is the job URL (apply_link)
        job_details: job.description || job.summary || '',
        linkedin: null, // Will be filled by company enhancement
        domain: null, // Will be filled by company enhancement
        company_size: null, // Will be filled by company enhancement
        parent_url: job.company_url || '', // Company website URL

        // Additional fields for processing
        source: job.site || 'Unknown',
        jobId: job.job_id || job.id || '',
        datePosted: job.date_posted || job.posted_date || '',
        jobType: job.job_type || 'fulltime',
        isRemote: job.is_remote || false,
        searchTerm: searchTerm,
        scrapedAt: new Date().toISOString(),
        apiSource: 'PR Labs Job Search API',

        // For compatibility with existing processing
        apply_link: job.job_url || job.url || '',
        description: job.description || job.summary || '',
        company_domain: null // Will be extracted from company URL
    };
}

export {
    scrapeJobsWithAPI,
    normalizeJobData
};
