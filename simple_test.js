/**
 * Simple Indeed Test Scraper
 * Basic test without Apify wrapper to see what we can extract
 */

import { PuppeteerCrawler } from 'crawlee';
import fs from 'fs';

async function simpleTest() {
    console.log('Starting simple Indeed test...');

    const testUrl = 'https://www.indeed.com/jobs?q=restaurant+manager&l=United+States';

    const crawler = new PuppeteerCrawler({
        launchContext: {
            launchOptions: {
                headless: false, // Set to false so we can see what's happening
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            }
        },

        maxConcurrency: 1,

        async requestHandler({ page, request }) {
            console.log(`Loading: ${request.url}`);

            try {
                // Wait for page to load
                await page.waitForSelector('body', { timeout: 30000 });

                const title = await page.title();
                console.log(`Page title: ${title}`);

                // Wait a bit for dynamic content
                await page.waitForTimeout(3000);

                // Take screenshot
                await page.screenshot({ path: 'test_page.png' });
                console.log('Screenshot saved');

                // Check for common Indeed job selectors
                const selectors = [
                    '[data-jk]',
                    '.job_seen_beacon',
                    '.slider_container .slider_item',
                    '.jobsearch-SerpJobCard',
                    '[data-testid="job-title"]',
                    '.jobTitle'
                ];

                for (const selector of selectors) {
                    try {
                        const elements = await page.$$(selector);
                        console.log(`Selector "${selector}": ${elements.length} elements found`);

                        if (elements.length > 0) {
                            // Try to extract data from first element
                            const firstElement = elements[0];
                            const sampleData = await page.evaluate((el) => {
                                return {
                                    innerHTML: el.innerHTML.substring(0, 200),
                                    textContent: el.textContent.substring(0, 200),
                                    tagName: el.tagName,
                                    className: el.className,
                                    id: el.id
                                };
                            }, firstElement);

                            console.log(`Sample data from ${selector}:`, sampleData);
                        }
                    } catch (e) {
                        console.log(`Error with selector ${selector}:`, e.message);
                    }
                }

                // Get page HTML for analysis
                const bodyHTML = await page.evaluate(() => document.body.innerHTML);
                fs.writeFileSync('page_source.html', bodyHTML);
                console.log('Page source saved to page_source.html');

                // Look for job-related text
                const pageText = await page.evaluate(() => document.body.textContent);
                const jobKeywords = ['restaurant', 'manager', 'chef', 'kitchen', 'culinary'];
                const foundKeywords = jobKeywords.filter(keyword =>
                    pageText.toLowerCase().includes(keyword)
                );
                console.log('Found job keywords:', foundKeywords);

                // Check if we're blocked
                if (title.includes('blocked') || title.includes('captcha') ||
                    pageText.includes('blocked') || pageText.includes('captcha')) {
                    console.log('⚠️  Appears to be blocked or captcha detected');
                }

                console.log('Test completed successfully');

            } catch (error) {
                console.error('Error during test:', error);
            }
        }
    });

    await crawler.addRequests([testUrl]);
    await crawler.run();

    console.log('Simple test finished');
}

// Run the test
simpleTest().catch(console.error);
