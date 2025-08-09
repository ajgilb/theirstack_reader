import https from 'https';

/**
 * Indeed Scraper API implementation for comprehensive job collection
 * Uses city-based searches with 100-mile radius for maximum coverage
 * Maps fields to match rapidapi_jobs database schema
 */

// Comprehensive city list for maximum US coverage
const MAJOR_CITIES = [
    // Smallest to largest cities - so largest cities appear first in database
    'Riverside, CA',       // Smaller CA city
    'Henderson, NV',       // Nevada suburb
    'Corpus Christi, TX',  // Texas coast
    'Stockton, CA',        // Central CA
    'Lexington, KY',       // Kentucky
    'Anaheim, CA',         // Orange County
    'Honolulu, HI',        // Hawaii
    'Cleveland, OH',       // Ohio
    'New Orleans, LA',     // Louisiana
    'Tampa, FL',           // Florida
    'Aurora, CO',          // Colorado suburb
    'Arlington, TX',       // Texas suburb
    'Wichita, KS',         // Kansas
    'Bakersfield, CA',     // Central CA
    'Tulsa, OK',           // Oklahoma
    'Minneapolis, MN',     // Upper Midwest: MN, WI, IA
    'Oakland, CA',         // Bay Area
    'Miami, FL',           // Southeast: FL metro
    'Virginia Beach, VA',  // Virginia coast
    'Long Beach, CA',      // LA metro
    'Raleigh, NC',        // Research Triangle
    'Colorado Springs, CO', // Colorado
    'Omaha, NE',          // Nebraska
    'Atlanta, GA',        // Southeast: GA, AL, TN, SC
    'Mesa, AZ',           // Arizona suburb
    'Kansas City, MO',    // Missouri, Kansas
    'Sacramento, CA',     // California Capital Region
    'Fresno, CA',         // Central CA
    'Tucson, AZ',         // Arizona
    'Albuquerque, NM',    // New Mexico
    'Milwaukee, WI',      // Wisconsin
    'Baltimore, MD',      // Maryland
    'Louisville, KY',     // Kentucky
    'Memphis, TN',        // Tennessee
    'Detroit, MI',        // Great Lakes: MI, OH
    'Las Vegas, NV',      // Nevada: NV, UT
    'Portland, OR',       // Pacific Northwest: OR, WA
    'Boston, MA',         // New England: MA, NH, CT, RI
    'El Paso, TX',        // West Texas
    'Oklahoma City, OK',  // Oklahoma
    'Denver, CO',         // Mountain West: CO, WY, NM
    'Nashville, TN',      // Mid-South: TN, KY
    'Seattle, WA',        // Pacific Northwest: WA, OR
    'San Francisco, CA',  // Northern CA: CA Bay Area
    'Charlotte, NC',      // Carolinas: NC, SC
    'Indianapolis, IN',   // Indiana
    'Columbus, OH',       // Ohio
    'Fort Worth, TX',     // Texas
    'Jacksonville, FL',   // Florida
    'Austin, TX',         // Central Texas
    'San Jose, CA',       // Silicon Valley
    'Dallas, TX',         // South Central: TX metro
    'San Diego, CA',      // California
    'San Antonio, TX',    // South Central Texas
    'Philadelphia, PA',   // Mid-Atlantic: PA, DE, NJ
    'Phoenix, AZ',        // Southwest: AZ, NV
    'Houston, TX',        // Texas Gulf: TX metro
    'Chicago, IL',        // Midwest: IL, IN, WI, MI
    'Los Angeles, CA',    // West Coast: CA metro
    'New York, NY'        // Northeast: NY, NJ, PA, CT
];

// Comprehensive job search query targeting management and leadership positions
const JOB_SEARCH_TERMS = [
    "Restaurant Manager OR General Manager OR Assistant General Manager OR Executive Chef OR Sous Chef OR Pastry Chef OR Kitchen Manager OR Food and Beverage Manager OR Culinary Director OR Director of Operations OR Restaurant Group Manager OR Banquet Manager OR Catering Manager OR Hospitality Manager OR Bar Manager OR Beverage Director OR Wine Director OR Sommelier OR Dining Room Manager OR Service Director OR Hotel General Manager OR Hotel Manager OR Resident Manager OR Front Office Manager OR Housekeeping Manager OR Concierge Manager OR Reservations Manager OR Revenue Manager OR Sales Manager OR Marketing Manager OR Event Manager OR Banquet Director OR Spa Manager OR Wellness Director OR Director of Housekeeping OR Director of Rooms OR Night Manager OR Hotel Operations Manager OR Estate Manager OR House Manager OR Private Chef OR Executive Housekeeper OR Butler OR Chauffeur OR Personal Assistant OR Nanny OR Household Manager OR Property Manager OR Private Security Manager OR Director of Residences OR Valet Manager OR Personal Concierge OR Private Club Manager OR Country Club Manager OR Club General Manager OR Golf Club Manager OR Tennis Club Manager OR Yacht Club Manager OR Athletic Club Manager OR Social Club Manager OR Membership Director OR Club Operations Manager OR Food and Beverage Director OR Golf Course Superintendent OR Pro Shop Manager OR Club Chef OR Clubhouse Manager"
];

/**
 * Make API request with retry logic for rate limiting
 */
async function makeIndeedScraperRequestWithRetry(requestBody, city, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await makeIndeedScraperRequest(requestBody);

            if (result.status === 429) {
                const waitTime = Math.min(60 * attempt, 300); // Exponential backoff, max 5 minutes
                console.log(`  ⚠️  Rate limit hit for ${city} (attempt ${attempt}/${maxRetries}). Waiting ${waitTime} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                continue;
            }

            return result;

        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            console.log(`  ⚠️  Request failed for ${city} (attempt ${attempt}/${maxRetries}): ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds before retry
        }
    }

    throw new Error(`Failed after ${maxRetries} attempts`);
}

/**
 * Make API request to Indeed Scraper
 */
function makeIndeedScraperRequest(requestBody) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            hostname: 'indeed-scraper-api.p.rapidapi.com',
            port: null,
            path: '/api/job',
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY || '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c',
                'x-rapidapi-host': 'indeed-scraper-api.p.rapidapi.com',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, function (res) {
            const chunks = [];

            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                const responseBody = Buffer.concat(chunks);
                try {
                    const data = JSON.parse(responseBody.toString());
                    resolve({ status: res.statusCode, data });
                } catch (error) {
                    resolve({ status: res.statusCode, data: responseBody.toString() });
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify(requestBody));
        req.end();
    });
}

/**
 * Extract domain from URL
 */
function getDomainFromUrl(url) {
    if (!url) return '';
    try {
        const parsedUrl = new URL(url.startsWith('http') ? url : `http://${url}`);
        let domain = parsedUrl.hostname;
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        return domain;
    } catch (error) {
        return '';
    }
}

/**
 * Extract LinkedIn URL from company links or custom links
 */
function extractLinkedInUrl(companyLinks, customLinks) {
    // First check customLinks array (this is where LinkedIn URLs are typically found)
    if (customLinks && Array.isArray(customLinks)) {
        for (const link of customLinks) {
            if (link && link.name && link.url) {
                const nameLower = link.name.toLowerCase();
                if (nameLower.includes('linkedin') && link.url.includes('linkedin.com')) {
                    console.log(`🔗 Found LinkedIn URL in customLinks: ${link.url}`);
                    return link.url;
                }
            }
        }
    }

    // Fallback to companyLinks if available
    if (!companyLinks || typeof companyLinks !== 'object') return '';

    // Check various possible LinkedIn fields in companyLinks
    const linkedinFields = [
        'linkedin',
        'linkedIn',
        'LinkedIn',
        'linkedinUrl',
        'linkedInUrl',
        'social_linkedin',
        'socialLinkedIn'
    ];

    for (const field of linkedinFields) {
        if (companyLinks[field]) {
            const url = companyLinks[field];
            // Validate it's actually a LinkedIn URL
            if (typeof url === 'string' && url.includes('linkedin.com')) {
                return url;
            }
        }
    }

    // Check if there's a general social links array or object
    if (companyLinks.socialLinks && Array.isArray(companyLinks.socialLinks)) {
        for (const link of companyLinks.socialLinks) {
            if (typeof link === 'string' && link.includes('linkedin.com')) {
                return link;
            }
            if (typeof link === 'object' && link.url && link.url.includes('linkedin.com')) {
                return link.url;
            }
        }
    }

    return '';
}

/**
 * Format company size from revenue and employee count
 */
function formatCompanySize(companyRevenue, companyNumEmployees) {
    const revenue = companyRevenue ? companyRevenue.trim() : '';
    const employees = companyNumEmployees ? companyNumEmployees.trim() : '';

    if (revenue && employees) {
        return `${revenue} ${employees}`;
    } else if (revenue) {
        return revenue;
    } else if (employees) {
        return employees;
    }

    return '';
}

/**
 * Format salary information into a readable string
 */
function formatSalaryString(salaryData) {
    if (!salaryData) return '';

    // If there's already a salaryText, use it
    if (salaryData.salaryText) return salaryData.salaryText;

    const { salaryMin, salaryMax, salaryType, salaryCurrency } = salaryData;

    if (!salaryMin && !salaryMax) return '';

    // Round off numbers to no decimals
    const minRounded = salaryMin ? Math.round(salaryMin) : null;
    const maxRounded = salaryMax ? Math.round(salaryMax) : null;

    // Format currency (default to USD)
    const currency = salaryCurrency === 'USD' ? '$' : salaryCurrency;

    // Format type
    const typeText = salaryType === 'yearly' ? 'a year' :
                    salaryType === 'hourly' ? 'an hour' :
                    salaryType === 'monthly' ? 'a month' : '';

    // Build salary string
    if (minRounded && maxRounded) {
        return `${currency}${minRounded.toLocaleString()} - ${currency}${maxRounded.toLocaleString()}${typeText ? ' ' + typeText : ''}`;
    } else if (minRounded) {
        return `${currency}${minRounded.toLocaleString()}${typeText ? ' ' + typeText : ''}`;
    } else if (maxRounded) {
        return `Up to ${currency}${maxRounded.toLocaleString()}${typeText ? ' ' + typeText : ''}`;
    }

    return '';
}



/**
 * Normalize job data from Indeed Scraper API
 */
function normalizeIndeedScraperJob(job, searchTerm, city) {
    // Debug: Log company links and custom links for first few jobs
    if (job.companyLinks) {
        console.log(`🔗 Company links available for "${job.companyName}":`, Object.keys(job.companyLinks));
    }
    if (job.customLinks && Array.isArray(job.customLinks) && job.customLinks.length > 0) {
        console.log(`🔗 Custom links for "${job.companyName}":`, job.customLinks.map(link => `${link.name}: ${link.url}`));
    }
    if (job.companyRevenue || job.companyNumEmployees) {
        console.log(`🏢 Company size data for "${job.companyName}": Revenue="${job.companyRevenue}" Employees="${job.companyNumEmployees}"`);
    }

    return {
        // Basic job info - keep original title, use API company name
        title: job.title || 'No title',
        company: job.companyName || job.company || 'Company not specified',
        location: job.location?.formattedAddressShort || job.location?.fullAddress || 'Location not specified',
        
        // URLs and IDs
        url: job.applyUrl || job.jobUrl || '',
        apply_link: job.applyUrl || job.jobUrl || '',
        job_id: job.jobKey || '',
        
        // Salary information - format as single readable string
        salary: formatSalaryString(job.salary) || job.salaryText || '',
        salary_min: job.salary?.salaryMin ? Math.round(job.salary.salaryMin) : null,
        salary_max: job.salary?.salaryMax ? Math.round(job.salary.salaryMax) : null,
        salary_type: job.salary?.salaryType || '',
        salary_currency: job.salary?.salaryCurrency || 'USD',
        
        // Job details
        job_type: Array.isArray(job.jobType) ? job.jobType.join(', ') : (job.jobType || 'Full-time'),
        description: job.descriptionHtml || job.description || '',
        
        // Location details
        city: job.location?.city || '',
        state: job.location?.formattedAddressShort?.split(', ')[1] || '',
        country: job.location?.country || 'United States',
        latitude: job.location?.latitude || null,
        longitude: job.location?.longitude || null,
        
        // Company details - combine revenue and employee count
        company_size: formatCompanySize(job.companyRevenue, job.companyNumEmployees),

        // Search metadata
        search_term: searchTerm,
        search_city: city,
        source: 'indeed_scraper_api',
        scraped_at: new Date().toISOString(),
        
        // Contact info (extract from description if available)
        emails: extractEmailsFromText(job.descriptionHtml || job.description || ''),
        
        // Additional fields for compatibility
        posted_date: job.postedDate || job.datePublished || '',
        company_url: job.companyUrl || job.companyLinks?.corporateWebsite || '',
        company_website: job.companyLinks?.corporateWebsite || '', // Direct from API
        company_domain: job.companyLinks?.corporateWebsite ? getDomainFromUrl(job.companyLinks.corporateWebsite) : '',
        linkedin: extractLinkedInUrl(job.companyLinks, job.customLinks) || '', // Extract LinkedIn URL from company/custom links
        remote: job.remote || job.isRemote || false
    };
}

/**
 * Filter out unwanted jobs (entry-level positions and excluded companies)
 */
function filterUnwantedJobs(jobs) {
    return jobs.filter(job => {
        // Filter out entry-level/hourly job titles
        if (job.title) {
            const titleLower = job.title.toLowerCase();
            const excludedTitles = [
                // Front of House
                'server', 'waiter', 'waitress', 'host', 'hostess', 'busser', 'buser',
                'food runner', 'runner', 'barback', 'bartender', 'cashier',
                'counter server', 'drive-thru', 'drive thru', 'takeout specialist',
                'takeout', 'delivery driver', 'delivery', 'breakfast attendant',

                // Kitchen Staff
                'line cook', 'prep cook', 'dishwasher', 'expeditor', 'expo',
                'kitchen porter', 'pastry assistant', 'fry cook', 'pantry cook',
                'butcher', 'commissary worker', 'cook',

                // Hotel/Hospitality
                'housekeeper', 'room attendant', 'laundry attendant', 'houseman',
                'housekeeping aide', 'maintenance technician', 'janitor', 'custodian',
                'steward', 'kitchen porter', 'banquet server', 'event setup',
                'security officer', 'security guard', 'housekeeping',

                // Hotel Operations
                'night auditor', 'night audit', 'front desk', 'clerk', 'room service',
                'front office', 'greeter', 'hilton hotel',

                // Kitchen/Food Prep
                'prep',

                // Sales/Customer Service
                'agent',

                // Security and Loss Prevention
                'loss prevention',

                // Healthcare/Behavioral
                'behavioral health',

                // Additional exclusions
                'assistant', 'associate', 'crew member', 'team member', 'staff'
            ];

            if (excludedTitles.some(excludedTitle => titleLower.includes(excludedTitle))) {
                console.log(`🚫 Excluding entry-level job: "${job.title}" at "${job.company}"`);
                return false;
            }
        }

        // Filter out hourly salary positions
        if (job.salary) {
            const salaryLower = job.salary.toLowerCase();
            if (salaryLower.includes('hour') || salaryLower.includes('/hr') || salaryLower.includes('an hour')) {
                console.log(`🚫 Excluding hourly salary job: "${job.title}" at "${job.company}" - "${job.salary}"`);
                return false;
            }
        }

        // Filter out fast food and excluded companies
        if (job.company) {
            const companyLower = job.company.toLowerCase();
            const excludedCompanies = [
                // Fast food chains
                'mcdonalds', "mcdonald's", 'burger king', 'taco bell', 'kfc', 'subway',
                'pizza hut', 'dominos', "domino's", 'papa johns', "papa john's", 'little caesars',
                'wendys', "wendy's", 'arbys', "arby's", 'dairy queen', 'sonic drive',
                'chipotle', 'panera bread', 'five guys', 'in-n-out', 'whataburger',
                'chick-fil-a', 'popeyes', 'dunkin', "dunkin'", 'starbucks', 'tim hortons',
                'white castle', 'jack in the box', 'carl jr', 'hardees', "hardee's",
                'qdoba', 'moes southwest', 'panda express', 'orange julius',

                // Hotel chains (excluded) - exact matches to avoid false positives
                'embassy suites', 'embassy suites by hilton', 'courtyard by marriott',
                'springhill suites', 'fairfield inn & suites', 'towneplace suites',
                'residence inn', 'moxy hotels', 'ac hotels', 'hampton by hilton',
                'tru by hilton', 'home2 suites by hilton', 'homewood suites by hilton',
                'hilton garden inn', 'holiday inn express', 'avid hotels',
                'candlewood suites', 'staybridge suites', 'comfort inn', 'comfort suites',
                'sleep inn', 'quality inn', 'clarion', 'mainstay suites',
                'suburban studios', 'woodspring suites', 'econo lodge', 'rodeway inn',
                'la quinta inn & suites', 'microtel inn & suites', 'days inn',
                'super 8', 'travelodge', 'baymont inn & suites', 'howard johnson',
                'americinn', 'best western', 'best western plus', 'surestay',
                'surestay plus', 'surestay studio', 'executive residency',
                'motel 6', 'studio 6', 'red roof inn', 'red roof plus+',
                'hometowne studios by red roof', 'my place hotels', 'cobblestone inn & suites',
                'boarders inn & suites', 'centerstone hotels', "america's best value inn",
                'canadas best value inn', 'budget inn', 'scottish inns', 'knights inn',
                'signature inn', 'americas best inns', 'greentree inn', 'stayable',
                'renaissance hotels', 'sheraton',

                // Major hotel/hospitality companies
                'marriott international', 'hilton', 'mgm resorts international',

                // Fast food/restaurant chains
                'shake shack',

                // Grocery/retail
                "smith's food and drug",

                // Business services
                'sla management',

                // Senior living (partial match)
                'senior living',

                // Senior living and healthcare
                'brookdale senior living', 'atria senior living', 'sunrise senior living',
                'benchmark senior living', 'holiday retirement', 'genesis healthcare',
                'encompass health', 'amedisys', 'kindred healthcare', 'life care centers of america',
                'trilogy health services', 'lcs', 'life care services', 'compassus',
                'the ensign group', 'savaseniorcare', 'hcr manorcare', 'consulate health care',
                'pruitthealth', 'avalon health care', 'covenant care', 'promedica',
                'ascension', 'commonspirit health', 'hca healthcare', 'tenet healthcare',
                'kaiser permanente', 'mayo clinic', 'cleveland clinic', 'mass general brigham',
                'adventhealth', 'baylor scott & white health', 'uhs', 'universal health services',
                'vibra healthcare', 'select medical', 'chi living communities',

                // Education and institutional dining
                'university', 'college', 'school district', 'k-12', 'elementary school',
                'middle school', 'high school', 'public school', 'private school',
                'charter school', 'academy', 'campus dining', 'student dining',
                'dining services', 'faculty dining', 'education', 'higher education',
                'cafeteria', 'resident hall', 'institutional dining', 'child nutrition',
                'meal program', 'food service worker',

                // General exclusions
                'health care', 'healthcare', 'hospital', 'medical center',
                'nursing home', 'assisted living', 'retirement home'
            ];

            if (excludedCompanies.some(excluded => companyLower.includes(excluded))) {
                console.log(`🚫 Excluding excluded company: "${job.title}" at "${job.company}"`);
                return false;
            }
        }

        // Filter out jobs with senior living URLs
        if (job.company_website || job.company_url || job.parent_url) {
            const websiteUrl = (job.company_website || job.company_url || job.parent_url || '').toLowerCase();
            if (websiteUrl.includes('seniorliving')) {
                console.log(`🚫 Excluding senior living URL: "${job.title}" at "${job.company}" - URL: ${websiteUrl}`);
                return false;
            }
        }

        return true; // Include job if it passes all filters
    });
}

/**
 * Extract email addresses from job description text
 */
function extractEmailsFromText(text) {
    if (!text) return [];
    
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    
    // Filter out common non-contact emails
    const filteredEmails = emails.filter(email => {
        const lowerEmail = email.toLowerCase();
        return !lowerEmail.includes('noreply') && 
               !lowerEmail.includes('no-reply') &&
               !lowerEmail.includes('donotreply') &&
               !lowerEmail.includes('support') &&
               !lowerEmail.includes('help');
    });
    
    return [...new Set(filteredEmails)]; // Remove duplicates
}



/**
 * Main function to scrape jobs using Indeed Scraper API
 */
export async function scrapeJobsWithIndeedScraper(options = {}) {
    const {
        testMode = false,
        minSalary = 55000,
        maxCities = testMode ? 2 : MAJOR_CITIES.length,
        searchTerms = JOB_SEARCH_TERMS,
        jobAgeDays = 1 // Default to 1 day for daily runs, can be set to 7 for initial runs
    } = options;
    
    // Map jobAgeDays to API-supported values: 1, 3, 7, 14 (cap higher selections to 14)
    const validJobAgeDays = [1, 3, 7, 14];
    const mapToSupportedJobAgeDays = (value) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return 7;
        if (value >= 14) return 14;
        // Choose the nearest supported value
        let nearest = validJobAgeDays[0];
        let smallestDiff = Math.abs(value - nearest);
        for (const v of validJobAgeDays) {
            const diff = Math.abs(value - v);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                nearest = v;
            }
        }
        return nearest;
    };
    const validatedJobAgeDays = mapToSupportedJobAgeDays(jobAgeDays);
    if (validatedJobAgeDays !== jobAgeDays) {
        console.log(`⚠️  Mapping jobAgeDays ${jobAgeDays} → ${validatedJobAgeDays} due to API limits.`);
        console.log(`📋 Supported values: ${validJobAgeDays.join(', ')}`);
    }

    console.log('🚀 Starting Indeed Scraper API job collection...');
    console.log(`📋 Using comprehensive OR query targeting management positions`);
    console.log(`🏙️ Cities to search: ${maxCities} (${testMode ? 'TEST MODE' : 'FULL MODE'})`);
    console.log(`💰 Minimum salary: $${minSalary.toLocaleString()}`);
    console.log(`📅 Job age filter: ${validatedJobAgeDays} days`);
    console.log(`🎯 Total API calls: ${maxCities} (1 comprehensive query per city)`);
    console.log(`⏱️  Estimated time: ${Math.ceil(maxCities * 15 / 60)} minutes (15 sec between requests for rate limiting)`);
    
    const allJobs = [];
    const citiesToSearch = MAJOR_CITIES.slice(0, maxCities);
    
    for (let cityIndex = 0; cityIndex < citiesToSearch.length; cityIndex++) {
        const city = citiesToSearch[cityIndex];
        console.log(`\n🏙️ Searching in ${city} (${cityIndex + 1}/${citiesToSearch.length})`);
        
        for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
            const searchTerm = searchTerms[termIndex];
            console.log(`  🔍 Searching for management positions...`);
            
            try {
                const requestBody = {
                    scraper: {
                        maxRows: 100, // Maximum jobs per request
                        query: searchTerm,
                        location: city,
                        jobType: 'fulltime',
                        radius: '100', // Maximum allowed radius
                        sort: 'date', // Sort by date to get newest jobs first
                        fromDays: validatedJobAgeDays.toString(), // Use validated job age (7 for initial, 1 for daily)
                        country: 'us'
                    }
                };

                const result = await makeIndeedScraperRequestWithRetry(requestBody, city);
                
                if (result.status === 201 && result.data.returnvalue?.data) {
                    const jobs = result.data.returnvalue.data;
                    console.log(`  ✅ Found ${jobs.length} jobs`);
                    
                    // Normalize job data
                    const normalizedJobs = jobs.map(job => normalizeIndeedScraperJob(job, searchTerm, city));

                    // Apply filtering to remove unwanted jobs
                    const filteredJobs = filterUnwantedJobs(normalizedJobs);
                    console.log(`  🧹 Filtered: ${normalizedJobs.length} → ${filteredJobs.length} jobs (removed ${normalizedJobs.length - filteredJobs.length} unwanted)`);

                    allJobs.push(...filteredJobs);
                    
                    // Show sample job
                    if (filteredJobs.length > 0) {
                        const sampleJob = filteredJobs[0];
                        console.log(`  📄 Sample: ${sampleJob.title} at ${sampleJob.company} - ${sampleJob.salary || 'Salary not specified'}`);
                    }
                    
                } else {
                    console.log(`  ❌ Request failed: ${result.status}`);
                    if (result.data?.message) {
                        console.log(`  📄 Error: ${result.data.message}`);
                    }
                }
                
            } catch (error) {
                console.log(`  ❌ Error searching "${searchTerm}" in ${city}: ${error.message}`);
            }
            
            // Rate limiting: wait between requests (5 requests per minute = 12 seconds between requests)
            if (termIndex < searchTerms.length - 1 || cityIndex < citiesToSearch.length - 1) {
                console.log(`  ⏱️ Waiting 15 seconds (rate limit: 5 requests/minute)...`);
                await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds to be safe
            }
        }
    }
    
    // Remove duplicates based on company + title combination (more effective for overlapping city searches)
    const uniqueJobs = [];
    const seenJobs = new Set();
    let duplicateCount = 0;

    for (const job of allJobs) {
        // Create a unique key from company and title (case-insensitive, trimmed)
        const company = (job.company || 'unknown').toLowerCase().trim();
        const title = (job.title || 'unknown').toLowerCase().trim();
        const jobKey = `${company}|${title}`;

        if (!seenJobs.has(jobKey)) {
            seenJobs.add(jobKey);
            uniqueJobs.push(job);
        } else {
            duplicateCount++;
            // Only log first few duplicates to avoid spam
            if (duplicateCount <= 5) {
                console.log(`  🔄 Duplicate: "${job.title}" at "${job.company}"`);
            }
        }
    }
    
    console.log(`\n📊 Collection Summary:`);
    console.log(`  🎯 Total jobs found: ${allJobs.length}`);
    console.log(`  🆕 Unique jobs (by company+title): ${uniqueJobs.length}`);
    console.log(`  🔄 Duplicates removed: ${duplicateCount}`);
    console.log(`  🏙️ Cities searched: ${citiesToSearch.length}`);
    console.log(`  📋 Search terms: ${searchTerms.length}`);
    if (duplicateCount > 5) {
        console.log(`  ℹ️  (${duplicateCount - 5} more duplicates not shown)`);
    }
    
    // Show jobs with contact info
    const jobsWithEmails = uniqueJobs.filter(job => job.emails && job.emails.length > 0);
    console.log(`  📧 Jobs with email contacts: ${jobsWithEmails.length}`);
    
    return uniqueJobs;
}

export default {
    scrapeJobsWithIndeedScraper,
    MAJOR_CITIES,
    JOB_SEARCH_TERMS
};
