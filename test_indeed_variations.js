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

async function testVariations() {
  console.log('🔍 Testing Indeed API with different parameters...');
  
  const testCases = [
    {
      name: 'Original example (manager + chicago)',
      path: '/jobs/search?query=manager&location=chicago&page_id=1&locality=us&fromage=1&radius=50&sort=date&job_type=permanent'
    },
    {
      name: 'Restaurant manager + chicago',
      path: '/jobs/search?query=restaurant%20manager&location=chicago&page_id=1&locality=us&fromage=1&radius=50&sort=date&job_type=permanent'
    },
    {
      name: 'Manager + New York',
      path: '/jobs/search?query=manager&location=new%20york&page_id=1&locality=us&fromage=1&radius=50&sort=date&job_type=permanent'
    },
    {
      name: 'Restaurant manager + New York',
      path: '/jobs/search?query=restaurant%20manager&location=new%20york&page_id=1&locality=us&fromage=1&radius=50&sort=date&job_type=permanent'
    },
    {
      name: 'Manager without job_type filter',
      path: '/jobs/search?query=manager&location=chicago&page_id=1&locality=us&fromage=1&radius=50&sort=date'
    },
    {
      name: 'Manager with fulltime job_type',
      path: '/jobs/search?query=manager&location=chicago&page_id=1&locality=us&fromage=1&radius=50&sort=date&job_type=fulltime'
    },
    {
      name: 'Manager with longer fromage (7 days)',
      path: '/jobs/search?query=manager&location=chicago&page_id=1&locality=us&fromage=7&radius=50&sort=date'
    },
    {
      name: 'Simple manager search (minimal params)',
      path: '/jobs/search?query=manager&location=chicago&locality=us'
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📡 TEST ${i + 1}: ${testCase.name}`);
    console.log(`🔍 Path: ${testCase.path}`);
    
    try {
      const result = await makeRequest(testCase.path);
      console.log('📊 Status:', result.status);
      
      if (result.status === 200) {
        if (result.data.count > 0) {
          console.log(`✅ SUCCESS! Found ${result.data.count} jobs`);
          
          if (result.data.hits && result.data.hits.length > 0) {
            console.log('📄 First job:', {
              title: result.data.hits[0].title,
              company: result.data.hits[0].company,
              location: result.data.hits[0].location
            });
          }
          
          // Check for pagination info
          if (result.data.next_page_id) {
            console.log('🎯 Has next page:', result.data.next_page_id);
          }
          
          // If this works, test pagination
          if (result.data.count > 10) {
            console.log('🔍 Testing pagination...');
            const page2Path = testCase.path.replace('page_id=1', 'page_id=2');
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            try {
              const page2Result = await makeRequest(page2Path);
              if (page2Result.status === 200 && page2Result.data.count > 0) {
                console.log(`✅ Page 2 works! Found ${page2Result.data.count} jobs`);
              }
            } catch (page2Error) {
              console.log('❌ Page 2 failed:', page2Error.message);
            }
          }
          
        } else {
          console.log('⚠️ API works but found 0 jobs');
          console.log('📄 Indeed URL:', result.data.indeed_final_url);
        }
      } else {
        console.log('❌ Failed with status:', result.status);
        if (result.data) {
          console.log('📄 Error:', result.data);
        }
      }
      
    } catch (error) {
      console.log('❌ Request error:', error.message);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 Variation testing complete!');
}

testVariations();
