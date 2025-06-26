import fetch from 'node-fetch';

async function testRapidAPI() {
  console.log('🔍 Testing RapidAPI Job Search directly...');
  
  const apiKey = '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
  const apiUrl = 'https://jobs-search-api.p.rapidapi.com/getjobs';
  
  const requestBody = {
    search_term: 'restaurant manager',
    location: 'United States',
    results_wanted: 10,
    site_name: ['indeed', 'linkedin'],
    is_remote: false
  };
  
  console.log('📡 Request body:', JSON.stringify(requestBody, null, 2));
  console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
  console.log('🌐 API URL:', apiUrl);
  
  try {
    console.log('🚀 Making request...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📊 Response status:', response.status, response.statusText);
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ Success! Response keys:', Object.keys(data));
    console.log('📊 Jobs found:', data.jobs ? data.jobs.length : 'No jobs array');
    
    if (data.jobs && data.jobs.length > 0) {
      console.log('🎯 First job sample:', {
        title: data.jobs[0].title,
        company: data.jobs[0].company,
        location: data.jobs[0].location,
        url: data.jobs[0].job_url
      });
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testRapidAPI();
