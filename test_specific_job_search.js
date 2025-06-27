import https from 'https';

function makeIndeedScraperRequest(requestBody) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            hostname: 'indeed-scraper-api.p.rapidapi.com',
            port: null,
            path: '/api/job',
            headers: {
                'x-rapidapi-key': process.env.RAPIDAPI_KEY || '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c',
                'x-rapidapi-host': 'indeed-scraper-api.p.rapidapi.com',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, function (res) {
            const chunks = [];

            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                const responseBody = Buffer.concat(chunks);
                try {
                    const data = JSON.parse(responseBody.toString());
                    resolve({ status: res.statusCode, data });
                } catch (error) {
                    resolve({ status: res.statusCode, data: responseBody.toString() });
                }
            });
        });

        req.on('error', reject);
        req.write(JSON.stringify(requestBody));
        req.end();
    });
}

async function searchForSpecificJob() {
    console.log('🔍 Testing Indeed Scraper API for "sous chef" jobs...');
    console.log('Looking for: "1832 Steakhouse Sous Chef" or similar');
    
    const requestBody = {
        scraper: {
            maxRows: 100,
            query: 'sous chef',
            location: 'United States',
            jobType: 'fulltime',
            radius: '100',
            sort: 'date', // Sort by date to get newest first
            fromDays: '1', // Only jobs from past 1 day
            country: 'us'
        }
    };
    
    console.log('\n📡 Request details:');
    console.log(JSON.stringify(requestBody, null, 2));
    
    try {
        const result = await makeIndeedScraperRequest(requestBody);
        
        console.log(`\n📊 API Response Status: ${result.status}`);
        
        if (result.status === 201 && result.data.returnvalue?.data) {
            const jobs = result.data.returnvalue.data;
            console.log(`✅ Found ${jobs.length} sous chef jobs`);
            
            // Look for the specific job or similar ones
            const targetJob = jobs.find(job => 
                job.title && job.title.toLowerCase().includes('1832') ||
                job.title && job.title.toLowerCase().includes('steakhouse')
            );
            
            if (targetJob) {
                console.log('\n🎯 FOUND TARGET JOB:');
                console.log(`Title: ${targetJob.title}`);
                console.log(`Company: ${targetJob.company || 'Not specified'}`);
                console.log(`Location: ${targetJob.location?.formattedAddressShort || 'Not specified'}`);
                console.log(`Salary: ${targetJob.salary?.salaryText || 'Not specified'}`);
                console.log(`URL: ${targetJob.jobUrl || targetJob.applyUrl || 'Not specified'}`);
            } else {
                console.log('\n❌ Target job "1832 Steakhouse Sous Chef" not found in results');
                
                // Show first few jobs for reference
                console.log('\n📄 Sample jobs found:');
                jobs.slice(0, 5).forEach((job, index) => {
                    console.log(`${index + 1}. "${job.title}" at ${job.company || 'Company not specified'}`);
                });
            }
            
            // Test our title parsing function
            console.log('\n🔧 Testing title parsing on results:');
            jobs.slice(0, 3).forEach(job => {
                const title = job.title || '';
                const dashIndex = title.indexOf(' - ');
                if (dashIndex > 0) {
                    const parsedTitle = title.substring(0, dashIndex).trim();
                    const parsedCompany = title.substring(dashIndex + 3).trim();
                    console.log(`Original: "${title}"`);
                    console.log(`  → Title: "${parsedTitle}"`);
                    console.log(`  → Company: "${parsedCompany}"`);
                } else {
                    console.log(`No parsing needed: "${title}"`);
                }
            });
            
        } else {
            console.log('❌ API request failed or returned no data');
            console.log('Response:', result.data);
        }
        
    } catch (error) {
        console.error('❌ Error making API request:', error.message);
    }
}

// Run the test
searchForSpecificJob().catch(console.error);
