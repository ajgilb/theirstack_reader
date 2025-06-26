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
        // Use the same connection logic as the working legacy database
        const connectionOptions = [
            'postgresql://google_scraper:***@34.102.106.226:5432/postgres?family=4',
            'postgresql://google_scraper:***@3.101.124.236:6543/postgres?family=4',
            'postgresql://google_scraper:***@db.mbaqiwhkngfxxmlkionj.supabase.co:5432/postgres?family=4'
        ];

        // Try to get from environment first
        let databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
            console.log('No DATABASE_URL provided. Using default connection options.');
            databaseUrl = connectionOptions[0]; // Use the first working option
        } else {
            // Fix common formatting issues
            if (databaseUrl.includes('/postgres&')) {
                console.log('Fixing DATABASE_URL format: replacing /postgres& with /postgres?');
                databaseUrl = databaseUrl.replace('/postgres&', '/postgres?');
            }

            // Add IPv4 family parameter if not present
            if (!databaseUrl.includes('family=4')) {
                const separator = databaseUrl.includes('?') ? '&' : '?';
                databaseUrl = `${databaseUrl}${separator}family=4`;
                console.log('Added family=4 parameter to force IPv4 connections');
            }
        }

        // Try to connect with shorter timeout
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const currentUrl = attempt === 0 ? databaseUrl : connectionOptions[attempt % connectionOptions.length];
                console.log(`🔄 Connection attempt ${attempt + 1} using: ${currentUrl.replace(/:[^:]*@/, ':***@')}`);

                // Create connection pool
                pool = new Pool({
                    connectionString: currentUrl,
                    ssl: {
                        rejectUnauthorized: false
                    },
                    max: 10,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 5000, // Shorter timeout
                });

                // Test the connection
                const client = await pool.connect();
                try {
                    const result = await client.query('SELECT NOW()');
                    console.log('✅ Successfully connected to RapidAPI database:', result.rows[0].now);
                    return true;
                } finally {
                    client.release();
                }
            } catch (attemptError) {
                console.log(`❌ Connection attempt ${attempt + 1} failed:`, attemptError.message);
                if (pool) {
                    await pool.end();
                    pool = null;
                }
            }
        }

        throw new Error('All connection attempts failed');
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

            // Check if job already exists
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
                        company_size, date_added, last_updated, parent_url
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    RETURNING id
                `;
                const insertResult = await client.query(insertQuery, [
                    job.title, job.company, job.parent_company || '', job.location,
                    salaryStr, contactName, contactTitle, email,
                    job.url || job.apply_link, job.job_details || job.description,
                    job.linkedin || '', job.domain || job.company_domain || '',
                    job.company_size || '', now, now, job.parent_url || ''
                ]);
                jobId = insertResult.rows[0].id;
                newJobs.push(job);
                console.log(`✅ Inserted job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
            }

            // Debug: Check if job has emails array
            if (job.emails) {
                console.log(`🔍 DEBUG: Job "${job.title}" at "${job.company}" has emails array with ${job.emails.length} contacts`);
                console.log(`📧 Sample emails:`, job.emails.slice(0, 3).map(e => ({
                    email: e.email,
                    name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
                    position: e.position || ''
                })));
            } else {
                console.log(`🔍 DEBUG: Job "${job.title}" at "${job.company}" has NO emails array`);
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
