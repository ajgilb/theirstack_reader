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
        testMode = false
    } = options;

    console.log(`🚀 Starting Job Search API scraping...`);
    console.log(`📋 Job types: ${jobTypes.join(', ')}`);
    console.log(`📍 Location: ${location}`);
    console.log(`💰 Min salary: $${salaryMin.toLocaleString()}`);
    console.log(`🧪 Test mode: ${testMode}`);

    const allJobs = [];
    const apiKey = '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
    const apiUrl = 'https://jobs-search-api.p.rapidapi.com/getjobs';

    // Process each job type with batch requests to get more than 20 results
    for (const jobType of jobTypes) {
        console.log(`\n🔍 Searching for "${jobType}" jobs...`);

        const jobTypeResults = [];
        const maxBatches = testMode ? 1 : 20; // Get up to 20 batches (1000+ jobs) in normal mode, 1 batch in test mode

        // Try multiple batches to get maximum results
        for (let batch = 0; batch < maxBatches; batch++) {
            try {
                console.log(`📡 Making API request for "${jobType}" (batch ${batch + 1}/${maxBatches})...`);
                // Request 50 jobs per batch (consistent, reliable size)
                const requestBody = {
                    search_term: jobType,
                    location: location,
                    results_wanted: 50, // Consistent 50 per batch
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

                // Try different pagination parameters for subsequent batches
                if (batch > 0) {
                    // Try offset approach (50 jobs per batch)
                    requestBody.offset = batch * 50;

                    // Also try page approach as backup
                    requestBody.page = batch + 1;

                    // Try start parameter as another option
                    requestBody.start = batch * 50;

                    console.log(`   📄 Trying pagination: offset=${requestBody.offset}, page=${requestBody.page}`);
                }

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
                console.log(`✅ API response received for "${jobType}" batch ${batch + 1}`);
                console.log(`🔍 DEBUG: Response data keys:`, Object.keys(data));
                console.log(`🔍 DEBUG: Jobs array exists:`, !!data.jobs);
                console.log(`🔍 DEBUG: Jobs array length:`, data.jobs ? data.jobs.length : 'N/A');

                if (!data.jobs || !Array.isArray(data.jobs)) {
                    console.log(`⚠️  No jobs found for "${jobType}" batch ${batch + 1}`);
                    console.log(`🔍 DEBUG: Full response data:`, JSON.stringify(data, null, 2));
                    break; // No more results available
                }

                console.log(`📊 Found ${data.jobs.length} jobs for "${jobType}" batch ${batch + 1}`);

                // Process and normalize the job data
                const processedJobs = data.jobs.map(job => normalizeJobData(job, jobType));

                // Check for duplicates by comparing job URLs/IDs to detect if pagination is working
                const existingUrls = new Set(jobTypeResults.map(job => job.url || job.apply_link));
                const newJobs = processedJobs.filter(job => !existingUrls.has(job.url || job.apply_link));

                console.log(`   📊 New unique jobs in this batch: ${newJobs.length} (${processedJobs.length - newJobs.length} duplicates)`);

                // If we got mostly duplicates, pagination isn't working - stop
                if (batch > 0 && newJobs.length < 5) {
                    console.log(`   🛑 Only ${newJobs.length} new jobs found, pagination likely not working. Stopping batches.`);
                    jobTypeResults.push(...newJobs); // Add the few new ones we found
                    break;
                }

                jobTypeResults.push(...newJobs); // Only add new jobs

                // If we got fewer than 10 results or no results, we've likely reached the end
                if (data.jobs.length < 10) {
                    console.log(`   📝 Received ${data.jobs.length} jobs (less than 10), likely reached end of results`);
                    break;
                }

                // If we got 0 results, definitely stop
                if (data.jobs.length === 0) {
                    console.log(`   📝 No more jobs available, stopping batch requests`);
                    break;
                }

                // Add delay between batch requests
                if (batch < maxBatches - 1) {
                    console.log(`   ⏱️  Waiting 2 seconds before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.error(`❌ Error in batch ${batch + 1} for "${jobType}":`, error.message);
                break; // Stop trying more batches for this job type
            }
        }

        console.log(`📊 Total collected for "${jobType}": ${jobTypeResults.length} jobs across batches`);

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
                // Check if company name is a salary-related word
                if (isSalaryCompanyName(job.company)) {
                    console.log(`🚫 Excluding job with salary-like company name: "${job.title}" at "${job.company}"`);
                    excludedBySalaryCompanyName++;
                    return false;
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
