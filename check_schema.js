/**
 * Script to check the schema of the culinary_jobs_google table
 */

import pg from 'pg';
const { Pool } = pg;

// Database configuration
const connectionString = 'postgresql://postgres.mbaqiwhkngfxxmlkionj:Relham12%3F@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

async function checkSchema() {
    const pool = new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        // Check if the table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_jobs_google'
            );
        `);
        
        const tableExists = tableCheck.rows[0].exists;
        console.log(`Table culinary_jobs_google exists: ${tableExists}`);
        
        if (tableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs_google'
                ORDER BY ordinal_position;
            `);
            
            console.log('Columns in culinary_jobs_google:');
            columnInfo.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        }
        
        // Check if the contacts table exists
        const contactsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_contacts_google'
            );
        `);
        
        const contactsTableExists = contactsTableCheck.rows[0].exists;
        console.log(`\nTable culinary_contacts_google exists: ${contactsTableExists}`);
        
        if (contactsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_contacts_google'
                ORDER BY ordinal_position;
            `);
            
            console.log('Columns in culinary_contacts_google:');
            columnInfo.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        }
        
        // Check the schema of the culinary_jobs table (original table)
        const originalTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_jobs'
            );
        `);
        
        const originalTableExists = originalTableCheck.rows[0].exists;
        console.log(`\nTable culinary_jobs exists: ${originalTableExists}`);
        
        if (originalTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs'
                ORDER BY ordinal_position;
            `);
            
            console.log('Columns in culinary_jobs:');
            columnInfo.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
            });
        }
    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        await pool.end();
    }
}

checkSchema().catch(console.error);
