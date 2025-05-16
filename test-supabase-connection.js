/**
 * Test Supabase connection using the Supabase JavaScript client
 * Run with: node test-supabase-connection.js
 */

// Supabase project details
const SUPABASE_URL = 'https://mbaqiwhkngfxxmlkionj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYXFpd2hrbmdmeHhtbGtpb25qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDE0MzUzMiwiZXhwIjoyMDU5NzE5NTMyfQ.7fdYmDgf_Ik1xtABnNje5peczWjoFKhvrvokPRFknzE';

// Import the Supabase client
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Testing Supabase connection...');
console.log(`Using Supabase URL: ${SUPABASE_URL}`);

// Test the connection by querying the database
async function testConnection() {
  try {
    // Test a simple query - use correct syntax for count
    const { data, error } = await supabase
      .from('culinary_jobs_google')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying culinary_jobs_google table:', error);

      // Try the original table
      console.log('Trying original culinary_jobs table...');
      const { data: origData, error: origError } = await supabase
        .from('culinary_jobs')
        .select('*')
        .limit(1);

      if (origError) {
        console.error('Error querying culinary_jobs table:', origError);

        // Try a simple query to check if we can connect at all
        console.log('Trying a simple query to check connection...');
        const { data: testData, error: testError } = await supabase
          .from('_prisma_migrations')  // This table usually exists in Supabase
          .select('*')
          .limit(1);

        if (testError) {
          console.error('Error with simple connection test:', testError);
          return false;
        } else {
          console.log('Successfully connected to Supabase!');
          console.log('Available tables might be different than expected.');
          return true;
        }
      } else {
        console.log('Successfully connected to culinary_jobs table!');
        console.log('Data:', origData);
        return true;
      }
    } else {
      console.log('Successfully connected to culinary_jobs_google table!');
      console.log('Data:', data);
      return true;
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Test if tables exist by querying each table
async function testTablesExist() {
  try {
    const tables = ['culinary_jobs_google', 'culinary_contacts_google', 'culinary_jobs', 'culinary_contacts'];
    const results = {};

    console.log('Checking if tables exist...');

    for (const table of tables) {
      try {
        // Try to query the table
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`❌ Table '${table}' error:`, error.message);
          results[table] = false;
        } else {
          console.log(`✅ Table '${table}' exists`);
          results[table] = true;
        }
      } catch (tableError) {
        console.error(`Error checking table '${table}':`, tableError.message);
        results[table] = false;
      }
    }

    console.log('\nTable check results:');
    for (const [table, exists] of Object.entries(results)) {
      console.log(`- ${table}: ${exists ? '✅ Exists' : '❌ Not found or error'}`);
    }

    return Object.values(results).some(exists => exists);
  } catch (error) {
    console.error('Unexpected error checking tables:', error);
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('\n=== Testing Supabase Connection ===');
  const connectionSuccess = await testConnection();

  if (connectionSuccess) {
    console.log('\n✅ Supabase connection successful!');

    // Try to check tables
    console.log('\n=== Checking Tables ===');
    await testTablesExist();

    console.log('\nRecommendation for Apify:');
    console.log('1. Set SUPABASE_URL environment variable to:');
    console.log(SUPABASE_URL);
    console.log('2. Set SUPABASE_SERVICE_ROLE_KEY environment variable to:');
    console.log(SUPABASE_SERVICE_ROLE_KEY);
  } else {
    console.error('\n❌ Supabase connection failed!');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
