import https from 'https';

function makeRequest(body) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      hostname: 'indeed-scraper-api.p.rapidapi.com',
      port: null,
      path: '/api/job',
      headers: {
        'x-rapidapi-key': '26f8494ae3msh6105ec8e9f487c4p1e4693jsndc74e2a6561c',
        'x-rapidapi-host': 'indeed-scraper-api.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, function (res) {
      const chunks = [];

      res.on('data', function (chunk) {
        chunks.push(chunk);
      });

      res.on('end', function () {
        const responseBody = Buffer.concat(chunks);
        try {
          const data = JSON.parse(responseBody.toString());
          resolve({ status: res.statusCode, data });
        } catch (error) {
          resolve({ status: res.statusCode, data: responseBody.toString() });
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function testMaxRowsLimits() {
  console.log('🔍 Testing maxRows limits...');
  
  const testCases = [
    { maxRows: 100, name: '100 jobs' },
    { maxRows: 200, name: '200 jobs' },
    { maxRows: 500, name: '500 jobs' },
    { maxRows: 1000, name: '1000 jobs' }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📡 TEST ${i + 1}: Requesting ${testCase.name}`);
    
    const requestBody = {
      scraper: {
        maxRows: testCase.maxRows,
        query: 'restaurant',
        location: 'United States',
        jobType: 'fulltime',
        radius: '100',
        sort: 'relevance',
        fromDays: '7',
        country: 'us'
      }
    };
    
    console.log(`🔍 Requesting ${testCase.maxRows} jobs...`);
    
    try {
      const startTime = Date.now();
      const result = await makeRequest(requestBody);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log('📊 Status:', result.status);
      console.log('⏱️ Duration:', duration, 'seconds');
      
      if (result.status === 200 || result.status === 201) {
        if (result.data.returnvalue && result.data.returnvalue.data) {
          const jobs = result.data.returnvalue.data;
          console.log(`✅ SUCCESS! Got ${jobs.length} jobs (requested ${testCase.maxRows})`);
          
          if (jobs.length < testCase.maxRows) {
            console.log(`⚠️ Got fewer jobs than requested - might be the limit or no more available`);
          }
          
          // Check if we're hitting a limit
          if (jobs.length === testCase.maxRows) {
            console.log(`🎯 Got exactly what we requested - API can handle ${testCase.maxRows} jobs`);
          }
          
        } else {
          console.log('❌ Unexpected response structure');
          console.log('📄 Response keys:', Object.keys(result.data));
        }
      } else {
        console.log('❌ Request failed');
        console.log('📄 Error:', result.data);
        
        if (result.status === 400) {
          console.log('⚠️ Might have hit maxRows limit');
        }
      }
      
    } catch (error) {
      console.log('❌ Request error:', error.message);
    }
    
    // Wait between requests to avoid rate limiting
    if (i < testCases.length - 1) {
      console.log('⏱️ Waiting 10 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log('\n🏁 maxRows limit testing complete!');
  console.log('\n📋 Summary:');
  console.log('- Check which maxRows values worked');
  console.log('- Note any limits or errors');
  console.log('- Consider request duration vs job count');
}

testMaxRowsLimits();
