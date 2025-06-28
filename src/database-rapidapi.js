/**
 * Database module for RapidAPI tables (rapidapi_jobs and rapidapi_contacts)
 * This module supports configurable table names instead of hardcoded ones
 */

import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

/**
 * Initialize database connection
 * @returns {Promise<boolean>} - True if successful
 */
async function initDatabase() {
    try {
        // Use the correct Supabase connection strings from the connection info
        const supabaseConnections = [
            // Transaction pooler (IPv4 compatible) - best for serverless
            'postgresql://postgres.mbaqiwhkngfxxmlkionj:Relham12%3F@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
            // Session pooler (IPv4 compatible) - alternative
            'postgresql://postgres.mbaqiwhkngfxxmlkionj:Relham12%3F@aws-0-us-west-1.pooler.supabase.com:5432/postgres',
            // Direct connection (IPv6) - fallback
            'postgresql://postgres:Relham12%3F@db.mbaqiwhkngfxxmlkionj.supabase.co:5432/postgres'
        ];

        // Force use of correct Supabase connection (ignore environment DATABASE_URL)
        console.log('🔧 Forcing Supabase transaction pooler connection for RapidAPI tables');
        let databaseUrl = supabaseConnections[0]; // Always use transaction pooler (best for serverless)

        console.log('🔧 Using Supabase connection:', databaseUrl.replace(/:[^:@]+@/, ':***@'));

        // Create connection pool with same settings as legacy database
        pool = new Pool({
            connectionString: databaseUrl,
            ssl: {
                rejectUnauthorized: false
            },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        // Test the connection
        const client = await pool.connect();
        try {
            const result = await client.query('SELECT NOW()');
            console.log('✅ Successfully connected to RapidAPI database:', result.rows[0].now);
        } finally {
            client.release();
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to connect to database:', error.message);
        return false;
    }
}

/**
 * Create tables if they don't exist
 * @param {string} jobsTable - Name of the jobs table (default: rapidapi_jobs)
 * @param {string} contactsTable - Name of the contacts table (default: rapidapi_contacts)
 */
async function createTablesIfNeeded(jobsTable = 'rapidapi_jobs', contactsTable = 'rapidapi_contacts') {
    if (!pool) {
        console.error('Database not initialized');
        return false;
    }

    const client = await pool.connect();
    try {
        console.log(`🔧 Creating tables if needed: ${jobsTable}, ${contactsTable}`);

        // Create jobs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${jobsTable} (
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
                
                CONSTRAINT unique_job_url_${jobsTable} UNIQUE (url)
            );
        `);

        // Create contacts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${contactsTable} (
                id SERIAL PRIMARY KEY,
                job_id INTEGER REFERENCES ${jobsTable}(id) ON DELETE CASCADE,
                name VARCHAR(255),
                title VARCHAR(255),
                email VARCHAR(255) NOT NULL,
                date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT unique_contact_email_${contactsTable} UNIQUE (job_id, email)
            );
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_${jobsTable}_company ON ${jobsTable}(company);
            CREATE INDEX IF NOT EXISTS idx_${jobsTable}_title ON ${jobsTable}(title);
            CREATE INDEX IF NOT EXISTS idx_${jobsTable}_date_added ON ${jobsTable}(date_added);
            CREATE INDEX IF NOT EXISTS idx_${jobsTable}_domain ON ${jobsTable}(domain);
        `);

        console.log(`✅ Tables created successfully: ${jobsTable}, ${contactsTable}`);
        return true;
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
        return false;
    } finally {
        client.release();
    }
}

/**
 * Fetch existing jobs from database for duplicate checking
 * @param {string} jobsTable - Name of the jobs table
 * @returns {Promise<Map>} - Map of existing job keys
 */
async function fetchExistingJobs(jobsTable = 'rapidapi_jobs') {
    if (!pool) {
        console.error('Database not initialized');
        return new Map();
    }

    try {
        console.log(`📋 Fetching existing jobs from ${jobsTable}...`);
        
        const client = await pool.connect();
        try {
            const query = `SELECT title, company FROM ${jobsTable}`;
            const result = await client.query(query);
            
            console.log(`📊 Found ${result.rows.length} existing jobs in ${jobsTable}`);

            // Create lookup map
            const existingJobs = new Map();
            for (const row of result.rows) {
                const key = `${row.title.toLowerCase()}|${row.company.toLowerCase()}`;
                existingJobs.set(key, true);
            }

            console.log(`🗂️  Created lookup map with ${existingJobs.size} entries`);
            return existingJobs;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`❌ Error fetching existing jobs from ${jobsTable}:`, error.message);
        return new Map();
    }
}

/**
 * Insert jobs into database
 * @param {Array} jobs - Array of job objects
 * @param {string} jobsTable - Name of the jobs table
 * @param {string} contactsTable - Name of the contacts table
 * @returns {Promise<Object>} - Result object with counts
 */
async function insertJobsIntoDatabase(jobs, jobsTable = 'rapidapi_jobs', contactsTable = 'rapidapi_contacts') {
    if (!pool) {
        console.error('Database not initialized');
        return { insertedCount: 0, newJobs: [], updatedJobs: [] };
    }

    let insertedCount = 0;
    const newJobs = [];
    const updatedJobs = [];

    console.log(`💾 Inserting ${jobs.length} jobs into ${jobsTable}...`);

    for (const job of jobs) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if job already exists (basic duplicate check)
            const checkQuery = `SELECT id FROM ${jobsTable} WHERE title = $1 AND company = $2`;
            const checkResult = await client.query(checkQuery, [job.title, job.company]);

            const now = new Date().toISOString();
            const salaryStr = job.salary || '';
            const contactName = job.contact_name || '';
            const contactTitle = job.contact_title || '';
            const email = job.email || '';

            let jobId;
            if (checkResult.rows.length > 0) {
                // Update existing job
                jobId = checkResult.rows[0].id;
                const updateQuery = `
                    UPDATE ${jobsTable} SET
                        location = $1, salary = $2, contact_name = $3, contact_title = $4,
                        email = $5, url = $6, job_details = $7, domain = $8, 
                        last_updated = $9, parent_url = $10
                    WHERE id = $11
                `;
                await client.query(updateQuery, [
                    job.location, salaryStr, contactName, contactTitle, email,
                    job.url || job.apply_link, job.job_details || job.description,
                    job.domain || job.company_domain, now, job.parent_url || '', jobId
                ]);
                updatedJobs.push(job);
                console.log(`🔄 Updated job: "${job.title}" at "${job.company}"`);
            } else {
                // Insert new job
                const insertQuery = `
                    INSERT INTO ${jobsTable} (
                        title, company, parent_company, location, salary, contact_name,
                        contact_title, email, url, job_details, linkedin, domain,
                        company_size, date_added, last_updated, parent_url, job_board_date_added
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    RETURNING id
                `;
                const insertResult = await client.query(insertQuery, [
                    job.title, job.company, job.parent_company || '', job.location,
                    salaryStr, contactName, contactTitle, email,
                    job.url || job.apply_link, job.job_details || job.description,
                    job.linkedin || '', job.domain || job.company_domain || '',
                    job.company_size || '', now, now, job.parent_url || '',
                    job.job_board_date_added || null
                ]);
                jobId = insertResult.rows[0].id;
                newJobs.push(job);
                console.log(`✅ Inserted job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
            }



            // Insert contacts if available
            if (job.emails && job.emails.length > 0) {
                for (const emailContact of job.emails) {
                    const fullName = `${emailContact.firstName || ''} ${emailContact.lastName || ''}`.trim();
                    await client.query(`
                        INSERT INTO ${contactsTable} (job_id, name, title, email, date_added, last_updated)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (job_id, email) DO UPDATE SET
                            name = EXCLUDED.name, title = EXCLUDED.title, last_updated = CURRENT_TIMESTAMP
                    `, [jobId, fullName, emailContact.position || '', emailContact.email, now, now]);
                }
                console.log(`📧 Inserted ${job.emails.length} contacts for job ID ${jobId}`);
            }

            await client.query('COMMIT');
            insertedCount++;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Error processing job "${job.title}" at "${job.company}":`, error.message);
        } finally {
            client.release();
        }
    }

    console.log(`✅ Database operations completed: ${insertedCount} jobs processed`);
    return { insertedCount, newJobs, updatedJobs };
}

export {
    initDatabase,
    createTablesIfNeeded,
    fetchExistingJobs,
    insertJobsIntoDatabase
};
