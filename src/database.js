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
const dbPassword = 'Relham12?';
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
    // Check if we have a connection string
    if (!connectionString) {
        console.error('No database connection string available');
        return false;
    }

    try {
        // Log connection information
        console.info('Using Supabase configuration:');
        console.info(`- Connection string: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
        // Don't log the password for security reasons

        // Log a sanitized version of the connection string for debugging
        if (process.env.DATABASE_URL) {
            const sanitizedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@');
            console.info(`Using DATABASE_URL: ${sanitizedUrl}`);
        }

        // Initialize the connection pool with explicit configuration to avoid IPv6 issues
        // Parse the connection string to extract components
        let dbConfig = {};

        if (connectionString) {
            try {
                // Parse the connection string
                const matches = connectionString.match(/postgresql:\/\/([^:]+)(?::([^@]+))?@([^:]+):(\d+)\/(.+)/);

                if (matches) {
                    const [, user, password, host, port, database] = matches;

                    // Log the parsed connection details (without password)
                    console.info('Parsed connection details:');
                    console.info(`- User: ${user}`);
                    console.info(`- Host: ${host}`);
                    console.info(`- Port: ${port}`);
                    console.info(`- Database: ${database}`);

                    // Create explicit configuration
                    dbConfig = {
                        user,
                        password,
                        host,
                        port: parseInt(port, 10),
                        database,
                        ssl: {
                            rejectUnauthorized: false
                        },
                        // Force IPv4 to avoid connectivity issues
                        family: 4
                    };
                } else {
                    console.warn('Could not parse connection string, falling back to direct usage');
                    dbConfig = {
                        connectionString,
                        ssl: {
                            rejectUnauthorized: false
                        },
                        // Force IPv4 to avoid connectivity issues
                        family: 4
                    };
                }
            } catch (parseError) {
                console.error('Error parsing connection string:', parseError);
                dbConfig = {
                    connectionString,
                    ssl: {
                        rejectUnauthorized: false
                    },
                    // Force IPv4 to avoid connectivity issues
                    family: 4
                };
            }
        }

        // Create the connection pool with our config
        pool = new Pool(dbConfig);

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

        // Provide more detailed error information for common connection issues
        if (error.code === 'ENOTFOUND') {
            console.error(`Could not resolve hostname: ${error.hostname}`);
            console.error('Please check your DATABASE_URL for typos in the hostname.');

            // Try to parse the connection string to identify issues
            try {
                const url = new URL(connectionString);
                console.error(`Attempted to connect to: ${url.hostname}`);

                // Check for common issues
                if (url.hostname.includes('supabase.co') && !url.hostname.startsWith('db.')) {
                    console.error('For direct database connections, the hostname should start with "db."');
                    console.error('Example: db.mbaqiwhkngfxxmlkionj.supabase.co');
                }

                if (url.hostname.includes('pooler') && !url.hostname.includes('aws-')) {
                    console.error('For pooled connections, the hostname should include the region.');
                    console.error('Example: aws-0-us-west-1.pooler.supabase.com');
                }
            } catch (parseError) {
                console.error('Could not parse the connection string. It may be malformed.');
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.error(`Connection refused at ${error.address}:${error.port}`);
            console.error('Please check if the port is correct and if the database server is accepting connections.');
        } else if (error.code === '28P01') {
            console.error('Authentication failed. Please check your username and password.');
        } else if (error.code === '3D000') {
            console.error('Database does not exist. Please check the database name in your connection string.');
        }

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
                    } else if (error.constraint === 'unique_job_url') {
                        // This is a URL constraint violation - the job already exists with this URL
                        console.warn(`URL constraint violation detected for job "${job.title}" at "${job.company}"`);
                        console.warn(`URL: ${job.apply_link}`);
                        console.warn(`Skipping this job and continuing with the next one...`);

                        // Skip this job and continue with the next one
                        continue;
                    } else {
                        // For other errors, log the error and continue with the next job
                        console.error('Error in job insertion, continuing with next job.');
                        continue;
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
                    } catch (error) {
                        console.error('Error creating or checking contacts table:', error);
                    }

                    try {
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
                        console.error('Error checking contacts table schema:', error);
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
