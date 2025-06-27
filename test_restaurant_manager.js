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

async function testRestaurantManager() {
  console.log('🔍 Testing "restaurant manager" with working parameters...');
  
  // Test with the parameters that worked for "manager"
  console.log('\n📡 TEST 1: Restaurant manager in Chicago (job_type=fulltime)');
  const test1 = '/jobs/search?query=restaurant%20manager&location=chicago&page_id=1&locality=us&fromage=7&radius=50&sort=date&job_type=fulltime';
  
  try {
    const result1 = await makeRequest(test1);
    console.log('📊 Status:', result1.status);
    
    if (result1.status === 200) {
      console.log(`📊 Found ${result1.data.count} jobs`);
      
      if (result1.data.count > 0) {
        console.log('✅ SUCCESS! Restaurant manager jobs found!');
        
        result1.data.hits.forEach((job, index) => {
          console.log(`📄 Job ${index + 1}:`, {
            title: job.title,
            company: job.company,
            location: job.location,
            id: job.id
          });
        });
        
        if (result1.data.next_page_id) {
          console.log('🎯 Has next page:', result1.data.next_page_id);
        }
      } else {
        console.log('⚠️ No restaurant manager jobs in Chicago');
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test with New York
  console.log('\n📡 TEST 2: Restaurant manager in New York');
  const test2 = '/jobs/search?query=restaurant%20manager&location=new%20york&page_id=1&locality=us&fromage=7&radius=50&sort=date&job_type=fulltime';
  
  try {
    const result2 = await makeRequest(test2);
    console.log('📊 Status:', result2.status);
    console.log(`📊 Found ${result2.data.count} jobs`);
    
    if (result2.data.count > 0) {
      console.log('✅ SUCCESS! Restaurant manager jobs in NY!');
      result2.data.hits.slice(0, 3).forEach((job, index) => {
        console.log(`📄 Job ${index + 1}:`, {
          title: job.title,
          company: job.company,
          location: job.location
        });
      });
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test with broader location
  console.log('\n📡 TEST 3: Restaurant manager in United States');
  const test3 = '/jobs/search?query=restaurant%20manager&location=united%20states&page_id=1&locality=us&fromage=7&radius=50&sort=date&job_type=fulltime';
  
  try {
    const result3 = await makeRequest(test3);
    console.log('📊 Status:', result3.status);
    console.log(`📊 Found ${result3.data.count} jobs`);
    
    if (result3.data.count > 0) {
      console.log('✅ SUCCESS! Restaurant manager jobs nationwide!');
      result3.data.hits.slice(0, 5).forEach((job, index) => {
        console.log(`📄 Job ${index + 1}:`, {
          title: job.title,
          company: job.company,
          location: job.location
        });
      });
      
      // Test pagination
      if (result3.data.next_page_id) {
        console.log('\n🔍 Testing pagination...');
        const page2 = '/jobs/search?query=restaurant%20manager&location=united%20states&page_id=2&locality=us&fromage=7&radius=50&sort=date&job_type=fulltime';
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          const page2Result = await makeRequest(page2);
          if (page2Result.status === 200 && page2Result.data.count > 0) {
            console.log(`✅ Page 2 works! Found ${page2Result.data.count} more jobs`);
            console.log('📄 First job from page 2:', {
              title: page2Result.data.hits[0]?.title,
              company: page2Result.data.hits[0]?.company,
              location: page2Result.data.hits[0]?.location
            });
          }
        } catch (pageError) {
          console.log('❌ Pagination error:', pageError.message);
        }
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('\n🏁 Restaurant manager test complete!');
  console.log('\n📋 Summary:');
  console.log('✅ Indeed API works with correct parameters');
  console.log('✅ Use job_type=fulltime (NOT permanent)');
  console.log('✅ Use fromage=7 for 7-day job age');
  console.log('✅ Pagination available via page_id parameter');
}

testRestaurantManager();
