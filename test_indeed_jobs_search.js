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

async function testIndeedJobsSearch() {
  console.log('🔍 Testing Indeed Jobs Search API...');
  console.log('🔑 Using API key: 26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c');
  
  // Test 1: Basic search for "restaurant manager" in "united states"
  console.log('\n📡 TEST 1: Basic search for "restaurant manager"');
  const basicSearch = '/jobs/search?query=restaurant%20manager&location=united%20states&page_id=1&locality=us&fromage=1&radius=50&sort=date&job_type=permanent';
  
  try {
    const result1 = await makeRequest(basicSearch);
    console.log('📊 Status:', result1.status);
    
    if (result1.status === 200) {
      console.log('✅ SUCCESS! Jobs Search API works!');
      
      if (typeof result1.data === 'object') {
        console.log('📋 Response keys:', Object.keys(result1.data));
        
        // Look for job data
        if (result1.data.hits && Array.isArray(result1.data.hits)) {
          console.log(`🎯 Found ${result1.data.hits.length} jobs!`);
          
          if (result1.data.hits.length > 0) {
            console.log('📄 First job:', {
              title: result1.data.hits[0].title,
              company: result1.data.hits[0].company,
              location: result1.data.hits[0].location,
              id: result1.data.hits[0].id
            });
            
            console.log('📄 Last job:', {
              title: result1.data.hits[result1.data.hits.length - 1].title,
              company: result1.data.hits[result1.data.hits.length - 1].company,
              location: result1.data.hits[result1.data.hits.length - 1].location
            });
          }
        }
        
        // Look for pagination/total info
        ['count', 'total', 'totalResults', 'total_count', 'next_page', 'has_more', 'page_count'].forEach(field => {
          if (result1.data[field] !== undefined) {
            console.log(`🎯 Found "${field}":`, result1.data[field]);
          }
        });
        
        console.log('📄 Full response sample:', JSON.stringify(result1.data, null, 2).substring(0, 1000) + '...');
        
        // Test pagination if we found jobs
        if (result1.data.hits && result1.data.hits.length > 0) {
          console.log('\n📡 TEST 2: Testing pagination (page 2)');
          const page2Search = '/jobs/search?query=restaurant%20manager&location=united%20states&page_id=2&locality=us&fromage=1&radius=50&sort=date&job_type=permanent';
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const result2 = await makeRequest(page2Search);
            console.log('📊 Page 2 Status:', result2.status);
            
            if (result2.status === 200 && result2.data.hits) {
              console.log(`✅ Pagination works! Page 2 has ${result2.data.hits.length} jobs`);
              
              if (result2.data.hits.length > 0) {
                console.log('📄 First job from page 2:', {
                  title: result2.data.hits[0].title,
                  company: result2.data.hits[0].company,
                  id: result2.data.hits[0].id
                });
                
                // Check if jobs are different from page 1
                const page1FirstId = result1.data.hits[0].id;
                const page2FirstId = result2.data.hits[0].id;
                
                if (page1FirstId !== page2FirstId) {
                  console.log('✅ Pagination returns different jobs (no duplicates)');
                } else {
                  console.log('⚠️ Pagination might be returning same jobs');
                }
              }
            } else {
              console.log('❌ Pagination failed');
            }
          } catch (page2Error) {
            console.log('❌ Page 2 error:', page2Error.message);
          }
          
          // Test different search term
          console.log('\n📡 TEST 3: Testing "executive chef" search');
          const chefSearch = '/jobs/search?query=executive%20chef&location=united%20states&page_id=1&locality=us&fromage=1&radius=50&sort=date&job_type=permanent';
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const result3 = await makeRequest(chefSearch);
            console.log('📊 Executive chef Status:', result3.status);
            
            if (result3.status === 200 && result3.data.hits) {
              console.log(`✅ Executive chef search works! Found ${result3.data.hits.length} jobs`);
            }
          } catch (chefError) {
            console.log('❌ Executive chef error:', chefError.message);
          }
        }
        
      } else {
        console.log('📄 Response (text):', result1.data.substring(0, 500) + '...');
      }
      
    } else {
      console.log('❌ Request failed');
      console.log('📄 Error response:', result1.data);
    }
    
  } catch (error) {
    console.log('❌ Request error:', error.message);
  }
  
  console.log('\n🏁 Indeed Jobs Search API test complete!');
  console.log('\n📋 Key Questions:');
  console.log('1. Does the API work? Check status codes');
  console.log('2. How many jobs per page? Check job counts');
  console.log('3. Does pagination work? Check page 2 results');
  console.log('4. Is there total count info? Check pagination fields');
}

testIndeedJobsSearch();
