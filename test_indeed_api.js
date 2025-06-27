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

async function testIndeedAPI() {
  console.log('🔍 Testing Indeed API (indeed12.p.rapidapi.com)...');
  
  // Test 1: Try to find the correct endpoint
  console.log('\n📡 TEST 1: Testing different endpoint paths');

  const testPaths = [
    '/search?query=restaurant%20manager&locality=us',
    '/?query=restaurant%20manager&locality=us',
    '/job/search?query=restaurant%20manager&locality=us',
    '/api/jobs?query=restaurant%20manager&locality=us'
  ];

  for (const path of testPaths) {
    console.log(`\n🔍 Trying path: ${path}`);
    try {
      const result = await makeRequest(path);
    console.log('📊 Status:', result1.status);
    
    if (result1.status === 200 && result1.data) {
      console.log('✅ Success! Response keys:', Object.keys(result1.data));
      
      if (result1.data.hits) {
        console.log('📊 Jobs found:', result1.data.hits.length);
        console.log('🎯 First job sample:', {
          title: result1.data.hits[0]?.title,
          company: result1.data.hits[0]?.company,
          location: result1.data.hits[0]?.location
        });
        
        // Look for pagination info
        const paginationFields = ['total', 'totalResults', 'count', 'totalCount', 'pages', 'hasMore', 'nextPage'];
        paginationFields.forEach(field => {
          if (result1.data[field] !== undefined) {
            console.log(`🎯 Found pagination field "${field}":`, result1.data[field]);
          }
        });
      }
      
      console.log('📄 Full response structure:', JSON.stringify(result1.data, null, 2).substring(0, 800) + '...');
    } else {
      console.log('❌ Failed:', result1.data);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 2: Test pagination
  console.log('\n📡 TEST 2: Testing pagination with start=11');
  try {
    const result2 = await makeRequest('/jobs?query=restaurant%20manager&locality=us&start=11');
    console.log('📊 Status:', result2.status);
    
    if (result2.status === 200 && result2.data?.hits) {
      console.log('✅ Pagination test - Jobs found:', result2.data.hits.length);
      console.log('🎯 First job from page 2:', {
        title: result2.data.hits[0]?.title,
        company: result2.data.hits[0]?.company
      });
    } else {
      console.log('❌ Pagination failed:', result2.data);
    }
  } catch (error) {
    console.log('❌ Pagination error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 3: Test different search terms
  console.log('\n📡 TEST 3: Testing "executive chef" search');
  try {
    const result3 = await makeRequest('/jobs?query=executive%20chef&locality=us');
    console.log('📊 Status:', result3.status);
    
    if (result3.status === 200 && result3.data?.hits) {
      console.log('✅ Executive chef search - Jobs found:', result3.data.hits.length);
    } else {
      console.log('❌ Executive chef search failed:', result3.data);
    }
  } catch (error) {
    console.log('❌ Executive chef error:', error.message);
  }
  
  console.log('\n🏁 Indeed API test complete!');
  console.log('\n📋 Key Questions Answered:');
  console.log('1. Does API work? Check status codes above');
  console.log('2. How many jobs per request? Check job counts');
  console.log('3. Does pagination work? Compare page 1 vs page 2');
  console.log('4. Is there total count info? Check pagination fields');
}

testIndeedAPI();
