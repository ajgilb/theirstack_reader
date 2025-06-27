import fetch from 'node-fetch';

async function investigateAPI() {
  console.log('🔍 Comprehensive RapidAPI Investigation...');
  
  const apiKey = '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
  const apiUrl = 'https://jobs-search-api.p.rapidapi.com/getjobs';
  
  // Test 1: Check response structure for total count
  console.log('\n📊 TEST 1: Checking response structure for total count info');
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        search_term: 'restaurant manager',
        location: 'United States',
        results_wanted: 10,
        site_name: ['indeed']
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Full response structure:');
      console.log('📋 Top-level keys:', Object.keys(data));
      
      if (data.jobs) {
        console.log('📊 Jobs array length:', data.jobs.length);
        console.log('📋 First job keys:', Object.keys(data.jobs[0] || {}));
      }
      
      // Look for total count indicators
      const possibleCountFields = ['total', 'total_results', 'count', 'total_count', 'available', 'found'];
      possibleCountFields.forEach(field => {
        if (data[field] !== undefined) {
          console.log(`🎯 Found count field "${field}":`, data[field]);
        }
      });
      
      console.log('📄 Full response sample:', JSON.stringify(data, null, 2).substring(0, 1000) + '...');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 2: Try different job board combinations
  console.log('\n🌐 TEST 2: Testing different job board names');
  const jobBoards = [
    ['indeed'],
    ['linkedin'], 
    ['zip_recruiter'],
    ['glassdoor'],
    ['monster'],
    ['careerbuilder'],
    ['dice'],
    ['simplyhired'],
    ['ziprecruiter'], // alternative spelling
    ['indeed', 'linkedin', 'glassdoor', 'zip_recruiter'], // current combo
    ['indeed', 'linkedin', 'glassdoor', 'zip_recruiter', 'monster', 'careerbuilder'] // expanded
  ];
  
  for (let i = 0; i < Math.min(jobBoards.length, 3); i++) { // Test first 3 to avoid rate limits
    const boards = jobBoards[i];
    console.log(`\n🔍 Testing job boards: ${boards.join(', ')}`);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          search_term: 'chef',
          location: 'United States',
          results_wanted: 10,
          site_name: boards
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${boards.join(', ')}: ${data.jobs?.length || 0} jobs returned`);
        
        if (data.jobs?.length > 0) {
          // Check which job boards are actually represented
          const sources = new Set();
          data.jobs.forEach(job => {
            if (job.job_url) {
              if (job.job_url.includes('indeed.com')) sources.add('indeed');
              if (job.job_url.includes('linkedin.com')) sources.add('linkedin');
              if (job.job_url.includes('glassdoor.com')) sources.add('glassdoor');
              if (job.job_url.includes('ziprecruiter.com')) sources.add('ziprecruiter');
              if (job.job_url.includes('monster.com')) sources.add('monster');
              if (job.job_url.includes('careerbuilder.com')) sources.add('careerbuilder');
            }
          });
          console.log(`📊 Actual sources found: ${Array.from(sources).join(', ')}`);
        }
      } else {
        console.log(`❌ ${boards.join(', ')}: Failed with status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${boards.join(', ')}: Error - ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 Investigation complete!');
  console.log('\n📋 Summary Questions:');
  console.log('1. Does API provide total count? Check above for count fields');
  console.log('2. Which job boards work? Check source analysis above');
  console.log('3. Can we get more than ~100 jobs? Test with different parameters');
}

investigateAPI();
