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

// Store table schemas once retrieved
let jobsTableColumns = null;
let contactsTableColumns = null;

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
        
        // Get the actual schema of the tables
        await getTableSchemas();
        
        return true;
    } catch (error) {
        console.error('Failed to connect to database:', error);
        return false;
    }
}

/**
 * Gets the actual schema of the tables from the database
 */
async function getTableSchemas() {
    const client = await pool.connect();
    try {
        // Check if the jobs table exists and get its schema
        const jobsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_jobs_google'
            );
        `);
        
        const jobsTableExists = jobsTableCheck.rows[0].exists;
        
        if (jobsTableExists) {
            // Get the column information
            const columnInfo = await client.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs_google'
                ORDER BY ordinal_position;
            `);
            
            console.info('Actual columns in culinary_jobs_google:');
            jobsTableColumns = columnInfo.rows.map(col => col.column_name);
            columnInfo.rows.forEach(col => {
                console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        } else {
            console.info('Table culinary_jobs_google does not exist, will create it');
        }
        
        // Check if the contacts table exists and get its schema
        const contactsTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_contacts_google'
            );
        `);
        
        const contactsTableExists = contactsTableCheck.rows[0].exists;
        
        if (contactsTableExists) {
            // Get the column information
            const columnInfo = await client.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_contacts_google'
                ORDER BY ordinal_position;
            `);
            
            console.info('Actual columns in culinary_contacts_google:');
            contactsTableColumns = columnInfo.rows.map(col => col.column_name);
            columnInfo.rows.forEach(col => {
                console.info(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        } else {
            console.info('Table culinary_contacts_google does not exist, will create it');
        }
    } catch (error) {
        console.error('Error getting table schemas:', error);
    } finally {
        client.release();
    }
}

/**
 * Creates the necessary database tables if they don't exist
 */
async function createTablesIfNeeded() {
    const client = await pool.connect();
    try {
        // Create the jobs table if it doesn't exist
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
        
        // Create the contacts table if it doesn't exist
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
        
        // Create indexes for performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_google_company_name ON culinary_jobs_google(company);
            CREATE INDEX IF NOT EXISTS idx_google_job_title ON culinary_jobs_google(title);
            CREATE INDEX IF NOT EXISTS idx_google_date_added ON culinary_jobs_google(date_added);
            CREATE INDEX IF NOT EXISTS idx_google_domain ON culinary_jobs_google(domain);
            CREATE INDEX IF NOT EXISTS idx_google_parent_company ON culinary_jobs_google(parent_company);
            
            CREATE INDEX IF NOT EXISTS idx_google_contact_email ON culinary_contacts_google(email);
            CREATE INDEX IF NOT EXISTS idx_google_contact_job_id ON culinary_contacts_google(job_id);
            CREATE INDEX IF NOT EXISTS idx_google_contact_name ON culinary_contacts_google(name);
        `);
        
        console.info('Tables and indexes created successfully');
        
        // Refresh the schema information
        await getTableSchemas();
    } catch (error) {
        console.error('Error creating tables:', error);
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
    
    // Make sure tables exist and we have schema information
    if (!jobsTableColumns || !contactsTableColumns) {
        await createTablesIfNeeded();
    }

    let insertedCount = 0;

    // Process each job in a separate transaction
    for (const job of jobs) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
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
            
            // Extract contact info if available
            const contactName = job.emails && job.emails.length > 0 ?
                `${job.emails[0].firstName || ''} ${job.emails[0].lastName || ''}`.trim() : '';
            const contactTitle = job.emails && job.emails.length > 0 ? job.emails[0].position || '' : '';
            const contactEmail = job.emails && job.emails.length > 0 ? job.emails[0].email || '' : '';
            
            // Prepare job data
            const jobData = {
                title: job.title || '',
                company: job.company || '',
                parent_company: '',
                location: job.location || '',
                salary: salaryStr,
                contact_name: contactName,
                contact_title: contactTitle,
                email: contactEmail,
                url: job.apply_link || '',
                job_details: job.description || '',
                linkedin: '',
                domain: job.company_domain || '',
                company_size: '',
                date_added: now,
                last_updated: now,
                contacts_last_viewed: null,
                parent_url: ''
            };
            
            // Build the INSERT query dynamically based on the actual table schema
            const columns = Object.keys(jobData).filter(col => jobsTableColumns.includes(col));
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => jobData[col]);
            
            const updateColumns = columns
                .filter(col => col !== 'date_added') // Don't update date_added
                .map(col => `${col} = EXCLUDED.${col}`)
                .join(', ');
            
            console.info(`Inserting job: "${job.title}" at "${job.company}"`);
            
            const query = `
                INSERT INTO culinary_jobs_google (${columns.join(', ')})
                VALUES (${placeholders})
                ON CONFLICT (url) DO UPDATE SET
                    ${updateColumns},
                    last_updated = CURRENT_TIMESTAMP
                RETURNING id
            `;
            
            const jobResult = await client.query(query, values);
            const jobId = jobResult.rows[0].id;
            
            console.info(`Job inserted successfully with ID: ${jobId}`);
            
            // Insert email contacts if available
            if (job.emails && job.emails.length > 0) {
                let contactsInserted = 0;
                
                for (const email of job.emails) {
                    try {
                        // Combine first and last name
                        const fullName = `${email.firstName || ''} ${email.lastName || ''}`.trim();
                        
                        // Prepare contact data
                        const contactData = {
                            job_id: jobId,
                            name: fullName,
                            title: email.position || '',
                            email: email.email || '',
                            date_added: now,
                            last_updated: now
                        };
                        
                        // Build the INSERT query dynamically based on the actual table schema
                        const contactColumns = Object.keys(contactData).filter(col => contactsTableColumns.includes(col));
                        const contactPlaceholders = contactColumns.map((_, i) => `$${i + 1}`).join(', ');
                        const contactValues = contactColumns.map(col => contactData[col]);
                        
                        const contactUpdateColumns = contactColumns
                            .filter(col => col !== 'date_added' && col !== 'job_id' && col !== 'email') // Don't update these
                            .map(col => `${col} = EXCLUDED.${col}`)
                            .join(', ');
                        
                        const contactQuery = `
                            INSERT INTO culinary_contacts_google (${contactColumns.join(', ')})
                            VALUES (${contactPlaceholders})
                            ON CONFLICT (job_id, email) DO UPDATE SET
                                ${contactUpdateColumns},
                                last_updated = CURRENT_TIMESTAMP
                        `;
                        
                        await client.query(contactQuery, contactValues);
                        contactsInserted++;
                    } catch (error) {
                        console.error(`Error inserting contact ${email.email}:`, error);
                        // Continue with the next contact
                    }
                }
                
                console.info(`Inserted ${contactsInserted} email contacts for job ID ${jobId}`);
            }
            
            await client.query('COMMIT');
            insertedCount++;
            console.info(`Transaction committed for job: "${job.title}" at "${job.company}"`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Error processing job "${job.title}" at "${job.company}":`, error);
        } finally {
            client.release();
        }
    }
    
    console.info(`Finished database insertion. Inserted ${insertedCount} jobs.`);
    return insertedCount;
}

export {
    initDatabase,
    insertJobsIntoDatabase
};
