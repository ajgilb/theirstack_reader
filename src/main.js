/**
 * Indeed Direct Job Scraper
 *
 * This actor is a specialized job scraping tool that directly scrapes Indeed.com
 * for culinary and restaurant management positions. It bypasses APIs and scrapes
 * Indeed directly to capture jobs that are not available through job APIs.
 */
import { Actor } from 'apify';
import { scrapeIndeedJobs } from './indeed_scraper.js';
import { shouldExcludeCompany, isSalaryCompanyName } from './bing_search_api.js';
import { getWebsiteUrlFromSearchAPI, getDomainFromUrl } from './search_api.js';
import { sendCompletionEmail } from './email.js';
import {
    initDatabase as importedInitDatabase,
    insertJobsIntoDatabase as importedInsertJobsIntoDatabase,
    fetchExistingJobs
} from './database.js';

// Import RapidAPI database module for new tables (now with correct Supabase connections)
import {
    initDatabase as rapidApiInitDatabase,
    createTablesIfNeeded,
    fetchExistingJobs as rapidApiFetchExistingJobs,
    insertJobsIntoDatabase as rapidApiInsertJobsIntoDatabase
} from './database-rapidapi.js';

// Helper function to fetch existing jobs from any table using legacy database
async function fetchExistingJobsFromTable(tableName) {
    try {
        console.log(`📋 Fetching existing jobs from ${tableName} using legacy database...`);

        // Use the existing pg import
        const { Pool } = pg;

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const client = await pool.connect();
        try {
            const query = `SELECT title, company FROM ${tableName}`;
            const result = await client.query(query);

            console.log(`📊 Found ${result.rows.length} existing jobs in ${tableName}`);

            const existingJobs = new Map();
            for (const row of result.rows) {
                const key = `${row.title.toLowerCase()}|${row.company.toLowerCase()}`;
                existingJobs.set(key, true);
            }

            console.log(`🗂️  Created lookup map with ${existingJobs.size} entries`);
            return existingJobs;
        } finally {
            client.release();
            await pool.end();
        }
    } catch (error) {
        console.log(`⚠️  Error fetching from ${tableName}: ${error.message}`);
        return new Map();
    }
}

// Log startup message
console.log('🚀 Indeed Direct Scraper starting up...');

/**
 * Enhance Indeed jobs with company website URLs using SearchAPI
 * @param {Array} jobs - Array of job objects from Indeed scraping
 * @returns {Array} Enhanced job objects with company website data
 */
async function enhanceJobsWithCompanyWebsites(jobs) {
    const enhancedJobs = [];
    let websiteFoundCount = 0;
    let websiteNotFoundCount = 0;

    console.log(`🔍 Starting website enhancement for ${jobs.length} jobs...`);

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        console.log(`Processing job ${i + 1}/${jobs.length}: "${job.title}" at "${job.company}"`);

        try {
            // Get company website URL using SearchAPI
            const websiteUrl = await getWebsiteUrlFromSearchAPI(job.company);

            // Create enhanced job object with Indeed data + website data
            const enhancedJob = {
                // Core job data from Indeed
                title: job.title || '',
                company: job.company || '',  // Fixed: use 'company' not 'company_name'
                location: job.location || '',
                description: job.description || '',
                salary: job.salary || '',
                posted_at: job.postedDate || new Date().toISOString(),
                apply_link: job.jobLink || job.url || job.apply_link || '',  // Support multiple field names
                job_id: job.jobId || job.id || '',
                source: job.source || 'Indeed Direct',
                scraped_at: job.scrapedAt || new Date().toISOString(),

                // Enhanced data from SearchAPI
                company_website: websiteUrl || null,
                company_domain: websiteUrl ? getDomainFromUrl(websiteUrl) : null,

                // Additional metadata
                job_type: job.jobType || '',
                schedule: job.schedule || '',
                experience_level: job.experienceLevel || '',

                // Salary parsing (if available)
                salary_min: null,
                salary_max: null,
                salary_period: null,

                // Skills and highlights (to be populated later if needed)
                skills: [],
                job_highlights: {
                    qualifications: [],
                    responsibilities: [],
                    benefits: []
                },

                // Apply links array (Indeed format)
                apply_links: job.jobLink ? [
                    {
                        link: job.jobLink,
                        source: 'Indeed'
                    }
                ] : []
            };

            // Parse salary information if available
            if (job.salary) {
                const salaryInfo = parseSalaryString(job.salary);
                enhancedJob.salary_min = salaryInfo.min;
                enhancedJob.salary_max = salaryInfo.max;
                enhancedJob.salary_period = salaryInfo.period;
            }

            if (websiteUrl) {
                console.log(`✅ Found website for ${job.company}: ${websiteUrl}`);
                websiteFoundCount++;
            } else {
                console.log(`❌ No website found for ${job.company}`);
                websiteNotFoundCount++;
            }

            enhancedJobs.push(enhancedJob);

            // Add delay between SearchAPI calls to avoid rate limiting
            if (i < jobs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            console.error(`Error enhancing job for ${job.company}:`, error.message);

            // Add job without website enhancement
            const basicJob = {
                title: job.title || '',
                company_name: job.company || '',
                location: job.location || '',
                description: job.description || '',
                salary: job.salary || '',
                posted_at: job.postedDate || new Date().toISOString(),
                apply_link: job.jobLink || '',
                job_id: job.jobId || '',
                source: 'Indeed Direct',
                scraped_at: job.scrapedAt || new Date().toISOString(),
                company_website: null,
                company_domain: null,
                job_type: job.jobType || '',
                schedule: job.schedule || '',
                experience_level: job.experienceLevel || '',
                salary_min: null,
                salary_max: null,
                salary_period: null,
                skills: [],
                job_highlights: { qualifications: [], responsibilities: [], benefits: [] },
                apply_links: job.jobLink ? [{ link: job.jobLink, source: 'Indeed' }] : []
            };

            enhancedJobs.push(basicJob);
            websiteNotFoundCount++;
        }
    }

    console.log(`🎯 Website enhancement completed:`);
    console.log(`   ✅ Websites found: ${websiteFoundCount}`);
    console.log(`   ❌ Websites not found: ${websiteNotFoundCount}`);
    console.log(`   📊 Success rate: ${Math.round((websiteFoundCount / jobs.length) * 100)}%`);

    return enhancedJobs;
}

/**
 * Parse salary string to extract min, max, and period
 * @param {string} salaryString - Salary string from Indeed
 * @returns {Object} Parsed salary information
 */
function parseSalaryString(salaryString) {
    if (!salaryString) return { min: null, max: null, period: null };

    // Remove common prefixes and clean up
    const cleaned = salaryString.replace(/^(From|Up to|Estimated)\s*/i, '').trim();

    // Extract numbers (handle commas and dollar signs)
    const numbers = cleaned.match(/\$?[\d,]+/g);
    if (!numbers) return { min: null, max: null, period: null };

    // Convert to actual numbers
    const amounts = numbers.map(num => parseInt(num.replace(/[$,]/g, '')));

    // Determine period
    let period = 'year';
    if (/hour|hr/i.test(salaryString)) period = 'hour';
    else if (/month|mo/i.test(salaryString)) period = 'month';
    else if (/week|wk/i.test(salaryString)) period = 'week';

    // Return min/max
    if (amounts.length === 1) {
        return { min: amounts[0], max: amounts[0], period };
    } else if (amounts.length >= 2) {
        return { min: Math.min(...amounts), max: Math.max(...amounts), period };
    }

    return { min: null, max: null, period };
}

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
    console.log('Using dummy insertJobsIntoDatabase function');
    return 0;
};

// Initialize database function
async function initDatabase(databaseTable = 'rapidapi_jobs') {
    // For rapidapi_jobs table, use the RapidAPI database module
    if (databaseTable === 'rapidapi_jobs' || databaseTable === 'rapidapi_contacts') {
        console.log('🔧 Using RapidAPI database module for RapidAPI tables...');
        try {
            const success = await rapidApiInitDatabase();
            if (success) {
                console.log('Successfully connected using RapidAPI database module!');

                // Try to ensure tables are created (but don't fail if this doesn't work)
                try {
                    const contactsTable = databaseTable.replace('_jobs', '_contacts');
                    console.log(`Creating tables if needed: ${databaseTable}, ${contactsTable}`);
                    await createTablesIfNeeded(databaseTable, contactsTable);
                    console.log('✅ RapidAPI tables verified/created successfully');
                } catch (tableError) {
                    console.warn('⚠️  Table creation had issues, but continuing with RapidAPI database:', tableError.message);
                    // Continue anyway - tables might already exist
                }

                // Use the RapidAPI implementation for BOTH reading and writing
                const contactsTable = databaseTable.replace('_jobs', '_contacts');
                insertJobsIntoDatabase = (jobs) => rapidApiInsertJobsIntoDatabase(jobs, databaseTable, contactsTable);
                console.log(`✅ Set up RapidAPI database insertion for tables: ${databaseTable}, ${contactsTable}`);
                console.log(`🔧 FORCING RapidAPI database for both reading AND writing to ensure consistency`);
                return true;
            }
            console.log('RapidAPI database module failed, falling back to legacy database...');
        } catch (error) {
            console.error('Error with RapidAPI database module:', error.message);
            console.log('Falling back to legacy database approach...');
        }
    }

    // Only try legacy database if we're NOT using rapidapi_jobs table
    if (databaseTable !== 'rapidapi_jobs') {
        // Fallback to legacy database.js implementation
        try {
            console.log('Trying legacy database.js implementation...');
            const success = await importedInitDatabase();
            if (success) {
                console.log('Successfully connected using legacy database.js!');
                // Use the imported implementation
                insertJobsIntoDatabase = importedInsertJobsIntoDatabase;
                return true;
            }
            console.log('Legacy database.js approach failed, falling back to REST API...');
        } catch (error) {
            console.error('Error with legacy database.js approach:', error.message);
            console.log('Falling back to REST API...');
        }
    } else {
        console.log('🚫 Skipping legacy database for rapidapi_jobs table - must use RapidAPI database module');
        console.log('❌ RapidAPI database module failed but is required for rapidapi_jobs table');
    }

    // Next try the REST API approach if available
    if (restModule) {
        try {
            console.log('Trying REST API approach...');
            const success = await restModule.initDatabase();
            if (success) {
                console.log('Successfully connected using REST API!');
                // Use the REST API implementation
                insertJobsIntoDatabase = restModule.insertJobsIntoDatabase;
                return true;
            }
            console.log('REST API approach failed, falling back to dummy implementation...');
        } catch (error) {
            console.error('Error with REST API approach:', error.message);
            console.log('Falling back to dummy implementation...');
        }
    }

    // If all else fails, use the dummy implementation
    console.log('Using dummy initDatabase function');
    return false;
}

// Check for and remove URL unique constraint
async function checkAndRemoveUrlConstraint() {
    try {
        console.log('Checking for URL unique constraint...');

        // Check if the URL constraint exists
        const constraintCheck = await pool.query(`
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
            WHERE rel.relname = 'culinary_jobs_google'
            AND att.attname = 'url'
            AND con.contype = 'u';
        `);

        if (constraintCheck.rows.length > 0) {
            const constraintName = constraintCheck.rows[0].conname;
            console.log(`Found URL unique constraint: ${constraintName}`);

            // Drop the constraint
            console.log(`Removing URL unique constraint: ${constraintName}...`);
            await pool.query(`
                ALTER TABLE culinary_jobs_google
                DROP CONSTRAINT ${constraintName};
            `);

            console.log(`Successfully removed URL unique constraint: ${constraintName}`);

            // Create an index on URL instead (for performance but not uniqueness)
            console.log('Creating non-unique index on URL column...');
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_google_url ON culinary_jobs_google(url);
            `);

            console.log('Successfully created non-unique index on URL column');
        } else {
            console.log('No URL unique constraint found - no action needed');

            // Check if the URL index exists
            const indexCheck = await pool.query(`
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'culinary_jobs_google'
                AND indexname = 'idx_google_url';
            `);

            if (indexCheck.rows.length === 0) {
                console.log('Creating non-unique index on URL column...');
                await pool.query(`
                    CREATE INDEX IF NOT EXISTS idx_google_url ON culinary_jobs_google(url);
                `);
                console.log('Successfully created non-unique index on URL column');
            }
        }

        // Also check for email-company constraint
        const emailCompanyConstraintCheck = await pool.query(`
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'culinary_jobs_google'
            AND con.conname = 'culinary_jobs_google_email_company_key';
        `);

        if (emailCompanyConstraintCheck.rows.length > 0) {
            const constraintName = emailCompanyConstraintCheck.rows[0].conname;
            console.log(`Found email-company unique constraint: ${constraintName}`);

            // Drop the constraint
            console.log(`Removing email-company unique constraint: ${constraintName}...`);
            await pool.query(`
                ALTER TABLE culinary_jobs_google
                DROP CONSTRAINT ${constraintName};
            `);

            console.log(`Successfully removed email-company unique constraint: ${constraintName}`);
        }
    } catch (error) {
        console.error('Error checking or removing URL constraint:', error);
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

        // Check and remove URL unique constraint if it exists
        if (jobsTableExists) {
            await checkAndRemoveUrlConstraint();
        }

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

// Store testMode in a variable accessible throughout the file
let isTestMode = false;

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
    console.log('Starting Indeed Job Scraper...');

    // Get input from the user
    const input = await Actor.getInput() || {};

    // Extract visual monitoring option - Default to headless for Apify Cloud compatibility
    const visualMonitoring = input.visualMonitoring !== undefined ? input.visualMonitoring : false; // Default to headless
    console.log(`🖥️  Browser mode: ${visualMonitoring ? 'HEADFUL (visible browser - may not work on Apify Cloud)' : 'HEADLESS (optimized for cloud)'}`);

    // Define the top 60 largest US cities for targeted job searches
    const topCities = [
        'New York NY', 'Los Angeles CA', 'Chicago IL', 'Houston TX', 'Phoenix AZ',
        'Philadelphia PA', 'San Antonio TX', 'San Diego CA', 'Dallas TX', 'San Jose CA',
        'Austin TX', 'Jacksonville FL', 'Fort Worth TX', 'Columbus OH', 'Indianapolis IN',
        'Charlotte NC', 'San Francisco CA', 'Seattle WA', 'Nashville TN', 'Denver CO',
        'Oklahoma City OK', 'El Paso TX', 'Boston MA', 'Portland OR', 'Las Vegas NV',
        'Detroit MI', 'Memphis TN', 'Louisville KY', 'Baltimore MD', 'Milwaukee WI',
        'Albuquerque NM', 'Tucson AZ', 'Fresno CA', 'Sacramento CA', 'Kansas City MO',
        'Mesa AZ', 'Atlanta GA', 'Omaha NE', 'Colorado Springs CO', 'Raleigh NC',
        'Long Beach CA', 'Virginia Beach VA', 'Miami FL', 'Oakland CA', 'Minneapolis MN',
        'Tulsa OK', 'Bakersfield CA', 'Wichita KS', 'Arlington TX', 'Aurora CO',
        'Tampa FL', 'New Orleans LA', 'Cleveland OH', 'Honolulu HI', 'Anaheim CA',
        'Lexington KY', 'Stockton CA', 'Corpus Christi TX', 'Henderson NV', 'Riverside CA'
    ];

    // Define job types for direct Indeed scraping
    const defaultJobTypes = [
        'restaurant manager',
        'executive chef',
        'sous chef',
        'kitchen manager',
        'culinary director',
        'food service manager',
        'private chef',
        'restaurant chef',
        'hotel executive chef',
        'hotel chef',
        'hotel executive'
    ];

    // Extract input parameters with defaults for Indeed scraping
    const {
        jobTypes = defaultJobTypes,
        location = 'United States',
        salaryMin = 55000,
        maxPages = 50, // Increased from 5 to get more comprehensive results
        saveToDataset = true,
        pushToDatabase: inputPushToDatabase = true,
        databaseUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('DATABASE_URL=', '') : '',
        databaseTable = 'rapidapi_jobs', // Updated to use new RapidAPI table
        deduplicateJobs = true,

        excludeFastFood = true,
        excludeRecruiters = true,
        testMode = false,
        useProxy = true,
        maxConcurrency = 2
    } = input;

    // Update the global isTestMode variable
    isTestMode = testMode;

    // Log environment configuration
    console.log('Environment Configuration:');
    console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`- Database URL: ${databaseUrl ? 'Set' : 'Not set'}`);
    console.log(`- Supabase URL: ${process.env.SUPABASE_URL ? 'Set' : 'Not set'}`);

    // Website data collection enabled (email enrichment handled by web viewer)
    const forceWebsiteData = true;

    // Force database integration to be enabled
    const forcePushToDatabase = true;

    // Number of jobs to process in test mode (only used when testMode is true)
    const testModeLimit = 5;

    console.log('Indeed Direct Scraper configuration:');
    console.log(`- Job Types: ${jobTypes.join(', ')}`);
    console.log(`- Location: ${location}`);
    console.log(`- Minimum Salary: $${salaryMin.toLocaleString()}`);
    console.log(`- Max pages per job type: ${maxPages}`);
    console.log(`- Max concurrency: ${maxConcurrency}`);
    console.log(`- Use proxy: ${useProxy}`);

    console.log(`- Exclude fast food: ${excludeFastFood}`);
    console.log(`- Exclude recruiters: ${excludeRecruiters}`);
    console.log(`- Include website data: ${forceWebsiteData} (URL collection enabled, email enrichment handled by web viewer)`);
    console.log(`- Save to dataset: ${saveToDataset}`);
    console.log(`- Push to database: ${forcePushToDatabase} (forced to true)`);
    console.log(`- Database table: ${databaseTable}`);
    console.log(`- Deduplicate jobs: ${deduplicateJobs}`);
    console.log(`- Test mode: ${testMode}${testMode ? ` (limit: ${testModeLimit} jobs per job type, email only to aj@chefsheet.com)` : ''}`);

    let totalJobsFound = 0;
    let totalJobsProcessed = 0;
    let totalJobsSaved = 0;

    // Set database connection environment variables
    if (databaseUrl) {
            console.log(`Using provided database URL: ${databaseUrl.substring(0, 20)}...`);

            // Ensure the URL has the correct format for query parameters
            if (databaseUrl.includes('&family=4') && !databaseUrl.includes('?family=4')) {
                databaseUrl = databaseUrl.replace('&family=4', '?family=4');
                console.log('Fixed database URL format for query parameters');
            }

            process.env.DATABASE_URL = databaseUrl;
        } else if (!process.env.DATABASE_URL) {
            // Use the new database user credentials
            const dbUser = 'google_scraper';
            const dbPassword = 'Relham12?';

            // Try different connection strings with direct IP addresses
            const connectionOptions = [
                // Option 1: Direct database with IP address using new user (IPv4 only)
                `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@34.102.106.226:5432/postgres?family=4`,

                // Option 2: AWS US West 1 pooler with IP address using new user (IPv4 only)
                `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@3.101.124.236:6543/postgres?family=4`,

                // Option 3: Original hostname with new user (as fallback)
                `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@db.mbaqiwhkngfxxmlkionj.supabase.co:5432/postgres?family=4`
            ];

            console.log('Available connection options:');
            connectionOptions.forEach((option, index) => {
                console.log(`- Option ${index + 1}: ${option.replace(/:[^:@]+@/, ':***@')}`);
            });

            // Use the first option by default
            console.log('No database URL provided. Using default DATABASE_URL with new user credentials.');
            process.env.DATABASE_URL = connectionOptions[0];
    } else {
        console.log('Using environment DATABASE_URL variable.');

        // Ensure the URL has the correct format for query parameters
        if (process.env.DATABASE_URL.includes('&family=4') && !process.env.DATABASE_URL.includes('?family=4')) {
            process.env.DATABASE_URL = process.env.DATABASE_URL.replace('&family=4', '?family=4');
            console.log('Fixed environment DATABASE_URL format for query parameters');
        }
    }

    // Fix the DATABASE_URL format if needed
    if (process.env.DATABASE_URL) {
        // First encode any special characters in the password
        const urlParts = process.env.DATABASE_URL.split('@');
        if (urlParts.length === 2) {
            const authParts = urlParts[0].split(':');
            if (authParts.length === 3) {
                const password = authParts[2];
                const encodedPassword = encodeURIComponent(password);
                process.env.DATABASE_URL = `${authParts[0]}:${authParts[1]}:${encodedPassword}@${urlParts[1]}`;
            }
        }

        // Fix query parameter format
        if (process.env.DATABASE_URL.includes('/postgres&')) {
            process.env.DATABASE_URL = process.env.DATABASE_URL.replace('/postgres&', '/postgres?');
        }
    }

    // Initialize the database connection
    const dbInitialized = await initDatabase(databaseTable);

    // If database connection fails, try the REST API approach
    if (!dbInitialized) {
        console.error('Direct database connection failed. Trying REST API approach...');
        console.log('Trying REST API approach...');

        // Here we would implement the REST API approach, but for now we'll just fail
        console.error('REST API approach not fully implemented. Cannot continue.');
        throw new Error('Database connection failed. Cannot continue without database access.');
    }

    // Fetch existing jobs from the database to avoid unnecessary API calls
    let existingJobs = new Map();

    try {
        console.log('Fetching existing jobs from the database to optimize API calls...');

        // Fix the DATABASE_URL format again just to be sure
        if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/postgres&')) {
            console.log('Fixing DATABASE_URL format again: replacing /postgres& with /postgres?');
            process.env.DATABASE_URL = process.env.DATABASE_URL.replace('/postgres&', '/postgres?');
        }

        // Use legacy database for all operations if RapidAPI module failed
        // This ensures we can still work with rapidapi_jobs table through legacy connection
        try {
            if (databaseTable === 'rapidapi_jobs' || databaseTable === 'rapidapi_contacts') {
                // Try RapidAPI module first, but fall back to legacy if it fails
                try {
                    existingJobs = await rapidApiFetchExistingJobs(databaseTable);
                } catch (rapidApiError) {
                    console.log(`⚠️  RapidAPI fetch failed, using legacy database for ${databaseTable}...`);
                    // Use legacy database but query the rapidapi_jobs table directly
                    existingJobs = await fetchExistingJobsFromTable(databaseTable);
                }
            } else {
                existingJobs = await fetchExistingJobs();
            }
        } catch (error) {
            console.log(`⚠️  Could not fetch existing jobs: ${error.message}`);
            existingJobs = new Map(); // Continue with empty map
        }
        console.log(`Fetched ${existingJobs.size} existing jobs from ${databaseTable} for optimization`);

        // If we can't fetch existing jobs, that's a critical error
        if (existingJobs.size === 0) {
            console.log('📋 No existing jobs found in database - this is normal for new tables like rapidapi_jobs');
            console.log('🆕 Starting fresh with empty database optimization');
        } else {
            console.log(`📊 Found ${existingJobs.size} existing jobs for duplicate checking`);
        }
    } catch (error) {
        console.error('⚠️  Error fetching existing jobs:', error.message);
        console.log('🔄 Continuing without existing job optimization (normal for new databases)');
        existingJobs = new Map(); // Initialize empty map to continue
    }

    // Direct Indeed scraping for job types
    let jobs = [];

    console.log(`🚀 Starting Indeed direct scraping for job types: ${jobTypes.join(', ')}`);
    console.log(`📍 Location: ${location}`);
    console.log(`💰 Minimum salary: $${salaryMin.toLocaleString()}`);
    console.log(`📄 Max pages per job type: ${maxPages}`);

    // Use Job Search API instead of web scraping
    console.log(`🎯 Starting Job Search API for multiple job boards`);

    // Import the API scraper function
    const { scrapeJobsWithAPI } = await import('./job_search_api.js');

    // Scrape jobs using the Job Search API (LinkedIn, Indeed, ZipRecruiter, Glassdoor)
    const scrapedJobs = await scrapeJobsWithAPI({
        jobTypes,
        location,
        salaryMin,
        testMode
    });

    console.log(`✅ Scraped ${scrapedJobs.length} jobs from Indeed`);

    // Filter out jobs that already exist in database
    const newJobs = [];
    let skippedExisting = 0;

    for (const job of scrapedJobs) {
        const jobKey = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
        if (existingJobs && existingJobs.has(jobKey)) {
            console.log(`Skipping existing job: "${job.title}" at "${job.company}" (already in database)`);
            skippedExisting++;
            continue;
        }
        newJobs.push(job);
    }

    console.log(`📊 Job filtering results: ${scrapedJobs.length} scraped, ${skippedExisting} already exist, ${newJobs.length} new jobs to process`);
    jobs = newJobs;

    if (jobs.length === 0) {
        console.log(`No new jobs found after filtering`);
        console.log(`Indeed Direct Scraper completed with no new jobs.`);
    } else {
        console.log(`📝 Processing ${jobs.length} new jobs from Indeed...`);
        totalJobsFound += jobs.length;

        // In test mode, only process a limited number of jobs
        const jobsToProcess = testMode ? jobs.slice(0, testModeLimit) : jobs;
        console.log(`Processing ${jobsToProcess.length} jobs${testMode ? ` (test mode - limit: ${testModeLimit})` : ''}`);

        // Log the jobs we're processing
        if (testMode) {
            console.log('Jobs being processed:');
            jobsToProcess.forEach((job, index) => {
                console.log(`Job #${index + 1}: "${job.title}" at "${job.company}" in "${job.location}"`);
            });
        }

            // Enhance jobs with company website URLs using SearchAPI
            console.log(`🔍 Enhancing ${jobsToProcess.length} jobs with company website URLs...`);
            const enhancedJobs = await enhanceJobsWithCompanyWebsites(jobsToProcess);

            console.log(`✅ Enhanced ${enhancedJobs.length} jobs with company data`);
            const processedJobs = enhancedJobs;

            // Track excluded jobs for email reporting
            const excludedJobs = jobsToProcess.filter(job => job._exclusionReason);
            jobStats.skippedExcludedJobs.push(...excludedJobs);

            // Track jobs that were skipped because they already exist in the database
            const existingDbJobs = jobsToProcess.filter(job => job._existsInDatabase);
            if (existingDbJobs.length > 0) {
                console.log(`Found ${existingDbJobs.length} jobs that already exist in the database`);
                jobStats.skippedDuplicateJobs.push(...existingDbJobs);
            }

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
            console.log(`\n=== Job Data from Indeed Direct Scraping ===`);
            console.log(`Found ${processedJobs.length} jobs after filtering and enhancement`);

            // Display a summary of each job
            processedJobs.forEach((job, index) => {
                console.log(`\nJob #${index + 1}:`);
                console.log(`Title: ${job.title}`);
                console.log(`Company: ${job.company_name}`);
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

            console.log(`\n=== End of Job Data from Indeed Direct Scraping ===`);

            // Database integration - always enabled
            if (forcePushToDatabase) {
                console.log(`💾 Pushing ${processedJobs.length} jobs to database...`);

                // Database connection should already be initialized
                if (dbInitialized) {
                    // Insert jobs into the database
                    console.log(`💾 Inserting ${processedJobs.length} jobs into database table: ${databaseTable}`);
                    const dbResult = await insertJobsIntoDatabase(processedJobs);
                    console.log(`✅ Successfully inserted/updated ${dbResult.insertedCount} jobs into the database (${databaseTable}).`);

                    // Update job statistics for email reporting
                    jobStats.newJobs.push(...dbResult.newJobs);
                    jobStats.skippedDuplicateJobs.push(...dbResult.updatedJobs);

                    console.log(`📊 Database results: ${dbResult.newJobs.length} new jobs, ${dbResult.updatedJobs.length} updated jobs`);
                } else {
                    console.error(`❌ Failed to initialize database connection. Please check your database credentials.`);
                    console.error(`Make sure to set DATABASE_URL or all SUPABASE_* environment variables in the Apify console.`);
                }
            }
        }

    console.log(`🎉 Indeed Direct Scraper completed successfully!`);
    console.log(`📊 Summary: Found ${totalJobsFound} jobs, processed ${totalJobsProcessed} jobs, saved ${totalJobsSaved} jobs.`);

} catch (error) {
    console.error(`Error in Indeed Direct Scraper: ${error.message}`);
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
        console.log(`- Test mode: ${isTestMode}`);
        console.log(`- Job stats: ${jobStats.processedCount} jobs processed, ${jobStats.newJobs.length} new, ${jobStats.skippedDuplicateJobs.length} duplicates, ${jobStats.skippedExcludedJobs.length} excluded`);

        // Pass the isTestMode parameter to the email function
        const emailSent = await sendCompletionEmail(jobStats, isTestMode);
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
