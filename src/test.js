/**
 * Test Indeed Direct Scraping
 */

import { testIndeedScraping, createIndeedSearchUrls } from './indeed_scraper.js';
import fs from 'fs';

async function runIndeedTest() {
    console.log('🚀 Testing Indeed direct scraping...');

    try {
        // Test with a simple configuration
        const jobs = await testIndeedScraping({
            jobTypes: ['restaurant manager'],
            location: 'United States',
            salaryMin: 55000,
            maxPages: 1 // Just test 1 page first
        });

        // Save results to file
        const results = {
            timestamp: new Date().toISOString(),
            totalJobs: jobs.length,
            jobs: jobs
        };

        fs.writeFileSync('indeed_test_results.json', JSON.stringify(results, null, 2));
        console.log('💾 Results saved to indeed_test_results.json');

        // Show URL structure for reference
        const sampleUrls = createIndeedSearchUrls({
            jobTypes: ['restaurant manager'],
            location: 'United States',
            salaryMin: 55000,
            maxPages: 1
        });

        console.log('\n📋 Sample URL structure:');
        console.log(sampleUrls[0]);

        return jobs;

    } catch (error) {
        console.error('❌ Test failed:', error);
        return [];
    }
}
// Run the test
runIndeedTest().catch(console.error);
