/**
 * Database module for interacting with Supabase PostgreSQL
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration
const supabaseHost = process.env.SUPABASE_HOST || 'aws-0-us-west-1.pooler.supabase.com';
const supabasePort = process.env.SUPABASE_PORT || '6543';
const supabaseDatabase = process.env.SUPABASE_DATABASE || 'postgres';
const supabaseUser = process.env.SUPABASE_USER || 'postgres.mbaqiwhkngfxxmlkionj';
const supabasePassword = process.env.SUPABASE_PASSWORD || 'Relham12?';

// Construct connection string
const connectionString = `postgresql://${supabaseUser}:${encodeURIComponent(supabasePassword)}@${supabaseHost}:${supabasePort}/${supabaseDatabase}`;

// Global connection pool
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
        await ensureTablesExist();
        
        return true;
    } catch (error) {
        console.error('Failed to connect to database:', error);
        return false;
    }
}

/**
 * Ensures that the necessary database tables exist
 */
async function ensureTablesExist() {
    const client = await pool.connect();
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
        
        if (!jobsTableExists) {
            console.info('Creating culinary_jobs_google table...');
            // Create the jobs table with the exact schema
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
                    
                    CONSTRAINT unique_job_url UNIQUE (url)
                );
            `);
            console.info('Table culinary_jobs_google created successfully');
            
            // Create indexes for the jobs table
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_google_company_name ON culinary_jobs_google(company);
                CREATE INDEX IF NOT EXISTS idx_google_job_title ON culinary_jobs_google(title);
                CREATE INDEX IF NOT EXISTS idx_google_date_added ON culinary_jobs_google(date_added);
                CREATE INDEX IF NOT EXISTS idx_google_domain ON culinary_jobs_google(domain);
                CREATE INDEX IF NOT EXISTS idx_google_parent_company ON culinary_jobs_google(parent_company);
            `);
        } else {
            // Log the actual schema of the jobs table
            const columnInfo = await client.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs_google'
                ORDER BY ordinal_position;
            `);
            
            console.info('Actual columns in culinary_jobs_google:');
            columnInfo.rows.forEach(col => {
                console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
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
        
        if (!contactsTableExists) {
            console.info('Creating culinary_contacts_google table...');
            // Create the contacts table with the exact schema
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
            
            // Create indexes for the contacts table
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_google_contact_email ON culinary_contacts_google(email);
                CREATE INDEX IF NOT EXISTS idx_google_contact_job_id ON culinary_contacts_google(job_id);
                CREATE INDEX IF NOT EXISTS idx_google_contact_name ON culinary_contacts_google(name);
            `);
        } else {
            // Log the actual schema of the contacts table
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
        }
    } catch (error) {
        console.error('Error ensuring tables exist:', error);
    } finally {
        client.release();
    }
}
