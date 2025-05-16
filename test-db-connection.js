/**
 * Simple script to test database connection
 * Run with: node test-db-connection.js
 */

import pg from 'pg';
const { Pool } = pg;

// The connection string to test - using direct connection parameters
const supabaseUrl = 'https://mbaqiwhkngfxxmlkionj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iYXFpd2hrbmdmeHhtbGtpb25qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDE0MzUzMiwiZXhwIjoyMDU5NzE5NTMyfQ.7fdYmDgf_Ik1xtABnNje5peczWjoFKhvrvokPRFknzE';

// Try different connection strings
const connectionStrings = [
  // Option 1: Direct connection with db prefix
  `postgresql://postgres.${supabaseKey}@db.mbaqiwhkngfxxmlkionj.supabase.co:5432/postgres`,

  // Option 2: Connection pooling
  `postgresql://postgres.${supabaseKey}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,

  // Option 3: Direct connection without db prefix
  `postgresql://postgres.${supabaseKey}@mbaqiwhkngfxxmlkionj.supabase.co:5432/postgres`,

  // Option 4: Using project reference directly
  `postgresql://postgres.${supabaseKey}@${supabaseUrl.replace('https://', '')}:5432/postgres`
];

console.log('Testing all connection strings...');

// Function to test a connection string
async function testConnection(connectionString, index) {
  console.log(`\nTesting connection string #${index + 1}:`);
  console.log(`Using: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  try {
    const matches = connectionString.match(/postgresql:\/\/([^:]+)(?::([^@]+))?@([^:]+):(\d+)\/(.+)/);

    if (!matches) {
      console.error('Could not parse connection string');
      return false;
    }

    const [, user, password, host, port, database] = matches;

    console.log('Parsed connection details:');
    console.log(`- User: ${user}`);
    console.log(`- Host: ${host}`);
    console.log(`- Port: ${port}`);
    console.log(`- Database: ${database}`);

    // Create explicit configuration
    const dbConfig = {
      user,
      password,
      host,
      port: parseInt(port, 10),
      database,
      ssl: {
        rejectUnauthorized: false
      },
      // Force IPv4 to avoid connectivity issues
      family: 4,
      // Set a short connection timeout
      connectionTimeoutMillis: 5000
    };

    // Create the connection pool
    const pool = new Pool(dbConfig);

    // Test the connection
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('✅ Connection successful!');
      console.log(`Server time: ${res.rows[0].now}`);

      // Test if tables exist
      try {
        const tableRes = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'culinary_jobs_google'
          );
        `);
        console.log(`Table culinary_jobs_google exists: ${tableRes.rows[0].exists}`);

        // Check if the original table exists
        const origTableRes = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'culinary_jobs'
          );
        `);
        console.log(`Table culinary_jobs exists: ${origTableRes.rows[0].exists}`);
      } catch (tableErr) {
        console.error('Error checking tables:', tableErr);
      }

      // Close the connection
      await pool.end();
      return true;
    } catch (err) {
      console.error('❌ Connection failed:', err.message);
      try {
        await pool.end();
      } catch (endErr) {
        // Ignore errors when ending the pool
      }
      return false;
    }
  } catch (error) {
    console.error('Error:', error.message);
    return false;
  }
}

// Test all connection strings
async function testAllConnections() {
  let anySuccessful = false;

  for (let i = 0; i < connectionStrings.length; i++) {
    const success = await testConnection(connectionStrings[i], i);
    if (success) {
      anySuccessful = true;
      console.log(`\n✅ Connection string #${i + 1} works! Use this in your Apify actor.`);

      // Format for Apify
      console.log('\nFor Apify, set the DATABASE_URL environment variable to:');
      console.log(connectionStrings[i]);
    }
  }

  if (!anySuccessful) {
    console.error('\n❌ None of the connection strings worked. Please check your Supabase credentials.');
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run the tests
testAllConnections().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
