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

    console.log(`🔍 Making request to: https://indeed12.p.rapidapi.com${path}`);

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

async function testIndeedAPI() {
  console.log('🔍 Testing Indeed API with "restaurant manager" in "united states"...');
  
  // Based on the screenshots, let's try different endpoint patterns
  const testEndpoints = [
    // Try basic search patterns
    '/search?query=restaurant%20manager&location=united%20states&locality=us',
    '/jobs?query=restaurant%20manager&location=united%20states&locality=us',
    '/?query=restaurant%20manager&location=united%20states&locality=us',
    
    // Try without location parameter
    '/search?query=restaurant%20manager&locality=us',
    '/jobs?query=restaurant%20manager&locality=us',
    
    // Try the root endpoint
    '/',
    
    // Try what we saw in screenshots (company endpoint structure)
    '/search?q=restaurant%20manager&l=united%20states&locality=us'
  ];
  
  for (let i = 0; i < testEndpoints.length; i++) {
    const endpoint = testEndpoints[i];
    console.log(`\n📡 TEST ${i + 1}: ${endpoint}`);
    
    try {
      const result = await makeRequest(endpoint);
      console.log('📊 Status:', result.status);
      
      if (result.status === 200) {
        console.log('✅ SUCCESS!');
        
        if (typeof result.data === 'object') {
          console.log('📋 Response keys:', Object.keys(result.data));
          
          // Look for job data
          const jobFields = ['hits', 'jobs', 'results', 'data'];
          jobFields.forEach(field => {
            if (result.data[field]) {
              console.log(`🎯 Found jobs in "${field}":`, Array.isArray(result.data[field]) ? result.data[field].length : 'not array');
            }
          });
          
          // Look for pagination info
          const paginationFields = ['total', 'totalResults', 'count', 'totalCount', 'pages', 'hasMore', 'nextPage'];
          paginationFields.forEach(field => {
            if (result.data[field] !== undefined) {
              console.log(`🎯 Pagination "${field}":`, result.data[field]);
            }
          });
          
          console.log('📄 Sample response:', JSON.stringify(result.data, null, 2).substring(0, 500) + '...');
        } else {
          console.log('📄 Response (string):', result.data.substring(0, 200) + '...');
        }
        
        // If we found a working endpoint, test pagination
        if (result.status === 200 && result.data && (result.data.hits || result.data.jobs || result.data.results)) {
          console.log('\n🔍 Testing pagination on working endpoint...');
          const paginationEndpoint = endpoint.includes('?') ? endpoint + '&start=11' : endpoint + '?start=11';
          
          try {
            const paginationResult = await makeRequest(paginationEndpoint);
            console.log('📊 Pagination status:', paginationResult.status);
            if (paginationResult.status === 200) {
              console.log('✅ Pagination works!');
            }
          } catch (paginationError) {
            console.log('❌ Pagination error:', paginationError.message);
          }
          
          break; // Stop testing once we find a working endpoint
        }
        
      } else if (result.status === 404) {
        console.log('❌ Endpoint not found');
      } else if (result.status === 400) {
        console.log('❌ Bad request:', result.data);
      } else {
        console.log('❌ Error:', result.status, result.data);
      }
      
    } catch (error) {
      console.log('❌ Request error:', error.message);
    }
    
    // Wait between requests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 Indeed API test complete!');
}

testIndeedAPI();
