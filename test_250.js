import fetch from 'node-fetch';

async function test250() {
  console.log('🔍 Testing 250 jobs request...');
  
  const apiKey = '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
  const apiUrl = 'https://jobs-search-api.p.rapidapi.com/getjobs';
  
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
        results_wanted: 250,
        site_name: ['indeed', 'linkedin', 'zip_recruiter', 'glassdoor']
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Jobs returned:', data.jobs?.length || 0);
      console.log('🎯 Success! 250 works without hanging');
    } else {
      console.log('❌ Request failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

test250();
