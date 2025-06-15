/**
 * Simple Indeed Direct Scraper for Testing
 */

import { PuppeteerCrawler } from 'crawlee';
import { shouldExcludeCompany, isSalaryCompanyName } from './bing_search_api.js';

/**
 * Create Indeed search URLs
 */
function createIndeedUrls(params = {}) {
    const {
        location = 'United States',
        salaryMin = 55000,
        jobTypes = ['restaurant manager']
    } = params;

    const baseUrl = 'https://www.indeed.com/jobs';
    const urls = [];

    jobTypes.forEach(jobType => {
        const searchParams = new URLSearchParams({
            q: jobType,
            l: location,
            salaryType: `$${salaryMin.toLocaleString()}`,
            from: 'searchOnDesktopSerp',
            sort: 'date'
        });

        urls.push(`${baseUrl}?${searchParams.toString()}`);
    });

    return urls;
}

/**
 * Simple Indeed scraper test
 */
async function testIndeedScraper() {
    console.log('🚀 Testing Indeed scraper...');
    
    const urls = createIndeedUrls({
        jobTypes: ['restaurant manager'],
        location: 'United States',
        salaryMin: 55000
    });
    
    console.log('📋 Test URL:', urls[0]);
    
    const crawler = new PuppeteerCrawler({
        launchContext: {
            launchOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
        maxConcurrency: 1,
        
        async requestHandler({ page, request }) {
            console.log('📄 Loading page...');
            
            try {
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                await page.goto(request.url, { 
                    waitUntil: 'networkidle2',
                    timeout: 60000 
                });
                
                const title = await page.title();
                console.log('📋 Page title:', title);
                
                // Check for Cloudflare
                if (title.includes('Just a moment') || title.includes('Cloudflare')) {
                    console.log('🛡️  Cloudflare detected, waiting...');
                    await page.waitForTimeout(10000);
                }
                
                // Take screenshot for debugging
                await page.screenshot({ path: 'indeed_test.png' });
                console.log('📸 Screenshot saved');
                
                // Look for job elements
                const jobSelectors = [
                    '[data-jk]',
                    '.job_seen_beacon',
                    '.slider_container .slider_item',
                    '.jobsearch-SerpJobCard'
                ];
                
                let jobElements = [];
                let usedSelector = '';
                
                for (const selector of jobSelectors) {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        console.log(`✅ Found ${elements.length} jobs with: ${selector}`);
                        jobElements = elements;
                        usedSelector = selector;
                        break;
                    } else {
                        console.log(`❌ No jobs with: ${selector}`);
                    }
                }
                
                if (jobElements.length === 0) {
                    console.log('❌ No job elements found');
                    const html = await page.evaluate(() => document.body.innerHTML);
                    require('fs').writeFileSync('indeed_debug.html', html);
                    console.log('💾 Page HTML saved for debugging');
                    return;
                }
                
                // Extract first few jobs
                const jobs = [];
                const maxJobs = Math.min(3, jobElements.length);
                
                for (let i = 0; i < maxJobs; i++) {
                    try {
                        const jobData = await page.evaluate((element) => {
                            const getText = (sel, parent = element) => {
                                const el = parent.querySelector(sel);
                                return el ? el.textContent.trim() : '';
                            };
                            
                            const getAttr = (sel, attr, parent = element) => {
                                const el = parent.querySelector(sel);
                                return el ? el.getAttribute(attr) : '';
                            };
                            
                            return {
                                title: getText('h2 a span') || getText('.jobTitle a span') || getText('[data-testid="job-title"] span'),
                                company: getText('[data-testid="company-name"]') || getText('.companyName'),
                                location: getText('[data-testid="job-location"]') || getText('.companyLocation'),
                                salary: getText('.salary-snippet') || getText('[data-testid="attribute_snippet_testid"]'),
                                description: getText('.job-snippet') || getText('[data-testid="job-snippet"]'),
                                jobId: getAttr('', 'data-jk'),
                                jobLink: getAttr('h2 a', 'href') || getAttr('.jobTitle a', 'href')
                            };
                        }, jobElements[i]);
                        
                        jobs.push(jobData);
                        console.log(`📝 Job ${i + 1}:`, {
                            title: jobData.title || 'NO TITLE',
                            company: jobData.company || 'NO COMPANY',
                            location: jobData.location || 'NO LOCATION'
                        });
                        
                    } catch (error) {
                        console.error(`❌ Error extracting job ${i + 1}:`, error.message);
                    }
                }
                
                // Save results
                const results = {
                    url: request.url,
                    timestamp: new Date().toISOString(),
                    selectorUsed: usedSelector,
                    totalFound: jobElements.length,
                    extracted: jobs
                };
                
                require('fs').writeFileSync('indeed_test_results.json', JSON.stringify(results, null, 2));
                console.log('💾 Results saved to indeed_test_results.json');
                
            } catch (error) {
                console.error('❌ Error:', error.message);
                await page.screenshot({ path: 'indeed_error.png' });
            }
        }
    });
    
    await crawler.addRequests(urls);
    await crawler.run();
    
    console.log('🏁 Test completed!');
}

export { createIndeedUrls, testIndeedScraper };
