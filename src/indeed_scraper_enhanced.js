/**
 * Enhanced Indeed Scraper with Anti-Bot Measures
 * Based on research: residential proxies, realistic fingerprints, Cloudflare handling
 */

import { PuppeteerCrawler } from 'crawlee';
import { Actor } from 'apify';

/**
 * Enhanced Indeed scraper with anti-bot measures
 */
async function testIndeedWithAntiBot() {
    console.log('🚀 Testing Indeed with anti-bot measures...');
    
    const testUrl = 'https://www.indeed.com/jobs?q=restaurant+manager&l=United+States&salaryType=%2455%2C000&from=searchOnDesktopSerp&sort=date';
    console.log('�� Test URL:', testUrl);
    
    const crawler = new PuppeteerCrawler({
        // Use residential proxies for better success rate
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
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor',
                    '--window-size=1366,768'
                ]
            }
        },
        
        maxConcurrency: 1, // Very low to avoid rate limiting
        
        async requestHandler({ page, request }) {
            console.log('📄 Loading page with anti-bot measures...');
            
            try {
                // Set realistic user agent and headers
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                });
                
                // Set viewport to realistic size
                await page.setViewport({ width: 1366, height: 768 });
                
                // Navigate with realistic timing
                console.log('🌐 Navigating to Indeed...');
                await page.goto(request.url, { 
                    waitUntil: 'networkidle2',
                    timeout: 60000 
                });
                
                // Wait for initial load
                await page.waitForTimeout(3000);
                
                const title = await page.title();
                console.log('📋 Page title:', title);
                
                // Check for Cloudflare challenge
                if (title.includes('Just a moment') || title.includes('Cloudflare') || title.includes('Attention Required')) {
                    console.log('🛡️  Cloudflare challenge detected, waiting...');
                    
                    // Wait for Cloudflare challenge to complete
                    let attempts = 0;
                    const maxAttempts = 20;
                    
                    while (attempts < maxAttempts) {
                        await page.waitForTimeout(1000);
                        const currentTitle = await page.title();
                        
                        if (!currentTitle.includes('Just a moment') && 
                            !currentTitle.includes('Cloudflare') && 
                            !currentTitle.includes('Attention Required')) {
                            console.log('✅ Cloudflare challenge passed!');
                            break;
                        }
                        
                        attempts++;
                        console.log(`⏳ Waiting for Cloudflare... (${attempts}/${maxAttempts})`);
                    }
                    
                    if (attempts >= maxAttempts) {
                        console.log('❌ Cloudflare challenge timeout');
                        await page.screenshot({ path: 'cloudflare_timeout.png' });
                        return;
                    }
                }
                
                // Take screenshot for debugging
                await page.screenshot({ path: 'indeed_loaded.png' });
                console.log('📸 Screenshot saved');
                
                // Simulate human behavior - scroll a bit
                await page.evaluate(() => {
                    window.scrollTo(0, 200);
                });
                await page.waitForTimeout(1000);
                
                // Look for job elements
                console.log('🔍 Looking for job elements...');
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
                    
                    // Save page content for analysis
                    const html = await page.evaluate(() => document.body.innerHTML);
                    require('fs').writeFileSync('indeed_debug.html', html);
                    
                    const pageText = await page.evaluate(() => document.body.textContent);
                    console.log('📄 Page text sample:', pageText.substring(0, 500));
                    
                    return;
                }
                
                // Extract job data
                console.log(`📝 Extracting data from ${Math.min(3, jobElements.length)} jobs...`);
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
                            
                            let title = '', company = '', location = '';
                            
                            for (const sel of titleSelectors) {
                                title = getText(sel);
                                if (title) break;
                            }
                            
                            for (const sel of companySelectors) {
                                company = getText(sel);
                                if (company) break;
                            }
                            
                            for (const sel of locationSelectors) {
                                location = getText(sel);
                                if (location) break;
                            }
                            
                            return {
                                title: title || 'No title found',
                                company: company || 'No company found',
                                location: location || 'No location found',
                                salary: getText('.salary-snippet') || getText('[data-testid="attribute_snippet_testid"]'),
                                description: getText('.job-snippet') || getText('[data-testid="job-snippet"]'),
                                jobId: getAttr('', 'data-jk'),
                                jobLink: getAttr('h2 a', 'href') || getAttr('.jobTitle a', 'href')
                            };
                        }, jobElements[i]);
                        
                        jobs.push(jobData);
                        console.log(`📝 Job ${i + 1}:`, {
                            title: jobData.title,
                            company: jobData.company,
                            location: jobData.location
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
                    extracted: jobs,
                    success: true
                };
                
                require('fs').writeFileSync('indeed_enhanced_results.json', JSON.stringify(results, null, 2));
                console.log('💾 Results saved to indeed_enhanced_results.json');
                
                console.log(`🎉 Success! Found ${jobs.length} jobs`);
                
            } catch (error) {
                console.error('❌ Error:', error.message);
                await page.screenshot({ path: 'indeed_error.png' });
            }
        },
        
        failedRequestHandler({ request, error }) {
            console.error(`❌ Request failed: ${request.url}`, error.message);
        }
    });
    
    await crawler.addRequests([testUrl]);
    await crawler.run();
    
    console.log('🏁 Enhanced test completed!');
}

export { testIndeedWithAntiBot };
