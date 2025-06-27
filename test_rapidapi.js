import fetch from 'node-fetch';

async function testRapidAPI() {
  console.log('🔍 Testing RapidAPI Job Search with different parameters...');

  const apiKey = '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c';
  const apiUrl = 'https://jobs-search-api.p.rapidapi.com/getjobs';

  // Test different scenarios
  const testCases = [
    {
      name: 'Small request (10 jobs)',
      body: {
        search_term: 'restaurant manager',
        location: 'United States',
        results_wanted: 10,
        site_name: ['indeed', 'linkedin'],
        is_remote: false
      }
    },
    {
      name: 'Medium request (50 jobs)',
      body: {
        search_term: 'restaurant manager',
        location: 'United States',
        results_wanted: 50,
        site_name: ['indeed', 'linkedin', 'zip_recruiter', 'glassdoor'],
        is_remote: false
      }
    },
    {
      name: 'Large request (1000 jobs)',
      body: {
        search_term: 'restaurant manager',
        location: 'United States',
        results_wanted: 1000,
        site_name: ['indeed', 'linkedin', 'zip_recruiter', 'glassdoor'],
        is_remote: false
      }
    },
    {
      name: 'Pagination test (offset=50)',
      body: {
        search_term: 'restaurant manager',
        location: 'United States',
        results_wanted: 50,
        offset: 50,
        page: 2,
        site_name: ['indeed', 'linkedin', 'zip_recruiter', 'glassdoor'],
        is_remote: false
      }
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 TEST ${i + 1}: ${testCase.name}`);
    console.log('📡 Request body:', JSON.stringify(testCase.body, null, 2));

    try {
      console.log('🚀 Making request...');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'jobs-search-api.p.rapidapi.com',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.body)
      });

      console.log('📊 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        continue;
      }

      const data = await response.json();
      console.log('✅ Success! Jobs returned:', data.jobs ? data.jobs.length : 'No jobs array');

      if (data.jobs && data.jobs.length > 0) {
        console.log('🎯 First job:', {
          title: data.jobs[0].title,
          company: data.jobs[0].company,
          url: data.jobs[0].job_url ? data.jobs[0].job_url.substring(0, 50) + '...' : 'No URL'
        });

        if (data.jobs.length > 1) {
          console.log('🎯 Last job:', {
            title: data.jobs[data.jobs.length - 1].title,
            company: data.jobs[data.jobs.length - 1].company,
            url: data.jobs[data.jobs.length - 1].job_url ? data.jobs[data.jobs.length - 1].job_url.substring(0, 50) + '...' : 'No URL'
          });
        }
      }

      // Wait between requests to respect rate limits
      if (i < testCases.length - 1) {
        console.log('⏱️ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error('❌ Request failed:', error.message);
    }
  }
}

testRapidAPI();
