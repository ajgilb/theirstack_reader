#!/usr/bin/env node

/**
 * Script to upload Apify dataset JSON to Supabase database
 * Usage: node upload_to_supabase.js <path_to_json_file>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration - using the exact same credentials from your working DATABASE_URL
const DATABASE_CONFIG = {
    user: 'google_scraper.mbaqiwhkngfxxmlkionj',
    password: 'Relham12',
    host: '52.8.172.168',
    port: 6543,
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    },
    // Force IPv4 to avoid connectivity issues
    family: 4
};

/**
 * Create database connection pool
 */
function createPool() {
    return new Pool(DATABASE_CONFIG);
}

/**
 * Read and parse JSON file
 */
function readJsonFile(filePath) {
    try {
        console.log(`Reading file: ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        console.log(`Successfully parsed JSON file with ${data.length} records`);
        return data;
    } catch (error) {
        console.error('Error reading JSON file:', error.message);
        process.exit(1);
    }
}

/**
 * Transform job data to match database schema
 */
function transformJobData(job) {
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

    return {
        title: job.title || 'Unknown Title',
        company: job.company || 'Unknown Company',
        parent_company: null, // Not available in this data
        location: job.location || 'Unknown Location',
        salary: salaryStr || null,
        contact_name: null, // Will be filled from emails if available
        contact_title: null, // Will be filled from emails if available
        email: null, // Will be filled from emails if available
        url: job.apply_link || null,
        job_details: job.description || 'No description available',
        linkedin: null, // Not available in this data
        domain: job.company_domain || null,
        company_size: null, // Not available in this data
        date_added: now,
        last_updated: now,
        contacts_last_viewed: null,
        parent_url: job.company_website || null
    };
}

/**
 * Insert jobs into database
 */
async function insertJobs(pool, jobs) {
    let insertedJobsCount = 0;
    let insertedContactsCount = 0;
    let errorCount = 0;

    console.log('Starting database insertions (individual transactions)...');

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const transformedJob = transformJobData(job);

            console.log(`\nProcessing job ${i + 1}/${jobs.length}: "${transformedJob.title}" at "${transformedJob.company}"`);

            // Insert job into culinary_jobs_google table
            const jobInsertQuery = `
                INSERT INTO culinary_jobs_google (
                    title, company, parent_company, location, salary,
                    contact_name, contact_title, email, url, job_details,
                    linkedin, domain, company_size, date_added, last_updated,
                    contacts_last_viewed, parent_url
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17
                ) RETURNING id
            `;

            const jobValues = [
                transformedJob.title, transformedJob.company, transformedJob.parent_company,
                transformedJob.location, transformedJob.salary, transformedJob.contact_name,
                transformedJob.contact_title, transformedJob.email, transformedJob.url,
                transformedJob.job_details, transformedJob.linkedin, transformedJob.domain,
                transformedJob.company_size, transformedJob.date_added, transformedJob.last_updated,
                transformedJob.contacts_last_viewed, transformedJob.parent_url
            ];

            const jobResult = await client.query(jobInsertQuery, jobValues);
            const jobId = jobResult.rows[0].id;
            insertedJobsCount++;

            console.log(`✓ Inserted job: "${transformedJob.title}" at "${transformedJob.company}" (ID: ${jobId})`);

            // Insert contacts if emails are available
            if (job.emails && job.emails.length > 0) {
                for (const email of job.emails) {
                    try {
                        const contactInsertQuery = `
                            INSERT INTO culinary_contacts_google (
                                job_id, name, title, email, company, domain, date_added
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `;

                        const fullName = `${email.firstName || ''} ${email.lastName || ''}`.trim() || null;

                        const contactValues = [
                            jobId,
                            fullName,
                            email.position || null,
                            email.email,
                            transformedJob.company,
                            transformedJob.domain,
                            transformedJob.date_added
                        ];

                        await client.query(contactInsertQuery, contactValues);
                        insertedContactsCount++;

                        console.log(`  ✓ Added contact: ${email.email} (${fullName || 'No name'})`);
                    } catch (contactError) {
                        console.error(`  ✗ Error inserting contact ${email.email}:`, contactError.message);
                    }
                }
            }

            await client.query('COMMIT');

        } catch (jobError) {
            await client.query('ROLLBACK');
            errorCount++;
            console.error(`✗ Error inserting job "${job.title}" at "${job.company}":`, jobError.message);
            console.error(`  Full error:`, jobError);

            // Continue with next job instead of failing completely
        } finally {
            client.release();
        }
    }

    console.log('\n=== Database Operations Complete ===');
    console.log(`- Jobs processed: ${jobs.length}`);
    console.log(`- Jobs inserted: ${insertedJobsCount}`);
    console.log(`- Contacts inserted: ${insertedContactsCount}`);
    console.log(`- Errors: ${errorCount}`);

    return { jobs: insertedJobsCount, contacts: insertedContactsCount };
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: node upload_to_supabase.js <path_to_json_file>');
        console.error('Example: node upload_to_supabase.js /Users/ajgilbert2/Downloads/dataset_google-jobs-api-actor_2025-05-23_00-54-56-242.json');
        process.exit(1);
    }

    const jsonFilePath = args[0];

    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
        console.error(`File not found: ${jsonFilePath}`);
        process.exit(1);
    }

    console.log('=== Apify to Supabase Upload Script ===');
    console.log(`File: ${jsonFilePath}`);
    console.log(`Database: ${DATABASE_CONFIG.host}:${DATABASE_CONFIG.port}/${DATABASE_CONFIG.database}`);
    console.log(`User: ${DATABASE_CONFIG.user}`);
    console.log('');

    const pool = createPool();

    try {
        // Test database connection
        console.log('Testing database connection...');
        const testResult = await pool.query('SELECT NOW()');
        console.log(`Connected successfully at: ${testResult.rows[0].now}`);
        console.log('');

        // Read and parse JSON file
        const jobs = readJsonFile(jsonFilePath);

        if (jobs.length === 0) {
            console.log('No jobs found in the file.');
            return;
        }

        console.log(`Found ${jobs.length} jobs to upload`);
        console.log('');

        // Insert jobs into database
        const result = await insertJobs(pool, jobs);

        console.log('\n=== Upload Complete ===');
        console.log(`Successfully uploaded ${result.jobs} jobs and ${result.contacts} contacts to Supabase!`);

    } catch (error) {
        console.error('Upload failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the script
main().catch(console.error);
