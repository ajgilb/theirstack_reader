/**
 * Google Jobs API Actor
 *
 * This actor uses the SearchAPI.io Google Jobs API to search for job listings
 * and save them to a dataset or push them to a database.
 */
import { Actor } from 'apify';
import { searchAllJobs, processJobsForDatabase } from './google_jobs_api.js';

// Initialize the Apify Actor
await Actor.init();

try {
    console.log('Starting Google Jobs API Actor...');

    // Get input from the user
    const input = await Actor.getInput() || {};
    // Extract input parameters with defaults
    const {
        queries = [
            'restaurant chefs united states',
            'restaurant managers united states',
            'hotel chefs united states',
            'hotel managers united states',
            'private chefs united states',
            'household chefs united states',
            'restaurant executives united states',
            'hotel executives united states'
        ],
        maxPagesPerQuery = 5,
        location = '',
        saveToDataset = true,
        pushToDatabase = false,
        databaseUrl = null,
        databaseTable = 'jobs',
        deduplicateJobs = true,
        fullTimeOnly = true,
        excludeFastFood = true,
        excludeRecruiters = true,
        // Default is true, but we'll force it to true below
        includeHunterData = true
    } = input;

    // Force Hunter.io integration to be enabled
    const forceHunterData = true;

    console.log('Google Jobs API Actor configuration:');
    console.log(`- Queries: ${queries.join(', ')}`);
    console.log(`- Max pages per query: ${maxPagesPerQuery}`);
    console.log(`- Location filter: ${location || 'None'}`);
    console.log(`- Full-time only: ${fullTimeOnly}`);
    console.log(`- Exclude fast food: ${excludeFastFood}`);
    console.log(`- Exclude recruiters: ${excludeRecruiters}`);
    console.log(`- Include Hunter.io data: ${forceHunterData} (forced to true)`);
    console.log(`- Save to dataset: ${saveToDataset}`);
    console.log(`- Push to database: ${pushToDatabase}`);
    if (pushToDatabase) {
        console.log(`- Database table: ${databaseTable}`);
        console.log(`- Deduplicate jobs: ${deduplicateJobs}`);
    }

    let totalJobsFound = 0;
    let totalJobsProcessed = 0;
    let totalJobsSaved = 0;

    // Process each query
    for (const query of queries) {
        console.log(`Searching for jobs with query: "${query}"`);

        // Search for jobs
        const jobs = await searchAllJobs(query, location, maxPagesPerQuery);

        if (jobs.length === 0) {
            console.log(`No jobs found for query: "${query}"`);
            continue;
        }

        console.log(`Found ${jobs.length} jobs for query: "${query}"`);
        totalJobsFound += jobs.length;

        // Filter for full-time positions if requested
        let filteredJobs = jobs;
        if (fullTimeOnly) {
            filteredJobs = jobs.filter(job =>
                job.schedule === 'Full-time' ||
                (job.extensions && job.extensions.some(ext => ext.includes('Full-time')))
            );
            console.log(`Filtered to ${filteredJobs.length} full-time positions out of ${jobs.length} total jobs`);
        }

        // Process jobs for database insertion
        // Always use forceHunterData (which is true) instead of includeHunterData
        const processedJobs = await processJobsForDatabase(filteredJobs, forceHunterData);
        totalJobsProcessed += processedJobs.length;

        // Save to Apify dataset if requested
        if (saveToDataset) {
            await Actor.pushData(processedJobs);
            console.log(`Saved ${processedJobs.length} jobs to Apify dataset`);
            totalJobsSaved += processedJobs.length;
        }

        // Display job data in logs
        console.log(`\n=== Job Data for Query: "${query}" ===`);
        console.log(`Found ${processedJobs.length} jobs after filtering`);

        // Display a summary of each job
        processedJobs.forEach((job, index) => {
            console.log(`\nJob #${index + 1}:`);
            console.log(`Title: ${job.title}`);
            console.log(`Company: ${job.company}`);
            console.log(`Location: ${job.location}`);
            console.log(`Posted: ${job.posted_at}`);
            console.log(`Schedule: ${job.schedule}`);
            console.log(`Experience Level: ${job.experience_level}`);

            // Display salary information if available
            if (job.salary_min || job.salary_max) {
                const salaryMin = job.salary_min ? `$${job.salary_min.toLocaleString()}` : 'Not specified';
                const salaryMax = job.salary_max ? `$${job.salary_max.toLocaleString()}` : 'Not specified';
                console.log(`Salary: ${salaryMin}${job.salary_max ? ` - ${salaryMax}` : ''} ${job.salary_period}`);
            } else {
                console.log(`Salary: Not specified`);
            }

            // Display skills if available
            if (job.skills && job.skills.length > 0) {
                console.log(`Skills: ${job.skills.join(', ')}`);
            } else {
                console.log(`Skills: None detected`);
            }

            // Display apply link
            console.log(`Apply Link: ${job.apply_link}`);

            // Display company website and domain if available
            if (job.company_website) {
                console.log(`Company Website: ${job.company_website}`);
            }
            if (job.company_domain) {
                console.log(`Company Domain: ${job.company_domain}`);
            }

            // Display emails if available
            if (job.emails && job.emails.length > 0) {
                console.log(`Emails Found: ${job.emails.length}`);
                // Display up to 20 emails
                job.emails.slice(0, 20).forEach((email, idx) => {
                    console.log(`  Email #${idx+1}: ${email.email} (${email.firstName || ''} ${email.lastName || ''})${email.position ? ` - ${email.position}` : ''}`);
                });
            }

            // Display a short excerpt of the description
            const shortDescription = job.description.length > 150
                ? job.description.substring(0, 150) + '...'
                : job.description;
            console.log(`Description: ${shortDescription}`);
        });

        console.log(`\n=== End of Job Data for Query: "${query}" ===`);

        // Database integration is disabled for now
        if (pushToDatabase && databaseUrl) {
            console.log(`Database integration is disabled. Would have pushed ${processedJobs.length} jobs to database.`);
        }

        // Add a delay between queries to avoid rate limits
        if (queries.indexOf(query) < queries.length - 1) {
            console.log('Waiting 5 seconds before next query...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log(`Google Jobs API Actor completed.`);
    console.log(`Found ${totalJobsFound} jobs, processed ${totalJobsProcessed} jobs, saved ${totalJobsSaved} jobs.`);

} catch (error) {
    console.error(`Error in Google Jobs API Actor: ${error.message}`);
    throw error;
} finally {
    await Actor.exit();
}
