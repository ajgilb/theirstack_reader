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

async function testPagination() {
  console.log('🔍 Testing pagination methods...');
  
  // First, get baseline results
  console.log('\n📡 BASELINE: Standard restaurant search');
  const baselineRequest = {
    scraper: {
      maxRows: 100,
      query: 'restaurant',
      location: 'United States',
      jobType: 'fulltime',
      radius: '100',
      sort: 'relevance',
      fromDays: '7',
      country: 'us'
    }
  };
  
  let baselineJobs = [];
  try {
    const baseline = await makeRequest(baselineRequest);
    if (baseline.status === 201 && baseline.data.returnvalue?.data) {
      baselineJobs = baseline.data.returnvalue.data;
      console.log(`✅ Baseline: ${baselineJobs.length} jobs`);
      console.log('🎯 First job ID:', baselineJobs[0]?.jobKey);
      console.log('🎯 Last job ID:', baselineJobs[baselineJobs.length - 1]?.jobKey);
    }
  } catch (error) {
    console.log('❌ Baseline error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 1: Try adding page parameter
  console.log('\n📡 TEST 1: Adding page parameter');
  const pageTest = {
    scraper: {
      maxRows: 100,
      query: 'restaurant',
      location: 'United States',
      jobType: 'fulltime',
      radius: '100',
      sort: 'relevance',
      fromDays: '7',
      country: 'us',
      page: 2  // Try page 2
    }
  };
  
  try {
    const pageResult = await makeRequest(pageTest);
    if (pageResult.status === 201 && pageResult.data.returnvalue?.data) {
      const pageJobs = pageResult.data.returnvalue.data;
      console.log(`📊 Page 2: ${pageJobs.length} jobs`);
      
      // Check if jobs are different
      const firstJobSame = pageJobs[0]?.jobKey === baselineJobs[0]?.jobKey;
      console.log('🔍 Same first job as baseline?', firstJobSame);
      
      if (!firstJobSame && pageJobs.length > 0) {
        console.log('✅ Page parameter works! Different jobs returned');
        console.log('🎯 Page 2 first job ID:', pageJobs[0]?.jobKey);
      } else {
        console.log('❌ Page parameter ignored or same results');
      }
    } else {
      console.log('❌ Page test failed:', pageResult.status);
    }
  } catch (error) {
    console.log('❌ Page test error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 2: Try start/offset parameter
  console.log('\n📡 TEST 2: Adding start/offset parameter');
  const offsetTest = {
    scraper: {
      maxRows: 100,
      query: 'restaurant',
      location: 'United States',
      jobType: 'fulltime',
      radius: '100',
      sort: 'relevance',
      fromDays: '7',
      country: 'us',
      start: 100  // Try starting at job 100
    }
  };
  
  try {
    const offsetResult = await makeRequest(offsetTest);
    if (offsetResult.status === 201 && offsetResult.data.returnvalue?.data) {
      const offsetJobs = offsetResult.data.returnvalue.data;
      console.log(`📊 Offset: ${offsetJobs.length} jobs`);
      
      const firstJobSame = offsetJobs[0]?.jobKey === baselineJobs[0]?.jobKey;
      console.log('🔍 Same first job as baseline?', firstJobSame);
      
      if (!firstJobSame && offsetJobs.length > 0) {
        console.log('✅ Start/offset parameter works!');
        console.log('🎯 Offset first job ID:', offsetJobs[0]?.jobKey);
      } else {
        console.log('❌ Start/offset parameter ignored');
      }
    }
  } catch (error) {
    console.log('❌ Offset test error:', error.message);
  }
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test 3: Try different sort order
  console.log('\n📡 TEST 3: Different sort order (date vs relevance)');
  const sortTest = {
    scraper: {
      maxRows: 100,
      query: 'restaurant',
      location: 'United States',
      jobType: 'fulltime',
      radius: '100',
      sort: 'date',  // Changed from 'relevance' to 'date'
      fromDays: '7',
      country: 'us'
    }
  };
  
  try {
    const sortResult = await makeRequest(sortTest);
    if (sortResult.status === 201 && sortResult.data.returnvalue?.data) {
      const sortJobs = sortResult.data.returnvalue.data;
      console.log(`📊 Date sort: ${sortJobs.length} jobs`);
      
      const firstJobSame = sortJobs[0]?.jobKey === baselineJobs[0]?.jobKey;
      console.log('🔍 Same first job as baseline?', firstJobSame);
      
      if (!firstJobSame) {
        console.log('✅ Different sort gives different results!');
        console.log('🎯 Date sort first job ID:', sortJobs[0]?.jobKey);
        
        // Count unique jobs between relevance and date sort
        const baselineIds = new Set(baselineJobs.map(job => job.jobKey));
        const uniqueInSort = sortJobs.filter(job => !baselineIds.has(job.jobKey));
        console.log(`🎯 Unique jobs in date sort: ${uniqueInSort.length}/${sortJobs.length}`);
      } else {
        console.log('❌ Same results regardless of sort');
      }
    }
  } catch (error) {
    console.log('❌ Sort test error:', error.message);
  }
  
  console.log('\n🏁 Pagination testing complete!');
  console.log('\n📋 Summary:');
  console.log('- Check if page parameter works for pagination');
  console.log('- Check if start/offset parameter works');
  console.log('- Check if different sort orders give different job sets');
  console.log('- If none work, consider location-based splitting');
}

testPagination();
