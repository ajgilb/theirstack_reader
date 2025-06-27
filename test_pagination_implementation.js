import { scrapeJobsWithAPI } from './src/job_search_api.js';

async function testPagination() {
    console.log('🧪 Testing Job Search API Pagination Implementation...\n');
    
    // Test with a single job type and limited pages to see pagination in action
    const testOptions = {
        jobTypes: ['restaurant manager'],
        location: 'United States',
        salaryMin: 55000,
        testMode: false,
        maxPagesPerSearch: 3 // Test with 3 pages max
    };
    
    console.log('📋 Test Configuration:');
    console.log(`   Job Types: ${testOptions.jobTypes.join(', ')}`);
    console.log(`   Location: ${testOptions.location}`);
    console.log(`   Max Pages: ${testOptions.maxPagesPerSearch}`);
    console.log(`   Expected Max Jobs: ${testOptions.maxPagesPerSearch * 100} (if all pages are full)\n`);
    
    try {
        const startTime = Date.now();
        const jobs = await scrapeJobsWithAPI(testOptions);
        const endTime = Date.now();
        
        console.log('\n🎉 Pagination Test Results:');
        console.log(`   Total Jobs Collected: ${jobs.length}`);
        console.log(`   Time Taken: ${((endTime - startTime) / 1000).toFixed(1)} seconds`);
        console.log(`   Average Jobs per Page: ${(jobs.length / testOptions.maxPagesPerSearch).toFixed(1)}`);
        
        if (jobs.length > 100) {
            console.log('✅ SUCCESS: Collected more than 100 jobs - pagination is working!');
        } else {
            console.log('⚠️  WARNING: Only collected 100 or fewer jobs - pagination may not be working');
        }
        
        // Show sample of unique job IDs to verify different jobs
        if (jobs.length > 0) {
            console.log('\n📄 Sample Job Titles (first 5):');
            jobs.slice(0, 5).forEach((job, index) => {
                console.log(`   ${index + 1}. "${job.title}" at ${job.company}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
testPagination().catch(console.error);
