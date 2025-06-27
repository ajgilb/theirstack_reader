import fetch from 'node-fetch';

async function testAPI() {
    console.log('🔍 Testing Indeed Scraper API...');
    
    const apiKey = '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
    const apiUrl = 'https://indeed-scraper-api.p.rapidapi.com/api/job';
    
    const requestBody = {
        scraper: {
            maxRows: 20,
            query: 'sous chef',
            location: 'United States',
            jobType: 'fulltime',
            radius: '50',
            sort: 'date',
            fromDays: '1',
            country: 'us'
        }
    };
    
    console.log('📡 Making API request...');
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': 'indeed-scraper-api.p.rapidapi.com',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log(`📊 Response Status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ Error Response:', errorText);
            return;
        }
        
        const data = await response.json();
        console.log('✅ API Response received');
        
        if (data.returnvalue?.data) {
            const jobs = data.returnvalue.data;
            console.log(`📋 Found ${jobs.length} sous chef jobs`);
            
            // Look for jobs with "1832" or "steakhouse"
            const targetJobs = jobs.filter(job => 
                job.title && (
                    job.title.toLowerCase().includes('1832') ||
                    job.title.toLowerCase().includes('steakhouse')
                )
            );
            
            if (targetJobs.length > 0) {
                console.log(`\n🎯 Found ${targetJobs.length} matching job(s):`);
                targetJobs.forEach(job => {
                    console.log(`- "${job.title}"`);
                    console.log(`  Company: ${job.company || 'Not specified'}`);
                    console.log(`  Location: ${job.location?.formattedAddressShort || 'Not specified'}`);
                });
            } else {
                console.log('\n❌ No jobs found with "1832" or "steakhouse"');
            }
            
            // Show first 5 jobs as sample
            console.log('\n📄 Sample jobs found:');
            jobs.slice(0, 5).forEach((job, index) => {
                console.log(`${index + 1}. "${job.title}"`);
                console.log(`   Company: ${job.company || 'Not specified'}`);
                console.log(`   Location: ${job.location?.formattedAddressShort || 'Not specified'}`);
            });
            
        } else {
            console.log('❌ No job data in response');
            console.log('Response structure:', Object.keys(data));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testAPI();
