#!/bin/bash

# Make sure src directory exists
mkdir -p src

# Check if email.js exists and copy it to the src directory
if [ -f "src/email.js" ]; then
    echo "src/email.js exists, making a backup"
    cp src/email.js src/email.js.bak
else
    echo "src/email.js does not exist, creating it"
fi

# Create or overwrite email.js with the content
cat > src/email.js << 'EOL'
/**
 * Email module for sending completion emails
 * Uses Resend API to send HTML-formatted emails with job statistics
 */

import { Resend } from 'resend';

// Email configuration
const FROM_EMAIL = 'Google Jobs Scraper <aj@chefsheet.com>';
const RECIPIENTS = ['aj@chefsheet.com', 'martha@madison-collective.com'];
const EMAIL_SUBJECT_PREFIX = 'BizDev Results for';

// Initialize Resend client
let resend = null;

/**
 * Initialize the email client
 * @returns {boolean} - True if initialization was successful
 */
function initEmailClient() {
    console.log('Initializing email client...');

    // Check for RESEND_API_KEY
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
        console.error('RESEND_API_KEY environment variable not found. Email functionality will be disabled.');
        console.error('Please set the RESEND_API_KEY environment variable in the Apify console.');
        return false;
    }

    if (apiKey.trim() === '') {
        console.error('RESEND_API_KEY is empty. Email functionality will be disabled.');
        console.error('Please set a valid RESEND_API_KEY in the Apify console.');
        return false;
    }

    console.log(`RESEND_API_KEY found (length: ${apiKey.length})`);

    try {
        resend = new Resend(apiKey);
        console.log('Email client initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize email client:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        return false;
    }
}

/**
 * Format a date in PST timezone
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDatePST(date) {
    return date.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Format a list of jobs as HTML
 * @param {Array} jobs - Array of job objects
 * @param {number} limit - Maximum number of jobs to include
 * @returns {string} - HTML formatted job list
 */
function formatJobsAsHtml(jobs, limit = 10) {
    if (!jobs || jobs.length === 0) {
        return '<p>No jobs in this category.</p>';
    }

    const jobsToShow = jobs.slice(0, limit);
    const hasMore = jobs.length > limit;

    let html = '<ul style="color: #000000;">';

    for (const job of jobsToShow) {
        html += `<li><b>${job.title}</b> at <b>${job.company}</b> in ${job.location || 'Unknown location'}`;

        // Add salary if available
        if (job.salary_min || job.salary_max) {
            const salaryMin = job.salary_min ? `$${job.salary_min.toLocaleString()}` : '';
            const salaryMax = job.salary_max ? `$${job.salary_max.toLocaleString()}` : '';
            const salary = salaryMin && salaryMax ? `${salaryMin} - ${salaryMax}` : salaryMin || salaryMax;

            if (salary) {
                html += ` (${salary}${job.salary_period ? ` ${job.salary_period}` : ''})`;
            }
        }

        // Add email count if available
        if (job.emails && job.emails.length > 0) {
            html += ` - <span style="color: #007700;">${job.emails.length} contact${job.emails.length > 1 ? 's' : ''}</span>`;
        }

        html += '</li>';
    }

    if (hasMore) {
        html += `<li><i>...and ${jobs.length - limit} more jobs</i></li>`;
    }

    html += '</ul>';
    return html;
}

/**
 * Generate HTML email content
 * @param {Object} stats - Job statistics object
 * @param {boolean} testMode - Whether running in test mode
 * @returns {string} - HTML email content
 */
function generateEmailHtml(stats, testMode = false) {
    const {
        startTime,
        endTime,
        durationMinutes,
        durationSeconds,
        processedCount,
        newJobs,
        skippedDuplicateJobs,
        skippedExcludedJobs,
        queries
    } = stats;

    // Format completion time
    const completionTime = formatDatePST(endTime);
    const dateOnly = formatDatePST(endTime).split(',')[0];

    // Generate HTML content
    let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        ${testMode ? '<div style="background-color: #ffffcc; padding: 10px; border: 1px solid #e6e600; margin-bottom: 15px; text-align: center;"><strong>TEST MODE</strong> - Email only sent to aj@chefsheet.com</div>' : ''}
        <p style="font-weight: bold; font-size: 24pt; color: #000000; text-align: center;">
            Your Google Jobs scraper completed at ${completionTime}
        </p>
        <p style="color: #000000;">Duration: ${durationMinutes} minutes (${durationSeconds} seconds)</p>

        <h2>Summary</h2>
        <ul style="color: #000000;">
            <li><b>${processedCount}</b> listings were successfully processed.</li>
            <li><b>${newJobs.length}</b> new listings were added to the database.</li>
            <li><b>${skippedDuplicateJobs.length}</b> listings were skipped (already in DB).</li>
            <li><b>${skippedExcludedJobs.length}</b> listings were skipped (excluded companies).</li>
        </ul>

        <h2>Queries Used</h2>
        <ul style="color: #000000;">
            ${queries.map(q => `<li>${q}</li>`).join('')}
        </ul>
    `;

    // Add new jobs section if there are any
    if (newJobs.length > 0) {
        html += `
        <h2>New Jobs Added (${newJobs.length})</h2>
        ${formatJobsAsHtml(newJobs, 20)}
        `;
    }

    // Add skipped duplicates section if there are any
    if (skippedDuplicateJobs.length > 0) {
        html += `
        <h2>Skipped Duplicates (${skippedDuplicateJobs.length})</h2>
        ${formatJobsAsHtml(skippedDuplicateJobs, 10)}
        `;
    }

    // Add skipped exclusions section if there are any
    if (skippedExcludedJobs.length > 0) {
        html += `
        <h2>Skipped Exclusions (${skippedExcludedJobs.length})</h2>
        ${formatJobsAsHtml(skippedExcludedJobs, 10)}
        `;
    }

    // Add footer
    html += `
        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #cccccc;">
        <p style="color: #666666; font-size: 12px; text-align: center;">
            This is an automated email from the Google Jobs API Actor.
            Generated on ${dateOnly}.
        </p>
    </div>
    `;

    return html;
}

/**
 * Send completion email with job statistics
 * @param {Object} stats - Job statistics object
 * @param {boolean} testMode - Whether to run in test mode (only send to primary recipient)
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendCompletionEmail(stats, testMode = false) {
    console.log('Starting sendCompletionEmail function...');

    // Initialize email client if not already initialized
    if (!resend) {
        console.log('Email client not initialized yet, initializing now...');
        const initialized = initEmailClient();
        if (!initialized) {
            console.error('Failed to initialize email client. Cannot send completion email.');
            return false;
        }
    }

    // Format date for subject
    const today = formatDatePST(new Date()).split(',')[0];
    const subject = `${EMAIL_SUBJECT_PREFIX} ${today}${testMode ? ' [TEST MODE]' : ''}`;
    console.log(`Email subject: "${subject}"`);

    // Generate email content
    console.log('Generating email HTML content...');
    const html = generateEmailHtml(stats, testMode);
    console.log(`Generated HTML content (length: ${html.length} characters)`);

    // Determine recipients based on test mode
    const recipients = testMode ? ['aj@chefsheet.com'] : RECIPIENTS;
    console.log(`Recipients: ${recipients.join(', ')}`);

    if (testMode) {
        console.log('Running in TEST MODE - email will only be sent to aj@chefsheet.com');
    }

    // Send email to each recipient individually
    let allSuccessful = true;

    for (const recipient of recipients) {
        try {
            console.log(`Preparing to send email to ${recipient}...`);

            // Create email payload
            const emailPayload = {
                from: FROM_EMAIL,
                to: recipient,
                subject: subject,
                html: html
            };
            console.log(`Email payload prepared for ${recipient}`);

            // Send the email
            console.log(`Sending email to ${recipient} via Resend API...`);
            const { data, error } = await resend.emails.send(emailPayload);

            if (error) {
                console.error(`Failed to send email to ${recipient}:`, error);
                allSuccessful = false;
            } else {
                console.log(`Successfully sent email to ${recipient} (ID: ${data.id})`);
            }
        } catch (error) {
            console.error(`Exception sending email to ${recipient}:`, error);
            if (error.stack) {
                console.error(`Stack trace: ${error.stack}`);
            }
            allSuccessful = false;
        }
    }

    console.log(`Email sending complete. Overall success: ${allSuccessful}`);
    return allSuccessful;
}

export {
    initEmailClient,
    sendCompletionEmail
};
EOL

echo "email.js file created/updated successfully"

# Make the script executable
chmod +x build.sh

echo "Build script completed successfully"
