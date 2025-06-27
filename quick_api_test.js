import fetch from 'node-fetch';

async function quickAPITest() {
  console.log('🔍 Quick RapidAPI test - checking pagination behavior...');
  
  const apiKey = '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
  const apiUrl = 'https://jobs-search-api.p.rapidapi.com/getjobs';
  
  // Test 1: Basic request
  console.log('\n📡 TEST 1: Basic request (50 jobs)');
  try {
    const response1 = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        search_term: 'restaurant manager',
        location: 'United States',
        results_wanted: 50,
        site_name: ['indeed', 'linkedin']
      })
    });
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ Jobs returned:', data1.jobs?.length || 0);
      if (data1.jobs?.length > 0) {
        console.log('🎯 First job URL:', data1.jobs[0].job_url?.substring(0, 60) + '...');
      }
    } else {
      console.log('❌ Request failed:', response1.status);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n⏱️ Waiting 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 2: Same request with offset (pagination)
  console.log('\n📡 TEST 2: Same request with offset=50');
  try {
    const response2 = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        search_term: 'restaurant manager',
        location: 'United States',
        results_wanted: 50,
        offset: 50,
        site_name: ['indeed', 'linkedin']
      })
    });
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('✅ Jobs returned:', data2.jobs?.length || 0);
      if (data2.jobs?.length > 0) {
        console.log('🎯 First job URL:', data2.jobs[0].job_url?.substring(0, 60) + '...');
      }
    } else {
      console.log('❌ Request failed:', response2.status);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n🏁 Test complete!');
}

quickAPITest();
