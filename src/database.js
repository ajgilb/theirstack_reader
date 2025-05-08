/**
 * Database integration for Google Jobs API Actor
 * Handles connections to Supabase PostgreSQL database and data insertion
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration - using individual Supabase environment variables
const supabaseUser = process.env.SUPABASE_USER || 'postgres.mbaqiwhkngfxxmlkionj';
const supabasePassword = process.env.SUPABASE_PASSWORD || 'Relham12?';
const supabaseHost = process.env.SUPABASE_HOST || 'aws-0-us-west-1.pooler.supabase.com';
const supabasePort = process.env.SUPABASE_PORT || '6543';
const supabaseDatabase = process.env.SUPABASE_DATABASE || 'postgres';

// Build connection string from environment variables or use DATABASE_URL if provided
const connectionString = process.env.DATABASE_URL ||
    `postgresql://${supabaseUser}:${encodeURIComponent(supabasePassword)}@${supabaseHost}:${supabasePort}/${supabaseDatabase}`;

let pool = null;

/**
 * Initializes the database connection pool
 * @returns {Promise<boolean>} - True if connection is successful
 */
async function initDatabase() {
    if (!connectionString) {
        console.error('No database connection string available');
        return false;
    }

    try {
        // Log which environment variables are being used
        console.info('Using Supabase configuration:');
        console.info(`- Host: ${supabaseHost}`);
        console.info(`- Port: ${supabasePort}`);
        console.info(`- Database: ${supabaseDatabase}`);
        console.info(`- User: ${supabaseUser}`);
        // Don't log the password for security reasons

        // Initialize the connection pool
        pool = new Pool({
            connectionString,
            ssl: {
                rejectUnauthorized: false
            }
        });

        // Add error handler for the pool
        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });

        // Test the connection
        const result = await pool.query('SELECT NOW()');
        console.info('Successfully connected to Supabase PostgreSQL database:', result.rows[0].now);

        // Create indexes for performance
        await createIndexes();

        return true;
    } catch (error) {
        console.error('Failed to connect to database:', error);
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
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_google_company_name ON culinary_jobs_google(company);
            CREATE INDEX IF NOT EXISTS idx_google_job_title ON culinary_jobs_google(title);
            CREATE INDEX IF NOT EXISTS idx_google_date_added ON culinary_jobs_google(date_added);
        `);

        // Create indexes for the contacts table
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_google_contact_email ON culinary_contacts_google(email);
            CREATE INDEX IF NOT EXISTS idx_google_contact_job_id ON culinary_contacts_google(job_id);
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

    const client = await pool.connect();
    let insertedCount = 0;

    try {
        await client.query('BEGIN');
        console.info('Starting database transaction (BEGIN).');

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

                // Try to create the table if it doesn't exist
                try {
                    await client.query(`
                        CREATE TABLE IF NOT EXISTS culinary_jobs_google (
                            id SERIAL PRIMARY KEY,
                            title VARCHAR(255) NOT NULL,
                            company VARCHAR(255) NOT NULL,
                            location VARCHAR(255),
                            date_posted VARCHAR(255),
                            job_type VARCHAR(255),
                            description TEXT,
                            salary VARCHAR(255),
                            skills TEXT[],
                            experience_level VARCHAR(50),
                            url TEXT,
                            source VARCHAR(255),
                            scraped_at TIMESTAMP WITH TIME ZONE,
                            company_url TEXT,
                            date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

                            CONSTRAINT unique_job_url UNIQUE (url)
                        );
                    `);
                    console.info('Table culinary_jobs_google created or already exists');
                } catch (error) {
                    console.error('Error creating table:', error);
                }

                // Insert job data with the exact schema matching culinary_jobs
                const jobResult = await client.query(`
                    INSERT INTO culinary_jobs_google (
                        title, company, location, date_posted, job_type, description,
                        salary, skills, experience_level, url, source, scraped_at,
                        company_url, date_added, last_updated
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (url) DO UPDATE SET
                        title = EXCLUDED.title,
                        company = EXCLUDED.company,
                        location = EXCLUDED.location,
                        date_posted = EXCLUDED.date_posted,
                        job_type = EXCLUDED.job_type,
                        description = EXCLUDED.description,
                        salary = EXCLUDED.salary,
                        skills = EXCLUDED.skills,
                        experience_level = EXCLUDED.experience_level,
                        source = EXCLUDED.source,
                        scraped_at = EXCLUDED.scraped_at,
                        company_url = EXCLUDED.company_url,
                        last_updated = CURRENT_TIMESTAMP
                    RETURNING id
                `, [
                    job.title,
                    job.company,
                    job.location,
                    job.posted_at, // Map posted_at to date_posted
                    job.schedule, // Map schedule to job_type
                    job.description,
                    salaryStr, // Combined salary string
                    job.skills || [], // Ensure skills is an array
                    job.experience_level,
                    job.apply_link, // Map apply_link to url
                    job.source,
                    job.scraped_at || now,
                    job.company_domain || job.company_website, // Use domain or website as company_url
                    now, // date_added
                    now  // last_updated
                ]);

                const jobId = jobResult.rows[0].id;

                // Insert email contacts if available
                if (job.emails && job.emails.length > 0) {
                    // Try to create the contacts table if it doesn't exist
                    try {
                        await client.query(`
                            CREATE TABLE IF NOT EXISTS culinary_contacts_google (
                                id SERIAL PRIMARY KEY,
                                job_id INTEGER REFERENCES culinary_jobs_google(id) ON DELETE CASCADE,
                                email VARCHAR(255) NOT NULL,
                                first_name VARCHAR(255),
                                last_name VARCHAR(255),
                                position VARCHAR(255),
                                confidence INTEGER,
                                company VARCHAR(255),
                                company_url VARCHAR(255),
                                date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

                                CONSTRAINT unique_google_contact_email UNIQUE (job_id, email)
                            );
                        `);
                        console.info('Table culinary_contacts_google created or already exists');
                    } catch (error) {
                        console.error('Error creating contacts table:', error);
                    }

                    for (const email of job.emails) {
                        try {
                            await client.query(`
                                INSERT INTO culinary_contacts_google (
                                    job_id, email, first_name, last_name, position, confidence, company, company_url, date_added
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                ON CONFLICT (job_id, email) DO UPDATE SET
                                    first_name = EXCLUDED.first_name,
                                    last_name = EXCLUDED.last_name,
                                    position = EXCLUDED.position,
                                    confidence = EXCLUDED.confidence,
                                    company = EXCLUDED.company,
                                    company_url = EXCLUDED.company_url
                            `, [
                                jobId,
                                email.email,
                                email.firstName,
                                email.lastName,
                                email.position,
                                email.confidence,
                                job.company,
                                job.company_domain || job.company_website, // Use domain or website as company_url
                                now // date_added
                            ]);
                        } catch (error) {
                            console.error(`Error inserting contact ${email.email}:`, error);
                        }
                    }
                    console.info(`Inserted ${job.emails.length} email contacts for job ID ${jobId}`);
                }

                insertedCount++;
                console.info(`Inserted job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
            } catch (error) {
                // Log detailed error information
                console.error(`Error inserting job "${job.title}" at "${job.company}":`);
                console.error(`Error message: ${error.message}`);
                console.error(`Error code: ${error.code}`);
                console.error(`Error detail: ${error.detail}`);
                console.error(`Error hint: ${error.hint}`);
                console.error(`Error position: ${error.position}`);
                console.error(`Error table: ${error.table}`);
                console.error(`Error column: ${error.column}`);
                console.error(`Error constraint: ${error.constraint}`);
                console.error(`Full error:`, error);

                // If this is the first error in the transaction, roll back and return
                await client.query('ROLLBACK');
                console.error('Transaction rolled back due to error.');
                return 0;
            }
        }

        await client.query('COMMIT');
        console.info(`Database transaction committed. Inserted ${insertedCount} jobs.`);

        return insertedCount;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during database transaction, rolling back:', error);
        return 0;
    } finally {
        client.release();
        console.info('Released database client.');
    }
}

export {
    initDatabase,
    insertJobsIntoDatabase
};
