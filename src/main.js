/**
 * Google Jobs API Actor
 *
 * This actor uses the SearchAPI.io Google Jobs API to search for job listings
 * and save them to a dataset or push them to a database.
 */
import { Actor } from 'apify';
import { searchAllJobs, processJobsForDatabase } from './google_jobs_api.js';
import { testFunction } from './test.js';
import { sendCompletionEmail } from './email.js';

// Log test function result
console.log('Test function result:', testFunction());

// Import the PostgreSQL client
import pg from 'pg';
const { Pool } = pg;

// Define database variables
let pool = null;

// Try to import the REST API module
let restModule = null;
try {
    restModule = await import('./database-rest.js');
    console.log('Successfully imported database-rest.js');
} catch (restError) {
    console.error('Failed to import database-rest.js:', restError.message);
}

// Default implementation of insertJobsIntoDatabase (used if both approaches fail)
let insertJobsIntoDatabase = async (jobs) => {
    console.error('No database connection available. Cannot insert jobs.');
    return 0;
};

// Initialize database function
async function initDatabase() {
    // First try the REST API approach if available
    if (restModule) {
        try {
            console.log('Trying REST API approach first...');
            const success = await restModule.initDatabase();
            if (success) {
                console.log('Successfully connected using REST API!');
                // Use the REST API implementation
                insertJobsIntoDatabase = restModule.insertJobsIntoDatabase;
                return true;
            }
            console.log('REST API approach failed, falling back to PostgreSQL...');
        } catch (error) {
            console.error('Error with REST API approach:', error.message);
            console.log('Falling back to PostgreSQL...');
        }
    }

    // Fall back to PostgreSQL approach
    try {
        console.log('Initializing PostgreSQL database connection...');

        // Get database connection string
        let connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            console.error('No DATABASE_URL environment variable found');
            return false;
        }

        // Define alternative connection strings to try if the first one fails
        const dbUser = 'google_scraper';
        const dbPassword = 'Relham12?';
        const alternativeConnections = [
            // Direct database with IP address using new user
            `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@34.102.106.226:5432/postgres`,

            // AWS US West 1 pooler with IP address using new user
            `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@3.101.124.236:6543/postgres`,

            // Original hostname with new user (as fallback)
            `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@db.mbaqiwhkngfxxmlkionj.supabase.co:5432/postgres`
        ];

        // Add the current connection string to the list if it's not already there
        if (!alternativeConnections.includes(connectionString)) {
            alternativeConnections.unshift(connectionString);
        }

        // Try each connection string until one works
        let lastError = null;
        for (let i = 0; i < alternativeConnections.length; i++) {
            connectionString = alternativeConnections[i];
            console.log(`Trying connection string #${i+1}: ${connectionString.substring(0, 20)}...`);

            try {
                // Parse the connection string to extract components
                const parsedUrl = new URL(connectionString.replace('postgresql://', 'http://'));
                const host = parsedUrl.hostname;
                const port = parsedUrl.port || '5432';
                const database = parsedUrl.pathname.substring(1);
                const auth = parsedUrl.username + (parsedUrl.password ? ':' + parsedUrl.password : '');

                console.log(`Parsed connection details:`);
                console.log(`- Host: ${host}`);
                console.log(`- Port: ${port}`);
                console.log(`- Database: ${database}`);
                console.log(`- Auth: ${auth.substring(0, 20)}...`);

                // Create a connection pool with explicit parameters
                pool = new Pool({
                    user: auth.split(':')[0],
                    password: auth.includes(':') ? auth.split(':')[1] : '',
                    host: host,
                    port: parseInt(port, 10),
                    database: database,
                    ssl: {
                        rejectUnauthorized: false
                    },
                    // Force IPv4
                    family: 4,
                    // Set a short connection timeout
                    connectionTimeoutMillis: 5000
                });

                // Test the connection
                const result = await pool.query('SELECT NOW()');
                console.log('Successfully connected to PostgreSQL!');
                console.log(`Server time: ${result.rows[0].now}`);

                // Check if tables exist and create them if needed
                await checkAndCreateTables();

                // Set the insertJobsIntoDatabase function to use the PostgreSQL implementation
                insertJobsIntoDatabase = insertJobsIntoDatabasePostgres;

                return true;
            } catch (error) {
                console.error(`Failed to connect with connection string #${i+1}:`, error.message);
                lastError = error;

                // Close the pool if it was created
                if (pool) {
                    try {
                        await pool.end();
                    } catch (endError) {
                        console.error('Error closing pool:', endError.message);
                    }
                    pool = null;
                }
            }
        }

        // If we get here, all connection attempts failed
        console.error('All connection attempts failed. Last error:', lastError);

        // Provide more detailed error information
        if (lastError.code === 'ENOTFOUND') {
            console.error(`Could not resolve hostname: ${lastError.hostname}`);
            console.error('Please check your DATABASE_URL for typos in the hostname.');
        } else if (lastError.code === 'ECONNREFUSED') {
            console.error(`Connection refused at ${lastError.address}:${lastError.port}`);
            console.error('Please check if the port is correct and if the database server is accepting connections.');
        } else if (lastError.code === '28P01') {
            console.error('Authentication failed. Please check your username and password.');
        } else if (lastError.code === '3D000') {
            console.error('Database does not exist. Please check the database name in your connection string.');
        }

        return false;
    } catch (error) {
        console.error('Unexpected error during database initialization:', error);
        return false;
    }
}

// Check if tables exist and create them if needed
async function checkAndCreateTables() {
    try {
        console.log('Checking if required tables exist...');

        // Check if culinary_jobs_google table exists
        const jobsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs_google'
            );
        `);

        const jobsTableExists = jobsTableCheck.rows[0].exists;
        console.log(`Table culinary_jobs_google exists: ${jobsTableExists}`);

        if (!jobsTableExists) {
            console.log('Creating culinary_jobs_google table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS culinary_jobs_google (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    company VARCHAR(255) NOT NULL,
                    parent_company VARCHAR(255),
                    location VARCHAR(255),
                    salary VARCHAR(255),
                    contact_name VARCHAR(255),
                    contact_title VARCHAR(255),
                    email VARCHAR(255),
                    url TEXT,
                    job_details TEXT,
                    linkedin VARCHAR(255),
                    domain VARCHAR(255),
                    company_size VARCHAR(255),
                    date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    contacts_last_viewed TIMESTAMP WITH TIME ZONE,
                    parent_url VARCHAR(255),

                    CONSTRAINT culinary_jobs_google_title_company_key UNIQUE (title, company)
                );

                CREATE INDEX IF NOT EXISTS idx_google_company_name ON culinary_jobs_google(company);
                CREATE INDEX IF NOT EXISTS idx_google_job_title ON culinary_jobs_google(title);
                CREATE INDEX IF NOT EXISTS idx_google_date_added ON culinary_jobs_google(date_added);
                CREATE INDEX IF NOT EXISTS idx_google_domain ON culinary_jobs_google(domain);
                CREATE INDEX IF NOT EXISTS idx_google_parent_company ON culinary_jobs_google(parent_company);
            `);
            console.log('Table culinary_jobs_google created successfully');
        }

        // Check if culinary_contacts_google table exists
        const contactsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'culinary_contacts_google'
            );
        `);

        const contactsTableExists = contactsTableCheck.rows[0].exists;
        console.log(`Table culinary_contacts_google exists: ${contactsTableExists}`);

        if (!contactsTableExists) {
            console.log('Creating culinary_contacts_google table...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS culinary_contacts_google (
                    id SERIAL PRIMARY KEY,
                    job_id INTEGER REFERENCES culinary_jobs_google(id) ON DELETE CASCADE,
                    name VARCHAR(255),
                    title VARCHAR(255),
                    email VARCHAR(255) NOT NULL,
                    date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

                    CONSTRAINT unique_google_contact_email UNIQUE (job_id, email)
                );

                CREATE INDEX IF NOT EXISTS idx_google_contact_email ON culinary_contacts_google(email);
                CREATE INDEX IF NOT EXISTS idx_google_contact_job_id ON culinary_contacts_google(job_id);
                CREATE INDEX IF NOT EXISTS idx_google_contact_name ON culinary_contacts_google(name);
            `);
            console.log('Table culinary_contacts_google created successfully');
        }
    } catch (error) {
        console.error('Error checking or creating tables:', error);
    }
}

// Insert jobs into database function using PostgreSQL
async function insertJobsIntoDatabasePostgres(jobs) {
    if (!pool) {
        console.error('Database not initialized');
        return 0;
    }

    let insertedCount = 0;

    try {
        console.info(`Inserting ${jobs.length} jobs into the database...`);

        // Start a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const job of jobs) {
                try {
                    // Format salary as a string combining min and max
                    let salaryStr = '';
                    if (job.salary_min && job.salary_max) {
                        salaryStr = `${job.salary_min} - ${job.salary_max}`;
                        if (job.salary_currency) {
                            salaryStr = `${job.salary_currency} ${salaryStr}`;
                        }
                        if (job.salary_period) {
                            salaryStr = `${salaryStr} ${job.salary_period}`;
                        }
                    }

                    // Get the current timestamp for date fields
                    const now = new Date().toISOString();

                    // Get contact info from the first email if available
                    const contactName = job.emails && job.emails.length > 0 ?
                        `${job.emails[0].firstName || ''} ${job.emails[0].lastName || ''}`.trim() : '';
                    const contactTitle = job.emails && job.emails.length > 0 ? job.emails[0].position || '' : '';
                    const contactEmail = job.emails && job.emails.length > 0 ? job.emails[0].email || '' : '';

                    // Insert job data
                    const jobResult = await client.query(
                        `INSERT INTO culinary_jobs_google
                        (title, company, parent_company, location, salary, contact_name, contact_title, email,
                        url, job_details, linkedin, domain, company_size, date_added, last_updated, contacts_last_viewed, parent_url)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                        ON CONFLICT (title, company) DO UPDATE SET
                        location = EXCLUDED.location,
                        salary = EXCLUDED.salary,
                        contact_name = EXCLUDED.contact_name,
                        contact_title = EXCLUDED.contact_title,
                        email = EXCLUDED.email,
                        url = EXCLUDED.url,
                        job_details = EXCLUDED.job_details,
                        domain = EXCLUDED.domain,
                        last_updated = EXCLUDED.last_updated
                        RETURNING id, (xmax = 0) AS is_new`,
                        [
                            job.title,
                            job.company,
                            '', // parent_company
                            job.location,
                            salaryStr,
                            contactName,
                            contactTitle,
                            contactEmail,
                            job.apply_link,
                            job.description,
                            '', // linkedin
                            job.company_domain || '',
                            '', // company_size
                            now, // date_added
                            now, // last_updated
                            null, // contacts_last_viewed
                            '' // parent_url
                        ]
                    );

                    const jobId = jobResult.rows[0].id;
                    const isNewJob = jobResult.rows[0].is_new;

                    // Track job for email reporting
                    if (isNewJob) {
                        // This is a new job
                        jobStats.newJobs.push(job);
                        console.info(`Added NEW job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
                    } else {
                        // This is a duplicate job
                        jobStats.skippedDuplicateJobs.push(job);
                        console.info(`Updated existing job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
                    }

                    // Insert email contacts if available
                    if (job.emails && job.emails.length > 0) {
                        for (const email of job.emails) {
                            try {
                                // Combine first and last name
                                const fullName = `${email.firstName || ''} ${email.lastName || ''}`.trim();

                                await client.query(
                                    `INSERT INTO culinary_contacts_google
                                    (job_id, name, title, email, date_added, last_updated)
                                    VALUES ($1, $2, $3, $4, $5, $6)
                                    ON CONFLICT (job_id, email) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    title = EXCLUDED.title,
                                    last_updated = EXCLUDED.last_updated`,
                                    [
                                        jobId,
                                        fullName,
                                        email.position || '',
                                        email.email,
                                        now,
                                        now
                                    ]
                                );
                            } catch (emailError) {
                                console.error(`Error inserting contact ${email.email}:`, emailError);
                            }
                        }
                        console.info(`Inserted ${job.emails.length} email contacts for job ID ${jobId}`);
                    }

                    insertedCount++;
                    console.info(`Inserted job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
                } catch (error) {
                    console.error(`Error processing job "${job.title}" at "${job.company}":`, error);
                }
            }

            // Commit the transaction
            await client.query('COMMIT');
            console.info(`Successfully committed transaction with ${insertedCount} jobs.`);
        } catch (error) {
            // Rollback the transaction on error
            await client.query('ROLLBACK');
            console.error('Transaction failed, rolling back:', error);
        } finally {
            // Release the client back to the pool
            client.release();
        }

        console.info(`Successfully inserted ${insertedCount} jobs into the database.`);
        return insertedCount;
    } catch (error) {
        console.error('Error during database insertion:', error);
        return insertedCount;
    }
}

// Initialize the Apify Actor
await Actor.init();

// Track job statistics for email reporting
const jobStats = {
    startTime: new Date(),
    endTime: null,
    durationMinutes: 0,
    durationSeconds: 0,
    processedCount: 0,
    newJobs: [],
    skippedDuplicateJobs: [],
    skippedExcludedJobs: [],
    queries: []
};

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
        maxPagesPerQuery = 10, // Increased from 5 to 10 to get more jobs
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
        includeHunterData = true,
        // Read testMode from input
        testMode = false
    } = input;

    // Store queries in job stats
    jobStats.queries = [...queries];

    // Force Hunter.io integration to be enabled
    const forceHunterData = true;

    // Force database integration to be enabled
    const forcePushToDatabase = true;

    // Number of jobs to process in test mode (only used when testMode is true)
    const testModeLimit = 5;

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
    console.log(`- Test mode: ${testMode}${testMode ? ` (limit: ${testModeLimit} jobs per query, email only to aj@chefsheet.com)` : ''}`);

    let totalJobsFound = 0;
    let totalJobsProcessed = 0;
    let totalJobsSaved = 0;

    // In test mode, only process the first query
    const queriesToProcess = testMode ? queries.slice(0, 1) : queries;
    console.log(`Processing ${queriesToProcess.length} queries${testMode ? ' (test mode - only first query)' : ''}`);

    // Process each query
    for (const query of queriesToProcess) {
        // In test mode, process enough pages to get our target number of jobs
        // Start with 1 page, but allow up to 3 pages in test mode if needed
        const pagesToProcess = testMode ? 3 : maxPagesPerQuery;
        console.log(`Searching for jobs with query: "${query}" (${testMode ? 'test mode - up to 3 pages' : `up to ${pagesToProcess} pages`})`);

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

        // In test mode, only process a limited number of jobs
        const jobsToProcess = testMode ? filteredJobs.slice(0, testModeLimit) : filteredJobs;
        console.log(`Processing ${jobsToProcess.length} jobs${testMode ? ` (test mode - limit: ${testModeLimit})` : ''}`);

        // Log the jobs we're processing
        if (testMode) {
            console.log('Jobs being processed:');
            jobsToProcess.forEach((job, index) => {
                console.log(`Job #${index + 1}: "${job.title}" at "${job.company}" in "${job.location}"`);
            });
        }

        // Process jobs for database insertion
        // Always use forceHunterData (which is true) instead of includeHunterData
        const processedJobs = await processJobsForDatabase(jobsToProcess, forceHunterData);

        // Track excluded jobs for email reporting
        const excludedJobs = jobsToProcess.filter(job => job._exclusionReason);
        jobStats.skippedExcludedJobs.push(...excludedJobs);

        // Update job processing count
        totalJobsProcessed += processedJobs.length;
        jobStats.processedCount += processedJobs.length;

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

            // Set database connection environment variables
            if (databaseUrl) {
                console.log(`Using provided database URL: ${databaseUrl.substring(0, 20)}...`);
                process.env.DATABASE_URL = databaseUrl;
            } else if (!process.env.DATABASE_URL) {
                // Use the new database user credentials
                const dbUser = 'google_scraper';
                const dbPassword = 'Relham12?';

                // Try different connection strings with direct IP addresses
                const connectionOptions = [
                    // Option 1: Direct database with IP address using new user
                    `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@34.102.106.226:5432/postgres`,

                    // Option 2: AWS US West 1 pooler with IP address using new user
                    `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@3.101.124.236:6543/postgres`,

                    // Option 3: Original hostname with new user (as fallback)
                    `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@db.mbaqiwhkngfxxmlkionj.supabase.co:5432/postgres`
                ];

                // Use the first option by default
                console.log('No database URL provided. Using default DATABASE_URL with new user credentials.');
                process.env.DATABASE_URL = connectionOptions[0];
            } else {
                console.log('Using environment DATABASE_URL variable.');
            }

            // Initialize the database connection
            const dbInitialized = await initDatabase();

            if (dbInitialized) {
                // Insert jobs into the database
                const insertedCount = await insertJobsIntoDatabase(processedJobs);
                console.log(`Successfully inserted ${insertedCount} jobs into the database (${databaseTable}).`);
            } else {
                console.error(`Failed to initialize database connection. Please check your database credentials.`);
                console.error(`Make sure to set DATABASE_URL or all SUPABASE_* environment variables in the Apify console.`);
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
    // Calculate end time and duration
    jobStats.endTime = new Date();
    const durationMs = jobStats.endTime - jobStats.startTime;
    jobStats.durationSeconds = Math.round(durationMs / 1000);
    jobStats.durationMinutes = Math.round(durationMs / 60000 * 10) / 10; // Round to 1 decimal place

    console.log(`\nJob Statistics:`);
    console.log(`- Start time: ${jobStats.startTime.toISOString()}`);
    console.log(`- End time: ${jobStats.endTime.toISOString()}`);
    console.log(`- Duration: ${jobStats.durationMinutes} minutes (${jobStats.durationSeconds} seconds)`);
    console.log(`- Jobs processed: ${jobStats.processedCount}`);
    console.log(`- New jobs: ${jobStats.newJobs.length}`);
    console.log(`- Skipped duplicates: ${jobStats.skippedDuplicateJobs.length}`);
    console.log(`- Skipped exclusions: ${jobStats.skippedExcludedJobs.length}`);

    // Send completion email
    try {
        console.log('\n=== SENDING COMPLETION EMAIL ===');
        console.log('Email configuration:');
        console.log(`- Test mode: ${testMode}`);
        console.log(`- Job stats: ${jobStats.processedCount} jobs processed, ${jobStats.newJobs.length} new, ${jobStats.skippedDuplicateJobs.length} duplicates, ${jobStats.skippedExcludedJobs.length} excluded`);

        // Pass the testMode parameter to the email function
        const emailSent = await sendCompletionEmail(jobStats, testMode);
        console.log(`Email sending ${emailSent ? 'successful' : 'failed'}`);
        console.log('=== END OF EMAIL SENDING ===\n');
    } catch (emailError) {
        console.error('Error sending completion email:', emailError);
        if (emailError.stack) {
            console.error('Stack trace:', emailError.stack);
        }
    }

    await Actor.exit();
}
