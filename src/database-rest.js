/**
 * Database integration using HTTP requests to Supabase REST API
 * This approach avoids direct PostgreSQL connections which might be blocked
 */

import https from 'https';

// Supabase project details
const SUPABASE_URL = 'https://mbaqiwhkngfxxmlkionj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYXFpd2hrbmdmeHhtbGtpb25qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDE0MzUzMiwiZXhwIjoyMDU5NzE5NTMyfQ.7fdYmDgf_Ik1xtABnNje5peczWjoFKhvrvokPRFknzE';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_URL.replace('https://', ''),
            path: `/rest/v1${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=representation'
            }
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
        }

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsedData = responseData ? JSON.parse(responseData) : {};
                        resolve(parsedData);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                } else {
                    reject(new Error(`Request failed with status code ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Initializes the database connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
async function initDatabase() {
    try {
        console.log('Testing Supabase REST API connection...');

        // Test the connection by making a simple request
        const result = await makeRequest('GET', '/culinary_jobs_google?select=count&limit=1');

        console.log('Successfully connected to Supabase REST API!');
        console.log('Response:', result);

        return true;
    } catch (error) {
        console.error('Failed to connect to Supabase REST API:', error.message);

        // Try with a different endpoint
        try {
            console.log('Trying alternative endpoint...');
            const result = await makeRequest('GET', '/_pgsql/health');

            console.log('Successfully connected to Supabase health endpoint!');
            console.log('Response:', result);

            return true;
        } catch (altError) {
            console.error('Failed to connect to alternative endpoint:', altError.message);
            return false;
        }
    }
}

/**
 * Inserts job data into the database
 * @param {Array} jobs - Array of job objects to insert
 * @returns {Promise<number>} - Number of jobs successfully inserted
 */
async function insertJobsIntoDatabase(jobs) {
    let insertedCount = 0;

    try {
        console.log(`Inserting ${jobs.length} jobs into the database via REST API...`);

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
                const jobData = {
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
                };

                // Job insertion is handled below

                // Get the job result from the try/catch block
                let jobResult;
                try {
                    // First check if the job already exists based on title and company
                    const checkResult = await makeRequest(
                        'GET',
                        `/culinary_jobs_google?title=eq.${encodeURIComponent(job.title)}&company=eq.${encodeURIComponent(job.company)}&select=id`
                    );

                    if (checkResult && checkResult.length > 0) {
                        console.log(`Job already exists in database: "${job.title}" at "${job.company}" (ID: ${checkResult[0].id})`);

                        // Update the existing job
                        await makeRequest(
                            'PATCH',
                            `/culinary_jobs_google?id=eq.${checkResult[0].id}`,
                            jobData
                        );

                        // Use the existing job ID
                        jobResult = [{id: checkResult[0].id}];
                    } else {
                        // Use UPSERT with on_conflict parameter
                        try {
                            jobResult = await makeRequest(
                                'POST',
                                '/culinary_jobs_google?on_conflict=title,company',
                                jobData
                            );
                        } catch (insertError) {
                            // If there's a URL constraint error, try again with a modified URL
                            if (insertError.message && insertError.message.includes('culinary_jobs_google_url_key')) {
                                console.warn(`URL constraint violation detected for job "${job.title}" at "${job.company}"`);
                                console.warn(`URL: ${job.apply_link}`);
                                console.warn(`Trying again with a modified URL...`);

                                // Add a timestamp to make the URL unique
                                const timestamp = new Date().getTime();
                                jobData.url = `${job.apply_link}${job.apply_link.includes('?') ? '&' : '?'}t=${timestamp}`;

                                // Try again with the modified URL
                                jobResult = await makeRequest(
                                    'POST',
                                    '/culinary_jobs_google?on_conflict=title,company',
                                    jobData
                                );

                                console.log(`Successfully inserted job with modified URL`);
                            } else {
                                // Re-throw other errors
                                throw insertError;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error inserting job "${job.title}" at "${job.company}":`, error.message);
                    continue;
                }

                const jobId = jobResult[0]?.id;

                if (!jobId) {
                    console.error(`Failed to get job ID for "${job.title}" at "${job.company}"`);
                    continue;
                }

                // Insert email contacts if available
                if (job.emails && job.emails.length > 0) {
                    for (const email of job.emails) {
                        try {
                            // Combine first and last name
                            const fullName = `${email.firstName || ''} ${email.lastName || ''}`.trim();

                            const contactData = {
                                job_id: jobId,
                                name: fullName,
                                title: email.position || '',
                                email: email.email,
                                date_added: now,
                                last_updated: now
                            };

                            await makeRequest(
                                'POST',
                                '/culinary_contacts_google?on_conflict=job_id,email',
                                contactData
                            );
                        } catch (emailError) {
                            console.error(`Error inserting contact ${email.email}:`, emailError.message);
                        }
                    }
                    console.log(`Inserted ${job.emails.length} email contacts for job ID ${jobId}`);
                }

                insertedCount++;
                console.log(`Inserted job: "${job.title}" at "${job.company}" (ID: ${jobId})`);
            } catch (error) {
                console.error(`Error processing job "${job.title}" at "${job.company}":`, error.message);
            }
        }

        console.log(`Successfully inserted ${insertedCount} jobs into the database.`);
        return insertedCount;
    } catch (error) {
        console.error('Error during database insertion:', error.message);
        return insertedCount;
    }
}

export {
    initDatabase,
    insertJobsIntoDatabase
};
