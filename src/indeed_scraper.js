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
 * Create Indeed search URLs with proper parameters
 * @param {Object} params - Search parameters
 * @returns {Array} Array of Indeed URLs
 */
function createIndeedSearchUrls(params = {}) {
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

    const baseUrl = 'https://www.indeed.com/jobs';
    const urls = [];

    jobTypes.forEach(jobType => {
        // Create URLs for multiple pages per job type
        for (let page = 0; page < maxPages; page++) {
            const searchParams = new URLSearchParams({
                q: jobType,
                l: location,
                salaryType: `$${salaryMin.toLocaleString()}`,
                from: 'searchOnDesktopSerp',
                sort: 'date',
                start: page * 10 // Indeed shows 10 jobs per page
            });

            urls.push(`${baseUrl}?${searchParams.toString()}`);
        }
    });

    return urls;
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

        // Check if we hit Cloudflare
        if (title.includes('Just a moment') || title.includes('Cloudflare') || title.includes('Attention Required')) {
            console.log('🛡️  Cloudflare challenge detected, waiting...');

            // Wait for Cloudflare challenge to complete (up to 20 seconds)
            let attempts = 0;
            const maxAttempts = 20;

            while (attempts < maxAttempts) {
                await page.waitForTimeout(1000);
                const currentTitle = await page.title();

                if (!currentTitle.includes('Just a moment') &&
                    !currentTitle.includes('Cloudflare') &&
                    !currentTitle.includes('Attention Required')) {
                    console.log('✅ Cloudflare challenge passed!');
                    return true;
                }

                attempts++;
                console.log(`⏳ Waiting for Cloudflare... (${attempts}/${maxAttempts})`);
            }

            console.log('❌ Cloudflare challenge timeout');
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
 * Main Indeed scraping function with Cloudflare bypass
 * @param {Array} urls - Array of Indeed URLs to scrape
 * @param {Object} options - Scraping options
 * @returns {Array} Array of job objects
 */
async function scrapeIndeedJobs(urls, options = {}) {
    const {
        maxConcurrency = 2, // Keep low to avoid rate limiting
        useProxy = true,
        headless = true
    } = options;

    console.log(`🚀 Starting Indeed scraping for ${urls.length} URLs...`);

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
                headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-web-security',
                    '--disable-features=site-per-process',
                    '--single-process',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ],
                // Explicitly set executable path for Apify environment
                executablePath: process.env.APIFY_CHROME_EXECUTABLE_PATH || undefined
            }
        },

        maxConcurrency,

        async requestHandler({ page, request }) {
            console.log(`📄 Processing URL ${++processedUrls}/${urls.length}: ${request.url}`);

            try {
                // Set realistic headers and user agent
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                });

                // Navigate to page
                await page.goto(request.url, {
                    waitUntil: 'networkidle2',
                    timeout: 60000
                });

                // Handle Cloudflare challenge
                const cloudflareSuccess = await handleCloudflareChallenge(page);
                if (!cloudflareSuccess) {
                    console.log('❌ Failed to bypass Cloudflare, skipping URL');
                    failedUrls++;
                    return;
                }

                // Wait for job results to load
                await page.waitForTimeout(3000);

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

                // Add delay between requests to be respectful
                await page.waitForTimeout(2000 + Math.random() * 3000);

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

    // Add all URLs to the crawler
    await crawler.addRequests(urls.map(url => ({ url })));

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
    createIndeedSearchUrls,
    scrapeIndeedJobs,
    extractIndeedJobData,
    handleCloudflareChallenge,
    testIndeedScraping
};
