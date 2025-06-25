/**
 * Job Search API Integration
 * Uses PR Labs Job Search API to get jobs from LinkedIn, Indeed, ZipRecruiter, and Glassdoor
 */

import fetch from 'node-fetch';

// Import filtering functions from existing modules
import { shouldExcludeCompany } from './google_jobs_api.js';
import { isSalaryCompanyName } from './bing_search_api.js';

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

    // Process each job type
    for (const jobType of jobTypes) {
        console.log(`\n🔍 Searching for "${jobType}" jobs...`);

        try {
            const requestBody = {
                search_term: jobType,
                location: location,
                results_wanted: testMode ? 10 : 50, // Limit results in test mode
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

            console.log(`📡 Making API request for "${jobType}"...`);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'x-rapidapi-key': apiKey,
                    'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
                continue;
            }

            const data = await response.json();
            console.log(`✅ API response received for "${jobType}"`);

            if (!data.jobs || !Array.isArray(data.jobs)) {
                console.log(`⚠️  No jobs found for "${jobType}"`);
                continue;
            }

            console.log(`📊 Found ${data.jobs.length} jobs for "${jobType}"`);

            // Process and normalize the job data
            const processedJobs = data.jobs.map(job => normalizeJobData(job, jobType));

            // Apply comprehensive filtering
            let excludedByCompany = 0;
            let excludedByFastFood = 0;
            let excludedBySalary = 0;
            let excludedBySalaryCompanyName = 0;

            const filteredJobs = processedJobs.filter(job => {
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

            allJobs.push(...filteredJobs);

            // Add delay between requests to respect rate limits
            if (jobTypes.indexOf(jobType) < jobTypes.length - 1) {
                console.log(`⏱️  Waiting 2 seconds before next request...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } catch (error) {
            console.error(`❌ Error searching for "${jobType}":`, error.message);
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
