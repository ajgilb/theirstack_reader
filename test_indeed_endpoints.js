import https from 'https';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      hostname: 'indeed12.p.rapidapi.com',
      port: null,
      path: path,
      headers: {
        'x-rapidapi-key': '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c',
        'x-rapidapi-host': 'indeed12.p.rapidapi.com'
      }
    };

    const req = https.request(options, function (res) {
      const chunks = [];

      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        const body = Buffer.concat(chunks);
        try {
          const data = JSON.parse(body.toString());
          resolve({ status: res.statusCode, data });
        } catch (error) {
          resolve({ status: res.statusCode, data: body.toString() });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testIndeedEndpoints() {
  console.log('🔍 Testing Indeed API endpoints based on screenshots...');
  
  // Test the endpoints we can see from your screenshots
  const knownEndpoints = [
    // From your screenshots - these should work
    '/company/Ubisoft/jobs?locality=us&start=1',
    '/job/8a8507bee5b34497?locality=us',
    
    // Try variations for job search
    '/search/jobs?q=restaurant%20manager&l=united%20states&locality=us',
    '/api/search?q=restaurant%20manager&l=united%20states&locality=us',
    '/v1/search?q=restaurant%20manager&l=united%20states&locality=us',
    '/jobs/search?q=restaurant%20manager&l=united%20states&locality=us',
    
    // Try the structure from screenshots but with search terms
    '/search/restaurant%20manager?locality=us',
    '/query/restaurant%20manager?locality=us',
    
    // Maybe it's a POST endpoint? Let's see what GET tells us
    '/search',
    '/api',
    '/v1',
    '/help',
    '/docs'
  ];
  
  for (let i = 0; i < knownEndpoints.length; i++) {
    const endpoint = knownEndpoints[i];
    console.log(`\n📡 TEST ${i + 1}: ${endpoint}`);
    
    try {
      const result = await makeRequest(endpoint);
      console.log('📊 Status:', result.status);
      
      if (result.status === 200) {
        console.log('✅ SUCCESS!');
        
        if (typeof result.data === 'object') {
          console.log('📋 Response keys:', Object.keys(result.data));
          
          // Look for job data
          if (result.data.hits && Array.isArray(result.data.hits)) {
            console.log(`🎯 Found ${result.data.hits.length} jobs!`);
            if (result.data.hits.length > 0) {
              console.log('📄 First job:', {
                title: result.data.hits[0].title,
                company: result.data.hits[0].company,
                location: result.data.hits[0].location
              });
            }
          }
          
          console.log('📄 Response sample:', JSON.stringify(result.data, null, 2).substring(0, 600) + '...');
        } else {
          console.log('📄 Response (text):', result.data.substring(0, 300) + '...');
        }
        
      } else if (result.status === 404) {
        console.log('❌ Not found');
      } else if (result.status === 400) {
        console.log('❌ Bad request');
        if (result.data && typeof result.data === 'object') {
          console.log('📄 Error:', result.data.message || result.data);
        }
      } else if (result.status === 405) {
        console.log('⚠️ Method not allowed (might need POST instead of GET)');
      } else {
        console.log(`❌ HTTP ${result.status}`);
        if (result.data) {
          console.log('📄 Response:', typeof result.data === 'string' ? result.data.substring(0, 200) : result.data);
        }
      }
      
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log('\n🏁 Endpoint discovery complete!');
  console.log('\n💡 Based on your screenshots, this API might only support:');
  console.log('   - Company-specific job searches: /company/{company_name}/jobs');
  console.log('   - Individual job details: /job/{job_id}');
  console.log('   - But NOT general job search across all companies');
}

testIndeedEndpoints();
