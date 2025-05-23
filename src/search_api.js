/**
 * List of domains to exclude from company website searches
 * These are travel, review, social media, and job sites that won't have relevant business contacts
 */
const EXCLUDED_DOMAINS = [
    // Travel & Review Sites
    'tripadvisor.com', 'tripadvisor.co.uk', 'tripadvisor.ca', 'tripadvisor.fr', 'tripadvisor.de',
    'yelp.com', 'yelp.ca', 'yelp.co.uk', 'yelp.fr',
    'opentable.com', 'opentable.co.uk', 'opentable.ca',
    'zomato.com', 'foursquare.com', 'urbanspoon.com', 'zagat.com',
    'timeout.com', 'eater.com', 'thrillist.com', 'chowhound.com',
    'menupix.com', 'grubhub.com', 'seamless.com', 'doordash.com',
    'ubereats.com', 'postmates.com', 'caviar.com',

    // Social Media Sites
    'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
    'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
    'snapchat.com', 'whatsapp.com', 'telegram.org',

    // News & Blog Sites
    'blogspot.com', 'wordpress.com', 'medium.com', 'substack.com',
    'tumblr.com', 'wix.com', 'squarespace.com',

    // Job/Recruiting Sites
    'indeed.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com',
    'careerbuilder.com', 'simplyhired.com', 'snagajob.com',

    // General directories and listing sites
    'yellowpages.com', 'whitepages.com', 'superpages.com',
    'manta.com', 'bbb.org', 'mapquest.com', 'google.com',
    'wikipedia.org', 'wikimedia.org'
];

/**
 * Checks if a URL should be excluded from Hunter.io searches
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL should be excluded
 */
function shouldExcludeUrl(url) {
    if (!url) return false;

    const lowerUrl = url.toLowerCase();

    return EXCLUDED_DOMAINS.some(domain => {
        return lowerUrl.includes(domain);
    });
}

/**
 * Uses SearchAPI.io to find the website URL for a company name.
 */
async function getWebsiteUrlFromSearchAPI(companyName) {
    const apiKey = process.env.SEARCH_API_KEY;

    if (!apiKey) {
        console.warn('SEARCH_API_KEY environment variable not found. Skipping search.');
        return null;
    }

    if (!companyName || companyName === 'Unknown' || companyName.startsWith('Excluded:')) {
        console.info(`Skipping search for invalid/excluded company: ${companyName}`);
        return null;
    }

    try {
        // Create search query - add "official website" to improve results
        const searchQuery = `${companyName} official website`;

        // Build the API URL
        const searchUrl = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(searchQuery)}&api_key=${apiKey}`;

        console.info(`SEARCH API: Searching for "${searchQuery}"`);

        const response = await fetch(searchUrl);
        const data = await response.json();

        if (!response.ok) {
            console.error(`Search API error: ${data.error || response.statusText}`);
            return null;
        }

        // Check if we have organic results
        if (!data.organic_results || data.organic_results.length === 0) {
            console.info(`No search results found for "${companyName}"`);
            return null;
        }

        // Log all results for debugging
        console.info(`Found ${data.organic_results.length} search results for "${companyName}"`);
        data.organic_results.slice(0, 3).forEach((result, index) => {
            console.info(`Result #${index+1}: ${result.title} - ${result.link} (${result.domain})`);
        });

        // Find the first result that isn't an excluded domain
        for (let i = 0; i < Math.min(data.organic_results.length, 5); i++) {
            const result = data.organic_results[i];

            if (shouldExcludeUrl(result.link)) {
                console.info(`Skipping excluded domain result #${i+1}: ${result.link} (${result.domain})`);
                continue;
            }

            console.info(`Using result #${i+1}: ${result.link} (${result.domain})`);
            return result.link;
        }

        console.info(`No suitable website found for "${companyName}" - all results were excluded domains`);
        return null;

    } catch (error) {
        console.error(`Error during Search API call for "${companyName}": ${error.message}`);
        return null;
    }
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

export {
    getWebsiteUrlFromSearchAPI,
    getDomainFromUrl,
    shouldExcludeUrl
};
