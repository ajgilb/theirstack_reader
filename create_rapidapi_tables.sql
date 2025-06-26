-- Create RapidAPI tables for job scraping
-- Run this SQL in your database to create the required tables

-- Create rapidapi_jobs table
CREATE TABLE IF NOT EXISTS rapidapi_jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    parent_company VARCHAR(255),
    location VARCHAR(255),
    salary VARCHAR(255),
    contact_name VARCHAR(255),
    contact_title VARCHAR(255),
    email VARCHAR(255),
    url TEXT,
    job_details TEXT,
    linkedin VARCHAR(255),
    domain VARCHAR(255),
    company_size VARCHAR(255),
    date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    contacts_last_viewed TIMESTAMP WITH TIME ZONE,
    parent_url TEXT,
    
    CONSTRAINT unique_job_url_rapidapi_jobs UNIQUE (url)
);

-- Drop existing rapidapi_contacts table if it has wrong foreign key
DROP TABLE IF EXISTS rapidapi_contacts CASCADE;

-- Create rapidapi_contacts table with correct foreign key
CREATE TABLE IF NOT EXISTS rapidapi_contacts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES rapidapi_jobs(id) ON DELETE CASCADE,
    name VARCHAR(255),
    title VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_contact_email_rapidapi_contacts UNIQUE (job_id, email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rapidapi_jobs_company ON rapidapi_jobs(company);
CREATE INDEX IF NOT EXISTS idx_rapidapi_jobs_title ON rapidapi_jobs(title);
CREATE INDEX IF NOT EXISTS idx_rapidapi_jobs_date_added ON rapidapi_jobs(date_added);
CREATE INDEX IF NOT EXISTS idx_rapidapi_jobs_domain ON rapidapi_jobs(domain);

-- Verify tables were created
SELECT 'rapidapi_jobs table created' as status;
SELECT 'rapidapi_contacts table created' as status;
