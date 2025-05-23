/**
 * Database integration for Google Jobs API Actor
 * Handles connections to Supabase PostgreSQL database and data insertion
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration - using Supabase direct connection
// The service role key should be set in the Apify environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://mbaqiwhkngfxxmlkionj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Build connection string - try multiple formats to increase chances of success
let connectionString;

// Extract the project reference from the URL
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Define alternative connection strings to try
const dbUser = 'google_scraper';
const dbPassword = 'Relham12';
const poolerIp = '52.8.172.168'; // Resolved IP for aws-0-us-west-1.pooler.supabase.com
const poolerPort = '6543';

// Define alternative connection strings to try
const alternativeConnections = [
    // Working connection string with pooler IP and project reference in username (first priority)
    `postgresql://${dbUser}.${projectRef}:${encodeURIComponent(dbPassword)}@${poolerIp}:${poolerPort}/postgres`,

    // Pooler with hostname instead of IP (second priority)
    `postgresql://${dbUser}.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-us-west-1.pooler.supabase.com:${poolerPort}/postgres`,

    // Direct database with IP address (third priority)
    `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@34.102.106.226:5432/postgres?family=4`,

    // Original hostname (fourth priority)
    `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres?family=4`
];

console.info('Available connection options:');
alternativeConnections.forEach((option, index) => {
    console.info(`- Option ${index + 1}: ${option.replace(/:[^:@]+@/, ':***@')}`);
});

if (process.env.DATABASE_URL) {
    // Use the provided DATABASE_URL if available
    connectionString = process.env.DATABASE_URL;
    console.info('Using provided DATABASE_URL environment variable');

    // Add ?family=4 to force IPv4 if not already present
    if (!connectionString.includes('family=4')) {
        connectionString += connectionString.includes('?') ? '&family=4' : '?family=4';
        console.info('Added family=4 parameter to force IPv4 connections');
    }

    // Add the current connection string to the list of alternatives
    if (!alternativeConnections.includes(connectionString)) {
        alternativeConnections.unshift(connectionString);
    }
} else if (supabaseKey) {
    // Try to construct a connection string using the service role key
    // Format: postgresql://postgres.[SERVICE_ROLE_KEY]@[HOST]:5432/postgres

    // Extract the project reference from the URL
    const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

    // Try different host formats with IPv4 forced
    const hosts = [
        `db.${projectRef}.supabase.co`,  // Direct connection with db prefix
        `${projectRef}.supabase.co`,     // Direct connection without db prefix
        'aws-0-us-west-1.pooler.supabase.com' // Connection pooling
    ];

    // Use the first host by default with family=4 to force IPv4
    connectionString = `postgresql://postgres.${supabaseKey}@${hosts[0]}:5432/postgres?family=4`;
    console.info(`Constructed connection string using service role key and host: ${hosts[0]} (IPv4 forced)`);

    // Add this connection string to the alternatives if not already there
    if (!alternativeConnections.includes(connectionString)) {
        alternativeConnections.unshift(connectionString);
    }
} else {
    // Fall back to individual connection parameters if available
    const supabaseUser = process.env.SUPABASE_USER;
    const supabasePassword = process.env.SUPABASE_PASSWORD;
    const supabaseHost = process.env.SUPABASE_HOST;
    const supabasePort = process.env.SUPABASE_PORT || '5432';
    const supabaseDatabase = process.env.SUPABASE_DATABASE || 'postgres';

    if (supabaseUser && supabasePassword && supabaseHost) {
        connectionString = `postgresql://${supabaseUser}:${encodeURIComponent(supabasePassword)}@${supabaseHost}:${supabasePort}/${supabaseDatabase}?family=4`;
        console.info('Constructed connection string using individual Supabase parameters (IPv4 forced)');

        // Add this connection string to the alternatives if not already there
        if (!alternativeConnections.includes(connectionString)) {
            alternativeConnections.unshift(connectionString);
        }
    } else {
        // Use the first alternative connection as default
        connectionString = alternativeConnections[0];
        console.info(`No database parameters available. Using first alternative connection: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
    }
}

let pool = null;

/**
 * Initializes the database connection pool
 * @returns {Promise<boolean>} - True if connection is successful
 */
async function initDatabase() {
    try {
        console.log('Trying imported database.js implementation...');

        // Get the database URL from environment
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        // Remove DATABASE_URL= prefix if present
        const cleanDbUrl = dbUrl.replace('DATABASE_URL=', '');

        console.log('Using Supabase configuration:');
        console.log(`- Connection string: ${cleanDbUrl.replace(/:[^:@]+@/, ':***@')}`);

        // Create the pool with explicit configuration
        pool = new Pool({
            user: 'google_scraper.mbaqiwhkngfxxmlkionj',
            password: 'Relham12',
            host: '52.8.172.168',
            port: 6543,
            database: 'postgres',
            ssl: {
                rejectUnauthorized: false
            },
            // Force IPv4
            family: 4
        });

        // Test the connection
        const client = await pool.connect();
        try {
            await client.query('SELECT NOW()');
            console.log('Successfully connected to database');
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Failed to connect to database:', error);
        if (error.code === 'ENOTFOUND') {
            console.error('Could not resolve hostname:', error.hostname);
            console.error('Please check your DATABASE_URL for typos in the hostname.');
        }
        console.error('Could not parse the connection string. It may be malformed.');
        return false;
    }
}

/**
 * Checks the actual schema of the existing tables
 */
async function checkExistingSchema() {
    try {
        // Check if the jobs table exists
        const jobsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs_google'
            );
        `);

        const jobsTableExists = jobsTableCheck.rows[0].exists;
        console.info(`Table culinary_jobs_google exists: ${jobsTableExists}`);

        if (jobsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs_google'
                ORDER BY ordinal_position;
            `);

            console.info('Columns in culinary_jobs_google:');
            columnInfo.rows.forEach(col => {
                console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        }

        // Check if the contacts table exists
        const contactsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'culinary_contacts_google'
            );
        `);

        const contactsTableExists = contactsTableCheck.rows[0].exists;
        console.info(`Table culinary_contacts_google exists: ${contactsTableExists}`);

        if (contactsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_contacts_google'
                ORDER BY ordinal_position;
            `);

            console.info('Columns in culinary_contacts_google:');
            columnInfo.rows.forEach(col => {
                console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        }

        // Check the original tables for reference
        const originalJobsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs'
            );
        `);

        const originalJobsTableExists = originalJobsTableCheck.rows[0].exists;
        console.info(`Table culinary_jobs exists: ${originalJobsTableExists}`);

        if (originalJobsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs'
                ORDER BY ordinal_position;
            `);

            console.info('Columns in culinary_jobs:');
            columnInfo.rows.forEach(col => {
                console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        }
    } catch (error) {
        console.error('Error checking schema:', error);
    }
}

/**
 * Creates indexes for performance optimization
 */
async function createIndexes() {
    const client = await pool.connect();
    try {
        // Create indexes for the jobs table
        // Drop the unique constraint on URL if it exists
        try {
            await client.query(`
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'unique_job_url' AND conrelid = 'culinary_jobs_google'::regclass
                    ) THEN
                        ALTER TABLE culinary_jobs_google DROP CONSTRAINT unique_job_url;
                    END IF;
                END $$;
            `);
            console.info('Checked and dropped unique_job_url constraint if it existed');
        } catch (error) {
            console.error('Error checking/dropping URL constraint:', error);
        }

        // Create indexes for the jobs table
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_google_company_name ON culinary_jobs_google(company);
            CREATE INDEX IF NOT EXISTS idx_google_job_title ON culinary_jobs_google(title);
            CREATE INDEX IF NOT EXISTS idx_google_date_added ON culinary_jobs_google(date_added);
            CREATE INDEX IF NOT EXISTS idx_google_domain ON culinary_jobs_google(domain);
            CREATE INDEX IF NOT EXISTS idx_google_parent_company ON culinary_jobs_google(parent_company);
        `);

        // Create indexes for the contacts table
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_google_contact_email ON culinary_contacts_google(email);
            CREATE INDEX IF NOT EXISTS idx_google_contact_job_id ON culinary_contacts_google(job_id);
            CREATE INDEX IF NOT EXISTS idx_google_contact_name ON culinary_contacts_google(name);
        `);

        console.info('Database indexes created successfully');
    } catch (error) {
        console.error('Error creating database indexes:', error);
        // Don't throw the error, just log it
    } finally {
        client.release();
    }
}

/**
 * Inserts job data into the database
 * @param {Array} jobs - Array of job objects to insert
 * @returns {Promise<number>} - Number of jobs successfully inserted
 */
async function insertJobsIntoDatabase(jobs) {
    if (!pool) {
        console.error('Database not initialized');
        return 0;
    }

    let insertedCount = 0;
    const maxRetries = 3;

    for (const job of jobs) {
        let retryCount = 0;
        let success = false;
        let client = null;

        while (retryCount < maxRetries && !success) {
            try {
                // Get a new client for each attempt
                client = await pool.connect();

                // Start a new transaction
                await client.query('BEGIN');
                console.info('Starting new transaction for job insertion');

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

                // If email is empty, add a unique identifier
                let finalContactEmail = contactEmail;
                if (!finalContactEmail) {
                    const uniqueId = `${job.title}_${job.location}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                    finalContactEmail = `no-email-${uniqueId}@placeholder.com`;
                    console.info(`Generated placeholder email for empty email: ${finalContactEmail}`);
                }

                // First check if the job already exists
                console.info(`Checking if job already exists: "${job.title}" at "${job.company}" in "${job.location}"`);
                const checkQuery = `
                    SELECT id FROM culinary_jobs_google
                    WHERE title = $1 AND company = $2 AND location = $3
                `;

                const checkResult = await client.query(checkQuery, [
                    job.title,
                    job.company,
                    job.location
                ]);

                let jobId;
                if (checkResult.rows.length > 0) {
                    // Update existing job
                    console.info(`Updating existing job with ID: ${checkResult.rows[0].id}`);
                    const updateQuery = `
                        UPDATE culinary_jobs_google
                        SET
                            title = $1,
                            company = $2,
                            parent_company = $3,
                            location = $4,
                            salary = $5,
                            contact_name = $6,
                            contact_title = $7,
                            email = $8,
                            url = $9,
                            job_details = $10,
                            linkedin = $11,
                            domain = $12,
                            company_size = $13,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE id = $14
                        RETURNING id
                    `;

                    const updateResult = await client.query(updateQuery, [
                        job.title,
                        job.company,
                        '', // parent_company
                        job.location,
                        salaryStr,
                        contactName,
                        contactTitle,
                        finalContactEmail,
                        job.apply_link,
                        job.description,
                        '', // linkedin
                        job.company_domain || '', // domain
                        '', // company_size
                        checkResult.rows[0].id
                    ]);
                    jobId = updateResult.rows[0].id;
                } else {
                    // Insert new job
                    const insertQuery = `
                        INSERT INTO culinary_jobs_google (
                            title, company, parent_company, location, salary,
                            contact_name, contact_title, email, url, job_details,
                            linkedin, domain, company_size, date_added, last_updated,
                            contacts_last_viewed, parent_url
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                        RETURNING id
                    `;

                    const insertResult = await client.query(insertQuery, [
                        job.title,
                        job.company,
                        '', // parent_company
                        job.location,
                        salaryStr,
                        contactName,
                        contactTitle,
                        finalContactEmail,
                        job.apply_link,
                        job.description,
                        '', // linkedin
                        job.company_domain || '', // domain
                        '', // company_size
                        now, // date_added
                        now, // last_updated
                        null, // contacts_last_viewed
                        '' // parent_url
                    ]);
                    jobId = insertResult.rows[0].id;
                }

                // Insert email contacts if available
                if (job.emails && job.emails.length > 0) {
                    for (const email of job.emails) {
                        const fullName = `${email.firstName || ''} ${email.lastName || ''}`.trim();
                        await client.query(`
                            INSERT INTO culinary_contacts_google (
                                job_id, name, title, email, date_added, last_updated
                            ) VALUES ($1, $2, $3, $4, $5, $6)
                            ON CONFLICT (job_id, email) DO UPDATE SET
                                name = EXCLUDED.name,
                                title = EXCLUDED.title,
                                last_updated = CURRENT_TIMESTAMP
                        `, [
                            jobId,
                            fullName,
                            email.position || '',
                            email.email,
                            now,
                            now
                        ]);
                    }
                }

                // If we got here, commit the transaction
                await client.query('COMMIT');
                console.info(`Successfully processed job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
                insertedCount++;
                success = true;
            } catch (error) {
                // Always rollback on error
                if (client) {
                    try {
                        await client.query('ROLLBACK');
                        console.info('Transaction rolled back due to error');
                    } catch (rollbackError) {
                        console.error('Error rolling back transaction:', rollbackError);
                    }
                }

                console.error(`Error processing job "${job.title}" at "${job.company}":`, error);
                retryCount++;

                if (retryCount < maxRetries) {
                    console.info(`Retrying job insertion (attempt ${retryCount + 1} of ${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
                } else {
                    console.error(`Failed to insert job after ${maxRetries} attempts`);
                }
            } finally {
                // Always release the client
                if (client) {
                    client.release();
                    client = null;
                }
            }
        }
    }

    console.info(`Database operations completed. Successfully inserted/updated ${insertedCount} jobs.`);
    return insertedCount;
}

/**
 * Fetches all existing job title + company combinations from the database
 * @returns {Promise<Map>} - Map of title+company combinations that already exist
 */
async function fetchExistingJobs() {
    // Fix the DATABASE_URL format if needed
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/postgres&')) {
        console.info('Fixing DATABASE_URL format in fetchExistingJobs: replacing /postgres& with /postgres?');
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace('/postgres&', '/postgres?');

        // Recreate the pool with the fixed URL if needed
        if (!pool) {
            console.info('Recreating database pool with fixed URL');
            try {
                // Use the fixed connection string
                const fixedConnectionString = process.env.DATABASE_URL;

                // Create a new pool with the fixed connection string
                pool = new Pool({
                    connectionString: fixedConnectionString,
                    ssl: {
                        rejectUnauthorized: false
                    },
                    // Force IPv4 to avoid connectivity issues
                    family: 4
                });

                // Test the connection
                await pool.query('SELECT 1');
                console.info('Successfully connected to database with fixed URL');
            } catch (error) {
                console.error('Failed to recreate pool with fixed URL:', error);
            }
        }
    }

    if (!pool) {
        console.error('Database not initialized');
        return new Map();
    }

    try {
        console.info('Fetching existing job title + company combinations from database...');

        const client = await pool.connect();
        try {
            const query = `
                SELECT title, company
                FROM culinary_jobs_google
            `;

            const result = await client.query(query);
            console.info(`Found ${result.rows.length} existing jobs in database`);

            // Create a Map for efficient lookups
            const existingJobs = new Map();

            for (const row of result.rows) {
                // Use title+company as the key
                const key = `${row.title.toLowerCase()}|${row.company.toLowerCase()}`;
                existingJobs.set(key, true);
            }

            console.info(`Created lookup map with ${existingJobs.size} entries`);
            return existingJobs;

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching existing jobs:', error);
        return new Map();
    }
}

export {
    initDatabase,
    insertJobsIntoDatabase,
    fetchExistingJobs
};
