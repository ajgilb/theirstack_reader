/**
 * Hunter.io API integration for finding email addresses
 */

// Hunter.io API Configuration
const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const DOMAIN_SEARCH_API_URL = 'https://api.hunter.io/v2/domain-search';
const API_TIMEOUT_MS = 30000;
const BATCH_PAUSE_MS = 5000;
const CACHE_MAX_AGE_DAYS = 30;

// IMPORTANT: Set this to true to disable caching and force fresh Hunter API calls for each company
// This ensures we don't get the same contacts for different companies
const DISABLE_COMPANY_CACHE = true;

// In-memory cache
const companyCache = new Map();

// Generic email patterns to deprioritize
const GENERIC_EMAIL_PATTERNS = [
    'info@', 'contact@', 'hello@', 'admin@', 'support@',
    'office@', 'mail@', 'inquiry@', 'general@', 'sales@',
    'help@', 'service@', 'hr@', 'jobs@', 'careers@',
    'team@', 'marketing@', 'press@', 'media@', 'events@'
];

/**
 * Finds email addresses for a domain using Hunter.io
 * @param {string} domain - The domain to search for email addresses
 * @param {string} companyName - The original company name for reference
 * @returns {Promise<Array>} - Array of email objects
 */
async function findEmailsWithHunter(domain, companyName) {
    if (!HUNTER_API_KEY) {
        console.warn('HUNTER_API_KEY environment variable not found. Skipping Hunter.io search.');
        return [];
    }

    if (!domain) {
        console.info(`Skipping Hunter.io search for invalid domain: ${domain}`);
        return [];
    }

    // Check cache first (unless disabled)
    const cacheKey = domain.toLowerCase();
    if (!DISABLE_COMPANY_CACHE && companyCache.has(cacheKey)) {
        const cachedData = companyCache.get(cacheKey);
        console.info(`Using cached Hunter.io data for domain "${domain}" (${companyName})`);
        return cachedData;
    }

    try {
        console.info(`HUNTER API: Searching for emails on domain "${domain}" (${companyName})`);

        // Build the API URL with limit parameter to get more emails (max 100)
        const searchUrl = `${DOMAIN_SEARCH_API_URL}?domain=${encodeURIComponent(domain)}&limit=100&api_key=${HUNTER_API_KEY}`;

        // Set up fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        const response = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            console.error(`Hunter API error: ${data.errors?.[0] || response.statusText}`);
            return [];
        }

        // Check if we have email results
        if (!data.data || !data.data.emails || data.data.emails.length === 0) {
            console.info(`No email addresses found for domain "${domain}"`);

            // Try fallback to company name search if domain search fails
            console.info(`Trying fallback to company name search for "${companyName}"`);
            const companyEmails = await findEmailsByCompanyName(companyName);

            if (companyEmails.length > 0) {
                console.info(`Found ${companyEmails.length} email(s) using company name search for "${companyName}"`);

                // Store in cache
                if (!DISABLE_COMPANY_CACHE) {
                    companyCache.set(cacheKey, companyEmails);
                }

                return companyEmails;
            }

            return [];
        }

        // Log the number of emails found
        console.info(`Found ${data.data.emails.length} email addresses for domain "${domain}"`);

        // Process the emails to extract relevant information
        const processedEmails = data.data.emails.map(email => ({
            email: email.value,
            firstName: email.first_name,
            lastName: email.last_name,
            position: email.position,
            confidence: email.confidence,
            _originalCompany: companyName,
            _originalDomain: domain
        }));

        // Sort emails by job title relevance
        const sortedEmails = sortEmailsByRelevance(processedEmails);

        // Store in cache
        if (!DISABLE_COMPANY_CACHE) {
            companyCache.set(cacheKey, sortedEmails);
        }

        return sortedEmails;

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Hunter API request timed out for domain "${domain}"`);
        } else {
            console.error(`Error during Hunter API call for domain "${domain}": ${error.message}`);
        }
        return [];
    }
}

/**
 * Sorts emails by job title relevance
 * @param {Array} emails - Array of email objects
 * @returns {Array} - Sorted array of email objects
 */
function sortEmailsByRelevance(emails) {
    return emails.sort((a, b) => {
        // First sort by job title priority
        const titleA = a.position ? getJobTitlePriority(a.position) : 999;
        const titleB = b.position ? getJobTitlePriority(b.position) : 999;

        if (titleA !== titleB) {
            return titleA - titleB;
        }

        // If job titles have the same priority, sort by confidence
        if ((b.confidence || 0) !== (a.confidence || 0)) {
            return (b.confidence || 0) - (a.confidence || 0);
        }

        // If confidence is the same, deprioritize generic email patterns
        const emailA = a.email.toLowerCase();
        const emailB = b.email.toLowerCase();

        const isGenericA = GENERIC_EMAIL_PATTERNS.some(pattern => emailA.startsWith(pattern));
        const isGenericB = GENERIC_EMAIL_PATTERNS.some(pattern => emailB.startsWith(pattern));

        if (isGenericA !== isGenericB) {
            return isGenericA ? 1 : -1; // Non-generic emails first
        }

        // Default to alphabetical order by email
        return emailA.localeCompare(emailB);
    });
}

/**
 * Gets the priority of a job title (lower number = higher priority)
 * @param {string} title - Job title
 * @returns {number} - Priority value
 */
function getJobTitlePriority(title) {
    if (!title) return 999;

    const lowerTitle = title.toLowerCase();

    // Executive/leadership positions
    if (lowerTitle.includes('ceo') ||
        lowerTitle.includes('chief executive') ||
        lowerTitle.includes('owner') ||
        lowerTitle.includes('founder') ||
        lowerTitle.includes('president')) {
        return 10;
    }

    // C-level positions
    if (lowerTitle.includes('coo') ||
        lowerTitle.includes('cfo') ||
        lowerTitle.includes('cto') ||
        lowerTitle.includes('chief')) {
        return 20;
    }

    // Culinary leadership
    if (lowerTitle.includes('executive chef') ||
        lowerTitle.includes('head chef') ||
        lowerTitle.includes('chef de cuisine') ||
        lowerTitle.includes('culinary director')) {
        return 30;
    }

    // Restaurant/hotel management
    if (lowerTitle.includes('general manager') ||
        lowerTitle.includes('director of operations') ||
        lowerTitle.includes('restaurant manager') ||
        lowerTitle.includes('hotel manager')) {
        return 40;
    }

    // HR/Hiring positions
    if (lowerTitle.includes('hr') ||
        lowerTitle.includes('human resources') ||
        lowerTitle.includes('talent') ||
        lowerTitle.includes('recruiter') ||
        lowerTitle.includes('hiring')) {
        return 50;
    }

    // Other management positions
    if (lowerTitle.includes('manager') ||
        lowerTitle.includes('director')) {
        return 60;
    }

    // Other culinary positions
    if (lowerTitle.includes('chef') ||
        lowerTitle.includes('cook') ||
        lowerTitle.includes('culinary')) {
        return 70;
    }

    // Default priority for other positions
    return 100;
}

/**
 * Extracts the domain from a URL
 * @param {string} url - The URL to extract the domain from
 * @returns {string|null} - The domain or null if invalid
 */
function getDomainFromUrl(url) {
    if (!url) return null;

    try {
        // Remove protocol and get domain
        const parsedUrl = new URL(url.startsWith('http') ? url : `http://${url}`);
        let domain = parsedUrl.hostname;

        // Remove www. prefix if present
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }

        return domain;
    } catch (error) {
        console.error(`Error extracting domain from URL ${url}: ${error.message}`);

        // Fallback for simple cases if URL constructor fails
        let domain = url.replace(/^https?:\/\//, ''); // Remove http(s)://
        domain = domain.replace(/^www\./, '');        // Remove www.
        domain = domain.split('/')[0];                // Remove path
        domain = domain.split('?')[0];                // Remove query string
        domain = domain.split(':')[0];                // Remove port

        // Basic check if it looks like a domain
        if (domain.includes('.')) {
            return domain;
        }

        return null;
    }
}

/**
 * Finds email addresses for a company name directly using Hunter.io
 * This is a fallback when domain search doesn't yield results
 * @param {string} companyName - The company name to search for
 * @returns {Promise<Array>} - Array of email objects
 */
async function findEmailsByCompanyName(companyName) {
    if (!HUNTER_API_KEY) {
        console.warn('HUNTER_API_KEY environment variable not found. Skipping Hunter.io search.');
        return [];
    }

    if (!companyName) {
        console.info(`Skipping Hunter.io search for invalid company name: ${companyName}`);
        return [];
    }

    try {
        console.info(`HUNTER API: Searching for emails by company name "${companyName}"`);

        // Build the API URL for company search
        const searchUrl = `https://api.hunter.io/v2/email-finder?company=${encodeURIComponent(companyName)}&api_key=${HUNTER_API_KEY}`;

        // Set up fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        const response = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            console.error(`Hunter API error (company search): ${data.errors?.[0] || response.statusText}`);
            return [];
        }

        // Check if we have email results
        if (!data.data || !data.data.email) {
            console.info(`No email addresses found for company "${companyName}"`);
            return [];
        }

        // Create a single email object from the result
        const email = data.data.email;
        const processedEmail = {
            email: email.value,
            firstName: email.first_name,
            lastName: email.last_name,
            position: null, // Company search doesn't return position
            confidence: email.confidence,
            _originalCompany: companyName,
            _originalDomain: email.domain
        };

        console.info(`Found email address for company "${companyName}": ${email.value}`);

        return [processedEmail];

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Hunter API request timed out for company "${companyName}"`);
        } else {
            console.error(`Error during Hunter API call for company "${companyName}": ${error.message}`);
        }
        return [];
    }
}

export {
    findEmailsWithHunter,
    findEmailsByCompanyName,
    sortEmailsByRelevance,
    getJobTitlePriority,
    getDomainFromUrl
};
