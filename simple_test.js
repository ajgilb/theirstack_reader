import { PuppeteerCrawler } from 'crawlee';

console.log('Starting Indeed test...');

const crawler = new PuppeteerCrawler({
    launchContext: {
        launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    },
    maxConcurrency: 1,
    async requestHandler({ page, request }) {
        console.log('Loading page...');
        await page.waitForSelector('body', { timeout: 30000 });
        
        const title = await page.title();
        console.log('Page title:', title);
        
        // Look for job elements
        const jobElements = await page.$$('[data-jk]');
        console.log('Found job elements:', jobElements.length);
        
        if (jobElements.length > 0) {
            const firstJob = await page.evaluate((el) => {
                const getText = (selector) => {
                    const element = el.querySelector(selector);
                    return element ? element.textContent.trim() : '';
                };
                
                return {
                    title: getText('h2 a span') || getText('.jobTitle a span'),
                    company: getText('[data-testid="company-name"]') || getText('.companyName'),
                    location: getText('[data-testid="job-location"]') || getText('.companyLocation'),
                    salary: getText('.salary-snippet'),
                    description: getText('.job-snippet')
                };
            }, jobElements[0]);
            
            console.log('First job data:', firstJob);
        }
    }
});

await crawler.addRequests(['https://www.indeed.com/jobs?q=restaurant+manager&l=United+States']);
await crawler.run();
console.log('Test completed');
