/**
 * Test Indeed Scraper
 * 
 * Simple test script to scrape the Indeed URL and see what data format we get
 */

import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

async function testIndeedScraping() {
    console.log('Starting Indeed test scraping...');
    
    // The URL you provided
    const testUrl = 'https://www.indeed.com/jobs?q=restaurant+manager&l=United+States&salaryType=%2455%2C000&from=searchOnDesktopSerp&vjk=ba04d760be447fda';
    
    const crawler = new PuppeteerCrawler({
        // Use Apify proxy for anti-bot protection
        proxyConfiguration: await Actor.createProxyConfiguration({
            groups: ['RESIDENTIAL'],
            countryCode: 'US'
        }),
        
        launchContext: {
            launchOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        },
        
        maxConcurrency: 1, // Keep it simple for testing
        
        async requestHandler({ page, request }) {
            console.log(`Processing: ${request.url}`);
            
            try {
                // Wait for page to load
                await page.waitForSelector('body', { timeout: 30000 });
                console.log('Page loaded successfully');
                
                // Take a screenshot for debugging
                await page.screenshot({ path: 'indeed_page.png', fullPage: false });
                console.log('Screenshot saved as indeed_page.png');
                
                // Check if we hit Cloudflare or other blocking
                const title = await page.title();
                console.log(`Page title: ${title}`);
                
                if (title.includes('Just a moment') || title.includes('Cloudflare')) {
                    console.log('Detected Cloudflare challenge, waiting...');
                    await page.waitForTimeout(10000);
                    await page.waitForSelector('body', { timeout: 30000 });
                }
                
                // Look for job cards with various selectors
                const jobSelectors = [
                    '[data-jk]',
                    '.job_seen_beacon',
                    '.slider_container .slider_item',
                    '.jobsearch-SerpJobCard',
                    '[data-testid="job-title"]'
                ];
                
                let jobElements = [];
                for (const selector of jobSelectors) {
                    try {
                        const elements = await page.$$(selector);
                        if (elements.length > 0) {
                            console.log(`Found ${elements.length} elements with selector: ${selector}`);
                            jobElements = elements;
                            break;
                        }
                    } catch (e) {
                        console.log(`Selector ${selector} not found`);
                    }
                }
                
                if (jobElements.length === 0) {
                    console.log('No job elements found, checking page content...');
                    
                    // Get page HTML for debugging
                    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
                    console.log('Page HTML length:', bodyHTML.length);
                    
                    // Look for any text that might indicate jobs
                    const pageText = await page.evaluate(() => document.body.textContent);
                    const hasJobKeywords = /restaurant|manager|chef|kitchen|culinary/i.test(pageText);
                    console.log('Page contains job keywords:', hasJobKeywords);
                    
                    // Save HTML for inspection
                    require('fs').writeFileSync('indeed_page.html', bodyHTML);
                    console.log('Page HTML saved as indeed_page.html');
                    
                    return;
                }
                
                console.log(`Found ${jobElements.length} job elements, extracting data...`);
                
                // Extract data from first few jobs for testing
                const testJobs = [];
                const maxJobs = Math.min(5, jobElements.length);
                
                for (let i = 0; i < maxJobs; i++) {
                    try {
                        const jobData = await page.evaluate((element) => {
                            // Helper function to safely get text
                            const getText = (selector, parent = element) => {
                                const el = parent.querySelector(selector);
                                return el ? el.textContent.trim() : '';
                            };
                            
                            const getAttr = (selector, attr, parent = element) => {
                                const el = parent.querySelector(selector);
                                return el ? el.getAttribute(attr) : '';
                            };
                            
                            // Try multiple selectors for each field
                            const titleSelectors = [
                                'h2 a span[title]',
                                '[data-testid="job-title"] a span',
                                '.jobTitle a span',
                                'h2 span[title]',
                                '.jobTitle span'
                            ];
                            
                            const companySelectors = [
                                '[data-testid="company-name"]',
                                '.companyName',
                                'span[data-testid="company-name"]',
                                '.company'
                            ];
                            
                            const locationSelectors = [
                                '[data-testid="job-location"]',
                                '.companyLocation',
                                'div[data-testid="job-location"]',
                                '.location'
                            ];
                            
                            let title = '';
                            let company = '';
                            let location = '';
                            
                            // Try each selector until we find data
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
                            
                            // Get additional data
                            const salary = getText('.salary-snippet') || getText('[data-testid="attribute_snippet_testid"]');
                            const description = getText('.job-snippet') || getText('[data-testid="job-snippet"]');
                            const jobId = getAttr('', 'data-jk');
                            const jobLink = getAttr('h2 a', 'href') || getAttr('[data-testid="job-title"] a', 'href');
                            
                            return {
                                title,
                                company,
                                location,
                                salary,
                                description,
                                jobId,
                                jobLink,
                                elementHTML: element.outerHTML.substring(0, 500) // First 500 chars for debugging
                            };
                        }, jobElements[i]);
                        
                        testJobs.push({
                            index: i,
                            ...jobData
                        });
                        
                        console.log(`Job ${i + 1}:`, {
                            title: jobData.title || 'NO TITLE',
                            company: jobData.company || 'NO COMPANY',
                            location: jobData.location || 'NO LOCATION'
                        });
                        
                    } catch (error) {
                        console.error(`Error extracting job ${i}:`, error);
                    }
                }
                
                // Save test results
                require('fs').writeFileSync('test_jobs.json', JSON.stringify(testJobs, null, 2));
                console.log(`Saved ${testJobs.length} test jobs to test_jobs.json`);
                
                // Also log to console for immediate viewing
                console.log('\n=== TEST RESULTS ===');
                testJobs.forEach((job, index) => {
                    console.log(`\nJob ${index + 1}:`);
                    console.log(`  Title: ${job.title || 'NOT FOUND'}`);
                    console.log(`  Company: ${job.company || 'NOT FOUND'}`);
                    console.log(`  Location: ${job.location || 'NOT FOUND'}`);
                    console.log(`  Salary: ${job.salary || 'NOT FOUND'}`);
                    console.log(`  Job ID: ${job.jobId || 'NOT FOUND'}`);
                });
                
            } catch (error) {
                console.error('Error during scraping:', error);
                
                // Save error page for debugging
                try {
                    await page.screenshot({ path: 'error_page.png' });
                    const errorHTML = await page.evaluate(() => document.body.innerHTML);
                    require('fs').writeFileSync('error_page.html', errorHTML);
                    console.log('Error page saved for debugging');
                } catch (e) {
                    console.error('Could not save error page:', e);
                }
            }
        },
        
        failedRequestHandler({ request, error }) {
            console.error(`Request failed: ${request.url}`, error);
        }
    });
    
    // Add the test URL to the queue
    await crawler.addRequests([testUrl]);
    
    // Run the crawler
    await crawler.run();
    
    console.log('Test scraping completed!');
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    Actor.main(async () => {
        await testIndeedScraping();
    });
}

export { testIndeedScraping };
