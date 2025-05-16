/**
 * Script to check the schema of the tables in Supabase
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
        console.log('Checking Supabase schema...');
        
        // Check culinary_jobs table
        const jobsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_jobs'
            );
        `);
        
        const jobsTableExists = jobsTableCheck.rows[0].exists;
        console.log(`Table culinary_jobs exists: ${jobsTableExists}`);
        
        if (jobsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs'
                ORDER BY ordinal_position;
            `);
            
            console.log('\nColumns in culinary_jobs:');
            columnInfo.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
            });
            
            // Get primary key
            const pkInfo = await pool.query(`
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = 'culinary_jobs'::regclass
                AND i.indisprimary;
            `);
            
            console.log('\nPrimary key of culinary_jobs:');
            pkInfo.rows.forEach(pk => {
                console.log(`- ${pk.attname}`);
            });
            
            // Get unique constraints
            const uniqueInfo = await pool.query(`
                SELECT con.conname, pg_get_constraintdef(con.oid)
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = 'culinary_jobs'
                AND con.contype = 'u';
            `);
            
            console.log('\nUnique constraints of culinary_jobs:');
            uniqueInfo.rows.forEach(unique => {
                console.log(`- ${unique.conname}: ${unique.pg_get_constraintdef}`);
            });
        }
        
        // Check culinary_contacts table
        const contactsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_contacts'
            );
        `);
        
        const contactsTableExists = contactsTableCheck.rows[0].exists;
        console.log(`\nTable culinary_contacts exists: ${contactsTableExists}`);
        
        if (contactsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_contacts'
                ORDER BY ordinal_position;
            `);
            
            console.log('\nColumns in culinary_contacts:');
            columnInfo.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
            });
            
            // Get primary key
            const pkInfo = await pool.query(`
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = 'culinary_contacts'::regclass
                AND i.indisprimary;
            `);
            
            console.log('\nPrimary key of culinary_contacts:');
            pkInfo.rows.forEach(pk => {
                console.log(`- ${pk.attname}`);
            });
            
            // Get unique constraints
            const uniqueInfo = await pool.query(`
                SELECT con.conname, pg_get_constraintdef(con.oid)
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = 'culinary_contacts'
                AND con.contype = 'u';
            `);
            
            console.log('\nUnique constraints of culinary_contacts:');
            uniqueInfo.rows.forEach(unique => {
                console.log(`- ${unique.conname}: ${unique.pg_get_constraintdef}`);
            });
            
            // Get foreign keys
            const fkInfo = await pool.query(`
                SELECT con.conname, pg_get_constraintdef(con.oid)
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = 'culinary_contacts'
                AND con.contype = 'f';
            `);
            
            console.log('\nForeign keys of culinary_contacts:');
            fkInfo.rows.forEach(fk => {
                console.log(`- ${fk.conname}: ${fk.pg_get_constraintdef}`);
            });
        }
        
        // Check culinary_jobs_google table
        const googleJobsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_jobs_google'
            );
        `);
        
        const googleJobsTableExists = googleJobsTableCheck.rows[0].exists;
        console.log(`\nTable culinary_jobs_google exists: ${googleJobsTableExists}`);
        
        if (googleJobsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_jobs_google'
                ORDER BY ordinal_position;
            `);
            
            console.log('\nColumns in culinary_jobs_google:');
            columnInfo.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
            });
        }
        
        // Check culinary_contacts_google table
        const googleContactsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'culinary_contacts_google'
            );
        `);
        
        const googleContactsTableExists = googleContactsTableCheck.rows[0].exists;
        console.log(`\nTable culinary_contacts_google exists: ${googleContactsTableExists}`);
        
        if (googleContactsTableExists) {
            // Get the column information
            const columnInfo = await pool.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'culinary_contacts_google'
                ORDER BY ordinal_position;
            `);
            
            console.log('\nColumns in culinary_contacts_google:');
            columnInfo.rows.forEach(col => {
                console.log(`- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
            });
        }
    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        await pool.end();
    }
}

checkSchema().catch(console.error);
