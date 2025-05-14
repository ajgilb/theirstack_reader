/**
 * Database integration for Google Jobs API Actor using Supabase client
 * Handles connections to Supabase and data insertion
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
let supabase = null;
let isInitialized = false;

/**
 * Initializes the Supabase client
 * @returns {Promise<boolean>} - True if connection is successful
 */
async function initDatabase() {
    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
        return false;
    }
    
    try {
        console.info('Initializing Supabase client...');
        console.info(`Using Supabase URL: ${supabaseUrl}`);
        
        // Create Supabase client
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        
        // Test the connection
        const { data, error } = await supabase
            .from('culinary_jobs_google')
            .select('*')
            .limit(1);
            
        if (error) {
            console.error('Failed to connect to Supabase:', error);
            return false;
        }
        
        console.info('Successfully connected to Supabase!');
        isInitialized = true;
        
        // Check if tables exist
        await checkTablesExist();
        
        return true;
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
        return false;
    }
}

/**
 * Checks if required tables exist
 */
async function checkTablesExist() {
    try {
        const tables = ['culinary_jobs_google', 'culinary_contacts_google'];
        
        console.info('Checking if required tables exist...');
        
        for (const table of tables) {
            const { error } = await supabase
                .from(table)
                .select('*')
                .limit(1);
                
            if (error) {
                console.warn(`Table '${table}' not found or error:`, error.message);
                
                // Create the table if it doesn't exist
                if (table === 'culinary_jobs_google') {
                    await createJobsTable();
                } else if (table === 'culinary_contacts_google') {
                    await createContactsTable();
                }
            } else {
                console.info(`Table '${table}' exists`);
            }
        }
    } catch (error) {
        console.error('Error checking tables:', error);
    }
}

/**
 * Creates the culinary_jobs_google table if it doesn't exist
 */
async function createJobsTable() {
    try {
        console.info('Creating culinary_jobs_google table...');
        
        // Use RPC to execute SQL
        const { error } = await supabase.rpc('execute_sql', {
            sql: `
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
                    parent_url VARCHAR(255)
                );
                
                CREATE INDEX IF NOT EXISTS idx_google_company_name ON culinary_jobs_google(company);
                CREATE INDEX IF NOT EXISTS idx_google_job_title ON culinary_jobs_google(title);
                CREATE INDEX IF NOT EXISTS idx_google_date_added ON culinary_jobs_google(date_added);
                CREATE INDEX IF NOT EXISTS idx_google_domain ON culinary_jobs_google(domain);
                CREATE INDEX IF NOT EXISTS idx_google_parent_company ON culinary_jobs_google(parent_company);
            `
        });
        
        if (error) {
            console.error('Error creating culinary_jobs_google table:', error);
        } else {
            console.info('Table culinary_jobs_google created successfully');
        }
    } catch (error) {
        console.error('Error creating jobs table:', error);
    }
}

/**
 * Creates the culinary_contacts_google table if it doesn't exist
 */
async function createContactsTable() {
    try {
        console.info('Creating culinary_contacts_google table...');
        
        // Use RPC to execute SQL
        const { error } = await supabase.rpc('execute_sql', {
            sql: `
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
            `
        });
        
        if (error) {
            console.error('Error creating culinary_contacts_google table:', error);
        } else {
            console.info('Table culinary_contacts_google created successfully');
        }
    } catch (error) {
        console.error('Error creating contacts table:', error);
    }
}

/**
 * Inserts job data into the database
 * @param {Array} jobs - Array of job objects to insert
 * @returns {Promise<number>} - Number of jobs successfully inserted
 */
async function insertJobsIntoDatabase(jobs) {
    if (!isInitialized || !supabase) {
        console.error('Database not initialized');
        return 0;
    }
    
    let insertedCount = 0;
    
    try {
        console.info(`Inserting ${jobs.length} jobs into the database...`);
        
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
                const { data: jobResult, error: jobError } = await supabase
                    .from('culinary_jobs_google')
                    .upsert([
                        {
                            title: job.title,
                            company: job.company,
                            parent_company: '', // Empty for now
                            location: job.location,
                            salary: salaryStr,
                            contact_name: contactName,
                            contact_title: contactTitle,
                            email: contactEmail,
                            url: job.apply_link,
                            job_details: job.description,
                            linkedin: '', // Empty for now
                            domain: job.company_domain || '',
                            company_size: '', // Empty for now
                            date_added: now,
                            last_updated: now,
                            contacts_last_viewed: null,
                            parent_url: '' // Empty for now
                        }
                    ], { 
                        onConflict: 'title,company',
                        returning: 'id' 
                    });
                
                if (jobError) {
                    console.error(`Error inserting job "${job.title}" at "${job.company}":`, jobError);
                    continue;
                }
                
                const jobId = jobResult[0].id;
                
                // Insert email contacts if available
                if (job.emails && job.emails.length > 0) {
                    for (const email of job.emails) {
                        try {
                            // Combine first and last name
                            const fullName = `${email.firstName || ''} ${email.lastName || ''}`.trim();
                            
                            await supabase
                                .from('culinary_contacts_google')
                                .upsert([
                                    {
                                        job_id: jobId,
                                        name: fullName,
                                        title: email.position || '',
                                        email: email.email,
                                        date_added: now,
                                        last_updated: now
                                    }
                                ], { 
                                    onConflict: 'job_id,email',
                                    returning: 'id' 
                                });
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
        
        console.info(`Successfully inserted ${insertedCount} jobs into the database.`);
        return insertedCount;
    } catch (error) {
        console.error('Error during database insertion:', error);
        return insertedCount;
    }
}

export {
    initDatabase,
    insertJobsIntoDatabase
};
