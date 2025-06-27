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
  console.log('🔍 Testing Indeed API for "restaurant manager" in "united states"...');
  console.log('🔑 Using API key: 26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c');
  
  // Test the main search endpoint patterns
  const testEndpoints = [
    // Try the most likely search patterns
    '/search?query=restaurant%20manager&location=united%20states&locality=us',
    '/jobs?query=restaurant%20manager&location=united%20states&locality=us', 
    '/search?q=restaurant%20manager&l=united%20states&locality=us',
    '/jobs?q=restaurant%20manager&l=united%20states&locality=us',
    
    // Try simpler versions
    '/search?query=restaurant%20manager&locality=us',
    '/jobs?query=restaurant%20manager&locality=us',
    
    // Try root endpoint to see what's available
    '/'
  ];
  
  for (let i = 0; i < testEndpoints.length; i++) {
    const endpoint = testEndpoints[i];
    console.log(`\n📡 TEST ${i + 1}: ${endpoint}`);
    
    try {
      const result = await makeRequest(endpoint);
      console.log('📊 Status:', result.status);
      
      if (result.status === 200) {
        console.log('✅ SUCCESS! Working endpoint found!');
        
        if (typeof result.data === 'object') {
          console.log('📋 Response keys:', Object.keys(result.data));
          
          // Look for job arrays
          if (result.data.hits) {
            console.log(`🎯 Found ${result.data.hits.length} jobs in "hits" array`);
            if (result.data.hits.length > 0) {
              console.log('📄 First job:', {
                title: result.data.hits[0].title,
                company: result.data.hits[0].company,
                location: result.data.hits[0].location
              });
            }
          }
          
          if (result.data.jobs) {
            console.log(`🎯 Found ${result.data.jobs.length} jobs in "jobs" array`);
          }
          
          // Look for total count
          ['total', 'totalResults', 'count', 'totalCount'].forEach(field => {
            if (result.data[field] !== undefined) {
              console.log(`🎯 Total count "${field}":`, result.data[field]);
            }
          });
          
          console.log('📄 Full response sample:', JSON.stringify(result.data, null, 2).substring(0, 800) + '...');
          
          // Test pagination if we found jobs
          if (result.data.hits && result.data.hits.length > 0) {
            console.log('\n🔍 Testing pagination...');
            const paginationPath = endpoint + (endpoint.includes('?') ? '&start=11' : '?start=11');
            
            try {
              const pageResult = await makeRequest(paginationPath);
              if (pageResult.status === 200 && pageResult.data.hits) {
                console.log(`✅ Pagination works! Page 2 has ${pageResult.data.hits.length} jobs`);
                console.log('📄 First job from page 2:', {
                  title: pageResult.data.hits[0]?.title,
                  company: pageResult.data.hits[0]?.company
                });
              }
            } catch (pageError) {
              console.log('❌ Pagination test failed:', pageError.message);
            }
          }
          
          break; // Stop testing once we find a working endpoint
          
        } else {
          console.log('📄 Response (text):', result.data.substring(0, 300) + '...');
        }
        
      } else if (result.status === 404) {
        console.log('❌ Endpoint not found');
      } else if (result.status === 400) {
        console.log('❌ Bad request');
        if (result.data) {
          console.log('📄 Error details:', result.data);
        }
      } else {
        console.log('❌ HTTP Error:', result.status);
        if (result.data) {
          console.log('📄 Response:', result.data);
        }
      }
      
    } catch (error) {
      console.log('❌ Request failed:', error.message);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 Indeed API test complete!');
}

testIndeedAPI();
