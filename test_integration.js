import { scrapeJobsWithIndeedScraper } from './src/indeed_scraper_api.js';

async function testIntegration() {
    console.log('🔍 Testing Indeed Scraper API integration...');
    
    try {
        // Test with minimal settings
        const jobs = await scrapeJobsWithIndeedScraper({
            testMode: true,
            minSalary: 50000,
            maxCities: 2, // Just test 2 cities
            searchTerms: ['restaurant'] // Just test restaurant
        });
        
        console.log(`\n📊 Test Results:`);
        console.log(`✅ Total jobs collected: ${jobs.length}`);
        
        if (jobs.length > 0) {
            console.log(`\n📄 Sample job data structure:`);
            const sampleJob = jobs[0];
            console.log('🔍 Database fields:');
            console.log(`  title: "${sampleJob.title}"`);
            console.log(`  company: "${sampleJob.company}"`);
            console.log(`  location: "${sampleJob.location}"`);
            console.log(`  salary: "${sampleJob.salary}"`);
            console.log(`  url: "${sampleJob.url}"`);
            console.log(`  email: "${sampleJob.email}"`);
            console.log(`  domain: "${sampleJob.domain}"`);
            
            console.log('\n📧 Contact info:');
            console.log(`  emails array: ${sampleJob.emails ? sampleJob.emails.length : 0} contacts`);
            if (sampleJob.emails && sampleJob.emails.length > 0) {
                console.log(`  sample email: ${sampleJob.emails[0].email}`);
            }
            
            console.log('\n💰 Salary filtering:');
            const salaryJobs = jobs.filter(job => job.salary && job.salary.length > 0);
            const nonHourlyJobs = jobs.filter(job => job.salary_type !== 'hourly');
            console.log(`  Jobs with salary info: ${salaryJobs.length}/${jobs.length}`);
            console.log(`  Non-hourly jobs: ${nonHourlyJobs.length}/${jobs.length}`);
        }
        
        console.log('\n✅ Integration test completed successfully!');
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        console.error(error.stack);
    }
}

testIntegration();
