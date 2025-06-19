/**
 * Indeed Direct Scraper
 *
 * Scrapes job listings directly from Indeed URLs using Puppeteer
 * with anti-bot measures and Cloudflare bypass capabilities
 */

import { Actor } from 'apify';
import { PuppeteerCrawler, Dataset } from 'crawlee';
import { shouldExcludeCompany, isSalaryCompanyName } from './bing_search_api.js';

/**
 * Perform human-like search on Indeed homepage
 * @param {Object} page - Puppeteer page object
 * @param {string} jobType - Job type to search for
 * @param {string} location - Location to search in
 * @param {number} salaryMin - Minimum salary filter
 * @returns {boolean} Success status
 */
async function performIndeedSearch(page, jobType, location, salaryMin) {
    try {
        console.log(`🔍 Performing human-like search for "${jobType}" in "${location}"`);

        // Go to Indeed homepage first
        await page.goto('https://www.indeed.com', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for page to load and handle any popups
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

        // Find and fill the job search form
        const whatInput = await page.$('#text-input-what');
        const whereInput = await page.$('#text-input-where');

        if (!whatInput || !whereInput) {
            console.log('❌ Could not find search form inputs');
            return false;
        }

        // Clear and fill the "what" field (job title)
        await whatInput.click({ clickCount: 3 }); // Select all
        await whatInput.type(jobType, { delay: 100 + Math.random() * 100 });

        // Add human-like delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        // Clear and fill the "where" field (location)
        await whereInput.click({ clickCount: 3 }); // Select all
        await whereInput.type(location, { delay: 100 + Math.random() * 100 });

        // Add another human-like delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        // Click the search button
        const searchButton = await page.$('.yosegi-InlineWhatWhere-primaryButton');
        if (!searchButton) {
            console.log('❌ Could not find search button');
            return false;
        }

        await searchButton.click();

        // Wait for search results to load
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

        console.log('✅ Search performed successfully');
        return true;

    } catch (error) {
        console.error('❌ Error performing search:', error.message);
        return false;
    }
}

/**
 * Create search tasks for human-like interaction
 * @param {Object} params - Search parameters
 * @returns {Array} Array of search tasks
 */
function createIndeedSearchTasks(params = {}) {
    const {
        location = 'United States',
        salaryMin = 55000,
        maxPages = 5,
        jobTypes = [
            'restaurant manager',
            'executive chef',
            'sous chef',
            'kitchen manager',
            'culinary director',
            'food service manager',
            'private chef',
            'restaurant chef'
        ]
    } = params;

    const tasks = [];

    jobTypes.forEach(jobType => {
        // Create search tasks for each job type
        for (let page = 0; page < maxPages; page++) {
            tasks.push({
                jobType,
                location,
                salaryMin,
                pageNumber: page,
                isFirstPage: page === 0
            });
        }
    });

    return tasks;
}

/**
 * Handle Cloudflare challenges and page loading
 * @param {Object} page - Puppeteer page object
 * @returns {boolean} Success status
 */
async function handleCloudflareChallenge(page) {
    try {
        const title = await page.title();
        console.log(`📋 Page title: ${title}`);

        // Enhanced Cloudflare detection
        const cloudflareIndicators = [
            'Just a moment',
            'Checking your browser',
            'Please wait',
            'DDoS protection',
            'Cloudflare',
            'Ray ID',
            'Attention Required',
            'Verify you are human',
            'Security check'
        ];

        const isCloudflareChallenge = cloudflareIndicators.some(indicator =>
            title.toLowerCase().includes(indicator.toLowerCase())
        );

        // Also check page content for Cloudflare indicators
        const bodyText = await page.evaluate(() => document.body.textContent || '').catch(() => '');
        const hasCloudflareContent = cloudflareIndicators.some(indicator =>
            bodyText.toLowerCase().includes(indicator.toLowerCase())
        );

        if (isCloudflareChallenge || hasCloudflareContent) {
            console.log('🛡️  Cloudflare challenge detected, waiting for resolution...');

            // Wait longer for challenge to complete (up to 45 seconds)
            let attempts = 0;
            const maxAttempts = 9; // 45 seconds total

            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;

                try {
                    const currentTitle = await page.title();
                    const currentBody = await page.evaluate(() => document.body.textContent || '').catch(() => '');

                    const stillChallenge = cloudflareIndicators.some(indicator =>
                        currentTitle.toLowerCase().includes(indicator.toLowerCase()) ||
                        currentBody.toLowerCase().includes(indicator.toLowerCase())
                    );

                    if (!stillChallenge) {
                        console.log(`✅ Cloudflare challenge resolved after ${attempts * 5} seconds`);
                        // Additional wait to ensure page is fully loaded
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        return true;
                    }

                    console.log(`⏳ Waiting for Cloudflare... (${attempts * 5}s)`);
                } catch (error) {
                    console.log(`⚠️  Error checking challenge status: ${error.message}`);
                }
            }

            console.log('❌ Cloudflare challenge not resolved within timeout');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error handling Cloudflare:', error);
        return false;
    }
}

/**
 * Extract job data from Indeed job card element using current Indeed selectors
 * @param {Object} page - Puppeteer page object
 * @param {Object} jobElement - Job element handle
 * @returns {Object} Extracted job data
 */
async function extractIndeedJobData(page, jobElement) {
    try {
        const jobData = await page.evaluate((element) => {
            // Helper functions
            const getText = (selector, parent = element) => {
                const el = parent.querySelector(selector);
                return el ? el.textContent.trim() : '';
            };

            const getAttr = (selector, attr, parent = element) => {
                const el = parent.querySelector(selector);
                return el ? el.getAttribute(attr) : '';
            };

            // Try multiple selectors for job title (Indeed changes these frequently)
            const titleSelectors = [
                'h2 a span[title]',
                '[data-testid="job-title"] a span',
                '.jobTitle a span',
                'h2 span[title]',
                '.jobTitle span',
                'a[data-jk] span[title]',
                '.jobTitle-color-purple span'
            ];

            // Try multiple selectors for company name
            const companySelectors = [
                '[data-testid="company-name"]',
                '.companyName',
                'span[data-testid="company-name"]',
                '.company',
                'a[data-testid="company-name"]',
                '.companyName a'
            ];

            // Try multiple selectors for location
            const locationSelectors = [
                '[data-testid="job-location"]',
                '.companyLocation',
                'div[data-testid="job-location"]',
                '.location',
                '.locationsContainer'
            ];

            // Try multiple selectors for salary
            const salarySelectors = [
                '.salary-snippet',
                '[data-testid="attribute_snippet_testid"]',
                '.estimated-salary',
                '.salaryText',
                '.salary'
            ];

            // Try multiple selectors for description
            const descriptionSelectors = [
                '.job-snippet',
                '[data-testid="job-snippet"]',
                '.summary',
                '.jobCardShelfContainer .summary'
            ];

            // Extract data using fallback selectors
            let title = '', company = '', location = '', salary = '', description = '';

            for (const selector of titleSelectors) {
                title = getText(selector);
                if (title) break;
            }

            for (const selector of companySelectors) {
                company = getText(selector);
                if (company) break;
            }

            for (const selector of locationSelectors) {
                location = getText(selector);
                if (location) break;
            }

            for (const selector of salarySelectors) {
                salary = getText(selector);
                if (salary) break;
            }

            for (const selector of descriptionSelectors) {
                description = getText(selector);
                if (description) break;
            }

            // Extract job ID and link
            const jobId = getAttr('', 'data-jk') || getAttr('[data-jk]', 'data-jk');
            const jobLink = getAttr('h2 a', 'href') ||
                           getAttr('[data-testid="job-title"] a', 'href') ||
                           getAttr('.jobTitle a', 'href') ||
                           getAttr('a[data-jk]', 'href');

            // Extract additional metadata
            const postedDate = getText('.date') || getText('[data-testid="myJobsStateDate"]');
            const jobType = getText('.jobMetadata') || getText('.jobsearch-JobMetadataHeader');

            return {
                title: title || 'No title found',
                company: company || 'No company found',
                location: location || 'No location found',
                salary: salary || '',
                description: description || '',
                jobId: jobId || '',
                jobLink: jobLink ? `https://www.indeed.com${jobLink}` : '',
                postedDate: postedDate || '',
                jobType: jobType || '',
                source: 'Indeed Direct',
                scrapedAt: new Date().toISOString(),
                // Debug info
                elementHTML: element.outerHTML.substring(0, 200)
            };
        }, jobElement);

        return jobData;
    } catch (error) {
        console.error('Error extracting Indeed job data:', error);
        return null;
    }
}

/**
 * Wait for Indeed page to load and handle any popups/overlays
 * @param {Object} page - Puppeteer page object
 */
async function handleIndeedPageLoad(page) {
    try {
        // Wait for job results to load
        await page.waitForSelector('[data-jk], .job_seen_beacon', { 
            timeout: 30000,
            visible: true 
        });

        // Handle common Indeed popups/overlays
        const popupSelectors = [
            '[data-testid="modal-close-button"]',
            '.pn-CloseButton',
            '.popover-x-button',
            '[aria-label="close"]',
            '.icl-CloseButton'
        ];

        for (const selector of popupSelectors) {
            try {
                const popup = await page.$(selector);
                if (popup) {
                    await popup.click();
                    await page.waitForTimeout(1000);
                }
            } catch (e) {
                // Ignore popup handling errors
            }
        }

        // Scroll to load more jobs if needed
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
        });

        await page.waitForTimeout(2000);

    } catch (error) {
        console.warn('Page load handling warning:', error.message);
    }
}

/**
 * Main Indeed scraping function with human-like interaction
 * @param {Array} searchTasks - Array of search tasks to perform
 * @param {Object} options - Scraping options
 * @returns {Array} Array of job objects
 */
async function scrapeIndeedJobs(searchTasks, options = {}) {
    const {
        maxConcurrency = 1, // Use 1 to avoid Cloudflare detection
        useProxy = true,
        headless = true
    } = options;

    console.log(`🚀 Starting Indeed scraping for ${searchTasks.length} search tasks...`);
    console.log(`🛡️  Human-like interaction mode: concurrency=${maxConcurrency}, proxy=${useProxy}`);

    const allJobs = [];
    let processedUrls = 0;
    let failedUrls = 0;

    const crawler = new PuppeteerCrawler({
        // Use Apify proxy for anti-bot protection
        proxyConfiguration: useProxy ? await Actor.createProxyConfiguration({
            groups: ['RESIDENTIAL'],
            countryCode: 'US'
        }) : undefined,

        launchContext: {
            launchOptions: {
                headless: headless === false ? false : 'new', // Use new headless mode
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-web-security',
                    '--disable-features=site-per-process',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-ipc-flooding-protection',
                    '--disable-hang-monitor',
                    '--disable-client-side-phishing-detection',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-sync',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update',
                    '--enable-automation',
                    '--password-store=basic',
                    '--use-mock-keychain'
                ],
                // Explicitly set executable path for Apify environment
                executablePath: process.env.APIFY_CHROME_EXECUTABLE_PATH || undefined,
                // Additional stealth options
                ignoreDefaultArgs: ['--enable-automation'],
                ignoreHTTPSErrors: true
            }
        },

        maxConcurrency,

        async requestHandler({ page, request }) {
            const task = request.userData;
            console.log(`📄 Processing search task ${++processedUrls}/${searchTasks.length}: "${task.jobType}" (page ${task.pageNumber + 1})`);

            // Handle warmup request differently
            if (task?.isWarmup) {
                console.log('🔥 Warming up session...');
                try {
                    await page.goto('https://www.indeed.com', {
                        waitUntil: 'networkidle2',
                        timeout: 30000
                    });
                    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
                    console.log('✅ Session warmed up successfully');
                } catch (error) {
                    console.log('⚠️  Warmup failed:', error.message);
                }
                return; // Don't scrape data from warmup
            }

            try {
                // Enhanced stealth setup for each page (2025 techniques)
                await page.evaluateOnNewDocument(() => {
                    // Remove webdriver property completely
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });

                    // Mock realistic plugins array
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [
                            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                            { name: 'Native Client', filename: 'internal-nacl-plugin' }
                        ],
                    });

                    // Mock languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });

                    // Mock permissions
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );

                    // Remove automation indicators
                    delete window.chrome.runtime.onConnect;
                    delete window.chrome.runtime.onMessage;

                    // Mock chrome object
                    window.chrome = {
                        runtime: {},
                        loadTimes: function() {},
                        csi: function() {},
                        app: {}
                    };
                });

                // Set realistic headers and user agent for Cloudflare bypass
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'max-age=0',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'Referer': 'https://www.google.com/'
                });

                // Remove automation indicators
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });

                    // Remove chrome automation indicators
                    delete window.chrome.runtime.onConnect;
                    delete window.chrome.runtime.onMessage;

                    // Mock plugins
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });

                    // Mock languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en'],
                    });
                });

                // Perform human-like search interaction
                if (task.isFirstPage) {
                    // For first page, perform search via homepage
                    const searchSuccess = await performIndeedSearch(page, task.jobType, task.location, task.salaryMin);
                    if (!searchSuccess) {
                        console.log('❌ Failed to perform search, skipping task');
                        failedUrls++;
                        return;
                    }
                } else {
                    // For subsequent pages, navigate to next page using pagination
                    console.log(`🔄 Navigating to page ${task.pageNumber + 1} for "${task.jobType}"`);

                    // Look for "Next" button or page number
                    try {
                        const nextButton = await page.$('a[aria-label="Next Page"]') ||
                                         await page.$('a[aria-label="Next"]') ||
                                         await page.$('.np:last-child a');

                        if (nextButton) {
                            await nextButton.click();
                            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                        } else {
                            console.log('❌ No next page button found, skipping');
                            failedUrls++;
                            return;
                        }
                    } catch (error) {
                        console.log('❌ Error navigating to next page:', error.message);
                        failedUrls++;
                        return;
                    }
                }

                // Handle Cloudflare challenge
                const cloudflareSuccess = await handleCloudflareChallenge(page);
                if (!cloudflareSuccess) {
                    console.log('❌ Failed to bypass Cloudflare, skipping URL');
                    failedUrls++;
                    return;
                }

                // Wait for job results to load
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Look for job elements using multiple selectors
                const jobSelectors = [
                    '[data-jk]',
                    '.job_seen_beacon',
                    '.slider_container .slider_item',
                    '.jobsearch-SerpJobCard',
                    '.result'
                ];

                let jobElements = [];
                let usedSelector = '';

                for (const selector of jobSelectors) {
                    try {
                        const elements = await page.$$(selector);
                        if (elements.length > 0) {
                            console.log(`✅ Found ${elements.length} jobs with selector: ${selector}`);
                            jobElements = elements;
                            usedSelector = selector;
                            break;
                        }
                    } catch (e) {
                        console.log(`⚠️  Error with selector ${selector}: ${e.message}`);
                    }
                }

                if (jobElements.length === 0) {
                    console.log('❌ No job elements found on page');
                    failedUrls++;
                    return;
                }

                // Extract job data
                const pageJobs = [];
                for (let i = 0; i < jobElements.length; i++) {
                    try {
                        const jobData = await extractIndeedJobData(page, jobElements[i]);

                        if (jobData && jobData.title !== 'No title found' && jobData.company !== 'No company found') {
                            // Apply filtering logic
                            const exclusionCheck = shouldExcludeCompany(jobData.company);
                            if (exclusionCheck.isExcluded) {
                                console.log(`🚫 Excluding job at ${exclusionCheck.reason}: ${jobData.company}`);
                                continue;
                            }

                            if (isSalaryCompanyName(jobData.company)) {
                                console.log(`🚫 Excluding job with salary-like company name: ${jobData.company}`);
                                continue;
                            }

                            pageJobs.push(jobData);
                        }
                    } catch (error) {
                        console.error(`❌ Error extracting job ${i + 1}:`, error.message);
                    }
                }

                console.log(`✅ Extracted ${pageJobs.length} valid jobs from page`);
                allJobs.push(...pageJobs);

                // Add longer delay between requests to avoid rate limiting
                const delay = 5000 + Math.random() * 5000; // 5-10 seconds
                console.log(`⏱️  Waiting ${Math.round(delay/1000)}s before next request...`);
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (error) {
                console.error(`❌ Error processing URL ${request.url}:`, error.message);
                failedUrls++;
            }
        },

        failedRequestHandler({ request, error }) {
            console.error(`❌ Request failed: ${request.url}`, error.message);
            failedUrls++;
        }
    });

    // Add warmup task
    console.log('🔥 Adding session warmup task...');
    await crawler.addRequests([{
        url: 'https://www.indeed.com',
        userData: { isWarmup: true }
    }]);

    // Add all search tasks to the crawler
    await crawler.addRequests(searchTasks.map((task, index) => ({
        url: `https://www.indeed.com/search-task-${index}`, // Dummy URL for task identification
        userData: task
    })));

    // Run the crawler
    await crawler.run();

    console.log(`🏁 Scraping completed!`);
    console.log(`📊 Total jobs found: ${allJobs.length}`);
    console.log(`✅ Successful URLs: ${processedUrls - failedUrls}`);
    console.log(`❌ Failed URLs: ${failedUrls}`);

    return allJobs;
}

/**
 * Simple test function to scrape a few Indeed jobs
 * @param {Object} testParams - Test parameters
 * @returns {Array} Array of test job results
 */
async function testIndeedScraping(testParams = {}) {
    const {
        jobTypes = ['restaurant manager'],
        location = 'United States',
        salaryMin = 55000,
        maxPages = 2
    } = testParams;

    console.log('🧪 Running Indeed scraping test...');

    const urls = createIndeedSearchUrls({
        jobTypes,
        location,
        salaryMin,
        maxPages
    });

    console.log(`📋 Testing with ${urls.length} URLs`);

    const jobs = await scrapeIndeedJobs(urls, {
        maxConcurrency: 1,
        useProxy: false, // Disable proxy for testing
        headless: true
    });

    console.log(`🎯 Test completed! Found ${jobs.length} jobs`);

    // Show sample results
    if (jobs.length > 0) {
        console.log('\n📝 Sample job results:');
        jobs.slice(0, 3).forEach((job, index) => {
            console.log(`\n${index + 1}. ${job.title}`);
            console.log(`   Company: ${job.company}`);
            console.log(`   Location: ${job.location}`);
            console.log(`   Salary: ${job.salary || 'Not specified'}`);
            console.log(`   Job ID: ${job.jobId || 'Not found'}`);
        });
    }

    return jobs;
}

export {
    createIndeedSearchTasks,
    performIndeedSearch,
    scrapeIndeedJobs,
    extractIndeedJobData,
    handleCloudflareChallenge,
    testIndeedScraping
};
