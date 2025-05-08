/**
 * Google Jobs API Actor
 *
 * This actor uses the SearchAPI.io Google Jobs API to search for job listings
 * and save them to a dataset or push them to a database.
 */
import { Actor } from 'apify';
import { searchAllJobs, processJobsForDatabase } from './google_jobs_api.js';
import { testFunction } from './test.js';

// Log test function result
console.log('Test function result:', testFunction());

// Try to import database.js
try {
    const databaseModule = await import('./database.js');
    console.log('Successfully imported database.js');
    var { initDatabase, insertJobsIntoDatabase } = databaseModule;
} catch (error) {
    console.error('Error importing database.js:', error);
    // Provide dummy functions as fallbacks
    var initDatabase = async () => {
        console.log('Using dummy initDatabase function');
        return true;
    };
    var insertJobsIntoDatabase = async () => {
        console.log('Using dummy insertJobsIntoDatabase function');
        return 0;
    };
}

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
        // Read pushToDatabase from input but we'll force it to true below
        pushToDatabase: inputPushToDatabase = true,
        databaseUrl = '',
        databaseTable = 'culinary_jobs_google',
        deduplicateJobs = true,
        fullTimeOnly = true,
        excludeFastFood = true,
        excludeRecruiters = true,
        // Default is true, but we'll force it to true below
        includeHunterData = true
    } = input;

    // Force Hunter.io integration to be enabled
    const forceHunterData = true;

    // Force database integration to be enabled
    const forcePushToDatabase = true;

    // Test mode - set to true to process only the first job for testing
    const testMode = true;

    console.log('Google Jobs API Actor configuration:');
    console.log(`- Queries: ${queries.join(', ')}`);
    console.log(`- Max pages per query: ${maxPagesPerQuery}`);
    console.log(`- Location filter: ${location || 'None'}`);
    console.log(`- Full-time only: ${fullTimeOnly}`);
    console.log(`- Exclude fast food: ${excludeFastFood}`);
    console.log(`- Exclude recruiters: ${excludeRecruiters}`);
    console.log(`- Include Hunter.io data: ${forceHunterData} (forced to true)`);
    console.log(`- Save to dataset: ${saveToDataset}`);
    console.log(`- Push to database: ${forcePushToDatabase} (forced to true)`);
    // Always show database info since forcePushToDatabase is always true
    console.log(`- Database table: ${databaseTable}`);
    console.log(`- Deduplicate jobs: ${deduplicateJobs}`);
    console.log(`- Test mode: ${testMode} (only process first job if true)`);

    let totalJobsFound = 0;
    let totalJobsProcessed = 0;
    let totalJobsSaved = 0;

    // In test mode, only process the first query
    const queriesToProcess = testMode ? queries.slice(0, 1) : queries;
    console.log(`Processing ${queriesToProcess.length} queries${testMode ? ' (test mode - only first query)' : ''}`);

    // Process each query
    for (const query of queriesToProcess) {
        // In test mode, only process one page
        const pagesToProcess = testMode ? 1 : maxPagesPerQuery;
        console.log(`Searching for jobs with query: "${query}" (${testMode ? 'test mode - only 1 page' : `up to ${pagesToProcess} pages`})`);

        // Search for jobs
        const jobs = await searchAllJobs(query, location, pagesToProcess);

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

        // In test mode, only process the first job
        const jobsToProcess = testMode ? filteredJobs.slice(0, 1) : filteredJobs;
        console.log(`Processing ${jobsToProcess.length} jobs${testMode ? ' (test mode - only first job)' : ''}`);

        // Process jobs for database insertion
        // Always use forceHunterData (which is true) instead of includeHunterData
        const processedJobs = await processJobsForDatabase(jobsToProcess, forceHunterData);
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

        // Database integration - always enabled
        if (forcePushToDatabase) {
            console.log(`Pushing ${processedJobs.length} jobs to database...`);

            // Set the DATABASE_URL environment variable if provided
            if (databaseUrl) {
                process.env.DATABASE_URL = databaseUrl;
            }

            // Initialize the database connection
            const dbInitialized = await initDatabase();

            if (dbInitialized) {
                // Insert jobs into the database
                const insertedCount = await insertJobsIntoDatabase(processedJobs);
                console.log(`Successfully inserted ${insertedCount} jobs into the database (${databaseTable}).`);
            } else {
                console.error(`Failed to initialize database connection. Using default Supabase connection.`);
            }
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
