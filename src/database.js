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

    const client = await pool.connect();
    let insertedCount = 0;

    try {
        await client.query('BEGIN');
        console.info('Starting database transaction (BEGIN).');

        // Check and fix the foreign key constraint before inserting any data
        try {
            // Check if the jobs table exists
            const jobsTableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'culinary_jobs_google'
                );
            `);

            const jobsTableExists = jobsTableCheck.rows[0].exists;
            console.info(`Table culinary_jobs_google exists: ${jobsTableExists}`);

            if (jobsTableExists) {
                // Get schema details for debugging
                const columnInfo = await client.query(`
                    SELECT column_name, data_type, is_nullable, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'culinary_jobs_google'
                    ORDER BY ordinal_position;
                `);

                console.info('SCHEMA DETAILS - Actual columns in culinary_jobs_google:');
                columnInfo.rows.forEach(col => {
                    console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
                });

                // Get primary key
                const pkInfo = await client.query(`
                    SELECT a.attname
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE i.indrelid = 'culinary_jobs_google'::regclass
                    AND i.indisprimary;
                `);

                console.info('Primary key of culinary_jobs_google:');
                pkInfo.rows.forEach(pk => {
                    console.info(`- ${pk.attname}`);
                });

                // Get unique constraints
                const uniqueInfo = await client.query(`
                    SELECT con.conname
                    FROM pg_constraint con
                    JOIN pg_class rel ON rel.oid = con.conrelid
                    WHERE rel.relname = 'culinary_jobs_google'
                    AND con.contype = 'u';
                `);

                console.info('Unique constraints of culinary_jobs_google:');
                for (const constraint of uniqueInfo.rows) {
                    // Get the columns for this constraint
                    const constraintCols = await client.query(`
                        SELECT a.attname
                        FROM pg_constraint c
                        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                        WHERE c.conname = $1;
                    `, [constraint.conname]);

                    const columns = constraintCols.rows.map(row => row.attname).join(', ');
                    console.info(`- ${constraint.conname}: UNIQUE (${columns})`);
                }
            }

            // Check if the original table exists (for comparison)
            const originalTableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'culinary_jobs'
                );
            `);

            const originalTableExists = originalTableCheck.rows[0].exists;
            console.info(`Original table culinary_jobs exists: ${originalTableExists}`);

            if (originalTableExists) {
                // Get schema details for the original table
                const originalColumnInfo = await client.query(`
                    SELECT column_name, data_type, is_nullable, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    AND table_name = 'culinary_jobs'
                    ORDER BY ordinal_position;
                `);

                console.info('SCHEMA DETAILS - Columns in original culinary_jobs:');
                originalColumnInfo.rows.forEach(col => {
                    console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
                });
            }

            // Check if the contacts table exists
            const contactsTableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'culinary_contacts_google'
                );
            `);

            const contactsTableExists = contactsTableCheck.rows[0].exists;

            if (contactsTableExists) {
                // Check if the foreign key constraint is correct
                const constraintCheck = await client.query(`
                    SELECT ccu.table_name AS foreign_table_name
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_name = 'culinary_contacts_google'
                    AND tc.constraint_name = 'culinary_contacts_google_job_id_fkey';
                `);

                if (constraintCheck.rows.length > 0) {
                    const foreignTableName = constraintCheck.rows[0].foreign_table_name;
                    console.info(`Foreign key constraint references table: ${foreignTableName}`);

                    if (foreignTableName !== 'culinary_jobs_google') {
                        console.warn(`WARNING: Foreign key constraint references wrong table: ${foreignTableName}`);
                        console.warn('Attempting to fix the constraint automatically...');

                        try {
                            // Drop the existing constraint
                            await client.query(`
                                ALTER TABLE culinary_contacts_google
                                DROP CONSTRAINT culinary_contacts_google_job_id_fkey;
                            `);

                            // Add the correct constraint
                            await client.query(`
                                ALTER TABLE culinary_contacts_google
                                ADD CONSTRAINT culinary_contacts_google_job_id_fkey
                                FOREIGN KEY (job_id) REFERENCES culinary_jobs_google(id) ON DELETE CASCADE;
                            `);

                            console.info('Successfully fixed the foreign key constraint!');
                        } catch (error) {
                            console.error('Failed to fix the foreign key constraint:', error);
                            console.warn('Please update the constraint manually in the database.');
                        }
                    }
                } else {
                    console.warn('No foreign key constraint found on culinary_contacts_google.job_id');
                    console.warn('Attempting to add the constraint...');

                    try {
                        // Add the correct constraint
                        await client.query(`
                            ALTER TABLE culinary_contacts_google
                            ADD CONSTRAINT culinary_contacts_google_job_id_fkey
                            FOREIGN KEY (job_id) REFERENCES culinary_jobs_google(id) ON DELETE CASCADE;
                        `);

                        console.info('Successfully added the foreign key constraint!');
                    } catch (error) {
                        console.error('Failed to add the foreign key constraint:', error);
                        console.warn('Please add the constraint manually in the database.');
                    }
                }
            }
        } catch (error) {
            console.error('Error checking database schema:', error);
        }

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

                // Get detailed information about the existing schema before trying to insert
                try {
                    // First check if the table exists
                    const tableCheck = await client.query(`
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = 'culinary_jobs_google'
                        );
                    `);

                    const tableExists = tableCheck.rows[0].exists;
                    console.info(`Table culinary_jobs_google exists: ${tableExists}`);

                    if (tableExists) {
                        // Get the column information
                        const columnInfo = await client.query(`
                            SELECT column_name, data_type, character_maximum_length, is_nullable
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                            AND table_name = 'culinary_jobs_google'
                            ORDER BY ordinal_position;
                        `);

                        console.info('SCHEMA DETAILS - Actual columns in culinary_jobs_google:');
                        columnInfo.rows.forEach(col => {
                            console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
                        });

                        // Get primary key
                        const pkInfo = await client.query(`
                            SELECT a.attname
                            FROM pg_index i
                            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                            WHERE i.indrelid = 'culinary_jobs_google'::regclass
                            AND i.indisprimary;
                        `);

                        console.info('Primary key of culinary_jobs_google:');
                        pkInfo.rows.forEach(pk => {
                            console.info(`- ${pk.attname}`);
                        });

                        // Get unique constraints
                        const uniqueInfo = await client.query(`
                            SELECT con.conname, pg_get_constraintdef(con.oid)
                            FROM pg_constraint con
                            JOIN pg_class rel ON rel.oid = con.conrelid
                            WHERE rel.relname = 'culinary_jobs_google'
                            AND con.contype = 'u';
                        `);

                        console.info('Unique constraints of culinary_jobs_google:');
                        uniqueInfo.rows.forEach(unique => {
                            console.info(`- ${unique.conname}: ${unique.pg_get_constraintdef}`);
                        });

                        // Also check the original table for reference
                        const originalTableCheck = await client.query(`
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables
                                WHERE table_schema = 'public'
                                AND table_name = 'culinary_jobs'
                            );
                        `);

                        const originalTableExists = originalTableCheck.rows[0].exists;
                        console.info(`Original table culinary_jobs exists: ${originalTableExists}`);

                        if (originalTableExists) {
                            // Get the column information
                            const originalColumnInfo = await client.query(`
                                SELECT column_name, data_type, character_maximum_length, is_nullable
                                FROM information_schema.columns
                                WHERE table_schema = 'public'
                                AND table_name = 'culinary_jobs'
                                ORDER BY ordinal_position;
                            `);

                            console.info('SCHEMA DETAILS - Columns in original culinary_jobs:');
                            originalColumnInfo.rows.forEach(col => {
                                console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
                            });
                        }
                    } else {
                        // Create the table with the exact schema
                        console.info('Table culinary_jobs_google does not exist, creating it...');
                        await client.query(`
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
                                parent_url TEXT,

                                CONSTRAINT unique_job_url UNIQUE (url),
                                CONSTRAINT culinary_jobs_google_email_company_key UNIQUE (email, company)
                            );
                        `);
                        console.info('Table culinary_jobs_google created successfully');
                    }
                } catch (error) {
                    console.error('Error checking or creating table:', error);
                }

                // Extract contact info if available
                const contactName = job.emails && job.emails.length > 0 ?
                    `${job.emails[0].firstName || ''} ${job.emails[0].lastName || ''}`.trim() : '';
                const contactTitle = job.emails && job.emails.length > 0 ? job.emails[0].position || '' : '';

                // For the email, add a unique identifier if it's empty to avoid unique constraint violations
                let contactEmail = '';
                if (job.emails && job.emails.length > 0) {
                    contactEmail = job.emails[0].email || '';
                }

                // If email is empty, add a unique identifier based on the job title and location
                // This helps avoid the unique constraint violation on (email, company)
                if (!contactEmail) {
                    // Create a unique identifier by combining title and location
                    const uniqueId = `${job.title}_${job.location}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                    contactEmail = `no-email-${uniqueId}@placeholder.com`;
                    console.info(`Generated placeholder email for empty email: ${contactEmail}`);
                }

                // Log the data we're about to insert
                console.info('INSERTION DATA - Preparing to insert job with the following data:');
                const jobData = {
                    title: job.title,
                    company: job.company,
                    parent_company: '',
                    location: job.location,
                    salary: salaryStr,
                    contact_name: contactName,
                    contact_title: contactTitle,
                    email: contactEmail,
                    url: job.apply_link,
                    job_details: job.description ? job.description.substring(0, 50) + '...' : '',
                    linkedin: '',
                    domain: job.company_domain || '',
                    company_size: '',
                    date_added: now,
                    last_updated: now,
                    contacts_last_viewed: null,
                    parent_url: ''
                };

                // Log each field
                Object.entries(jobData).forEach(([key, value]) => {
                    console.info(`- ${key}: ${value === null ? 'NULL' : value}`);
                });

                // Insert job data with the exact schema matching the actual database
                console.info('EXECUTING SQL - Inserting job into culinary_jobs_google table');
                let jobResult;
                try {
                    // First check if the job already exists based on title, company, and location
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

                    console.info(`Found ${checkResult.rows.length} existing jobs with matching title, company, and location`);

                    if (checkResult.rows.length > 0) {
                        console.info(`Job already exists in database: "${job.title}" at "${job.company}" in "${job.location}"`);
                        console.info(`Updating existing job with ID: ${checkResult.rows[0].id}`);

                        // Update the existing job
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

                        jobResult = await client.query(updateQuery, [
                            job.title,
                            job.company,
                            '', // parent_company (empty for now)
                            job.location,
                            salaryStr, // Combined salary string
                            contactName, // contact_name from first email
                            contactTitle, // contact_title from first email
                            contactEmail, // email from first email
                            job.apply_link, // url
                            job.description, // job_details
                            '', // linkedin (empty for now)
                            job.company_domain || '', // domain
                            '', // company_size (empty for now)
                            checkResult.rows[0].id // id of the existing job
                        ]);
                    } else {
                        // Insert a new job
                        const insertQuery = `
                            INSERT INTO culinary_jobs_google (
                                title, company, parent_company, location, salary,
                                contact_name, contact_title, email, url, job_details,
                                linkedin, domain, company_size, date_added, last_updated,
                                contacts_last_viewed, parent_url
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                            ON CONFLICT (url) DO UPDATE SET
                                title = EXCLUDED.title,
                                company = EXCLUDED.company,
                                parent_company = EXCLUDED.parent_company,
                                location = EXCLUDED.location,
                                salary = EXCLUDED.salary,
                                contact_name = EXCLUDED.contact_name,
                                contact_title = EXCLUDED.contact_title,
                                email = EXCLUDED.email,
                                job_details = EXCLUDED.job_details,
                                linkedin = EXCLUDED.linkedin,
                                domain = EXCLUDED.domain,
                                company_size = EXCLUDED.company_size,
                                last_updated = CURRENT_TIMESTAMP
                            RETURNING id
                        `;

                        console.info('SQL QUERY:', insertQuery);

                        jobResult = await client.query(insertQuery, [
                        job.title,
                        job.company,
                        '', // parent_company (empty for now)
                        job.location,
                        salaryStr, // Combined salary string
                        contactName, // contact_name from first email
                        contactTitle, // contact_title from first email
                        contactEmail, // email from first email
                        job.apply_link, // url
                        job.description, // job_details
                        '', // linkedin (empty for now)
                        job.company_domain || '', // domain
                        '', // company_size (empty for now)
                        now, // date_added
                        now, // last_updated
                        null, // contacts_last_viewed
                        '' // parent_url (empty for now)
                    ]);
                    }
                } catch (error) {
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

                    // Check if this is a unique constraint violation on email and company
                    if (error.constraint === 'culinary_jobs_google_email_company_key') {
                        console.warn(`Unique constraint violation detected. Trying again with a truly unique email...`);

                        try {
                            // Generate a truly unique email by adding a timestamp
                            const timestamp = new Date().getTime();
                            const uniqueId = `${job.title}_${timestamp}`.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                            const uniqueEmail = `no-email-${uniqueId}@placeholder.com`;
                            console.info(`Generated unique placeholder email: ${uniqueEmail}`);

                            // Try inserting again with the unique email
                            const retryQuery = `
                                INSERT INTO culinary_jobs_google (
                                    title, company, parent_company, location, salary,
                                    contact_name, contact_title, email, url, job_details,
                                    linkedin, domain, company_size, date_added, last_updated,
                                    contacts_last_viewed, parent_url
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                                ON CONFLICT (url) DO UPDATE SET
                                    title = EXCLUDED.title,
                                    company = EXCLUDED.company,
                                    parent_company = EXCLUDED.parent_company,
                                    location = EXCLUDED.location,
                                    salary = EXCLUDED.salary,
                                    contact_name = EXCLUDED.contact_name,
                                    contact_title = EXCLUDED.contact_title,
                                    email = EXCLUDED.email,
                                    job_details = EXCLUDED.job_details,
                                    linkedin = EXCLUDED.linkedin,
                                    domain = EXCLUDED.domain,
                                    company_size = EXCLUDED.company_size,
                                    last_updated = CURRENT_TIMESTAMP
                                RETURNING id
                            `;

                            jobResult = await client.query(retryQuery, [
                                job.title,
                                job.company,
                                '', // parent_company (empty for now)
                                job.location,
                                salaryStr, // Combined salary string
                                contactName, // contact_name from first email
                                contactTitle, // contact_title from first email
                                uniqueEmail, // Use the unique email
                                job.apply_link, // url
                                job.description, // job_details
                                '', // linkedin (empty for now)
                                job.company_domain || '', // domain
                                '', // company_size (empty for now)
                                now, // date_added
                                now, // last_updated
                                null, // contacts_last_viewed
                                '' // parent_url (empty for now)
                            ]);

                            console.info(`Successfully inserted job with unique email after constraint violation`);
                        } catch (retryError) {
                            console.error(`Failed to insert job even with unique email:`, retryError);
                            // Continue with the next job instead of rolling back
                            continue;
                        }
                    } else {
                        // For other errors, roll back the transaction and return
                        await client.query('ROLLBACK');
                        console.error('Transaction rolled back due to error in job insertion.');
                        return 0;
                    }
                }

                const jobId = jobResult.rows[0].id;

                // Insert email contacts if available
                if (job.emails && job.emails.length > 0) {
                    // Try to create the contacts table if it doesn't exist with the EXACT schema from the database
                    try {
                        // Check if the contacts table exists
                        const contactsTableCheck = await client.query(`
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables
                                WHERE table_schema = 'public'
                                AND table_name = 'culinary_contacts_google'
                            );
                        `);

                        const contactsTableExists = contactsTableCheck.rows[0].exists;

                        if (!contactsTableExists) {
                            // Create the contacts table with the correct foreign key reference
                            await client.query(`
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
                            `);
                            console.info('Table culinary_contacts_google created successfully');
                        } else {
                            // Check if the foreign key constraint is correct
                            const constraintCheck = await client.query(`
                                SELECT ccu.table_name AS foreign_table_name
                                FROM information_schema.table_constraints AS tc
                                JOIN information_schema.constraint_column_usage AS ccu
                                ON ccu.constraint_name = tc.constraint_name
                                WHERE tc.constraint_type = 'FOREIGN KEY'
                                AND tc.table_name = 'culinary_contacts_google'
                                AND tc.constraint_name = 'culinary_contacts_google_job_id_fkey';
                            `);

                            if (constraintCheck.rows.length > 0) {
                                const foreignTableName = constraintCheck.rows[0].foreign_table_name;
                                console.info(`Foreign key constraint references table: ${foreignTableName}`);

                                if (foreignTableName !== 'culinary_jobs_google') {
                                    console.warn(`WARNING: Foreign key constraint references wrong table: ${foreignTableName}`);
                                    console.warn('Attempting to fix the constraint automatically...');

                                    try {
                                        // Drop the existing constraint
                                        await client.query(`
                                            ALTER TABLE culinary_contacts_google
                                            DROP CONSTRAINT culinary_contacts_google_job_id_fkey;
                                        `);

                                        // Add the correct constraint
                                        await client.query(`
                                            ALTER TABLE culinary_contacts_google
                                            ADD CONSTRAINT culinary_contacts_google_job_id_fkey
                                            FOREIGN KEY (job_id) REFERENCES culinary_jobs_google(id) ON DELETE CASCADE;
                                        `);

                                        console.info('Successfully fixed the foreign key constraint!');
                                    } catch (error) {
                                        console.error('Failed to fix the foreign key constraint:', error);
                                        console.warn('Please update the constraint manually in the database.');
                                    }
                                }
                            }
                        }
                    } else {
                        // Check the actual schema of the table
                        const columnInfo = await client.query(`
                            SELECT column_name, data_type, character_maximum_length
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                            AND table_name = 'culinary_contacts_google'
                            ORDER BY ordinal_position;
                        `);

                        console.info('Actual columns in culinary_contacts_google:');
                        columnInfo.rows.forEach(col => {
                            console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
                        });
                    } catch (error) {
                        console.error('Error creating or checking contacts table:', error);
                    }

                    for (const email of job.emails) {
                        try {
                            // Combine first and last name
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
                                fullName, // name (combined first and last name)
                                email.position || '', // title
                                email.email, // email
                                now, // date_added
                                now  // last_updated
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
