/**
 * Indeed Job Scraper with Company Website Lookup
 * 
 * Scrapes Indeed job listings and looks up company websites using searchapi.io
 */

import { PuppeteerCrawler } from 'crawlee';
import fs from 'fs';
import { Pool } from 'pg';
import fetch from 'node-fetch';

// Database configuration
const DATABASE_CONFIG = {
    user: 'google_scraper.mbaqiwhkngfxxmlkionj',
    password: 'Relham12',
    host: '52.8.172.168',
    port: 6543,
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    },
    family: 4
};

// SearchAPI.io configuration
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY || 'YOUR_SEARCHAPI_KEY';
const SEARCHAPI_URL = 'https://www.searchapi.io/api/v1/search';

// Create database pool
const pool = new Pool(DATABASE_CONFIG);

/**
 * Look up company website using searchapi.io
 */
async function lookupCompanyWebsite(companyName) {
    try {
        const response = await fetch(SEARCHAPI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SEARCHAPI_KEY}`
            },
            body: JSON.stringify({
                q: `${companyName} website`,
                engine: 'google',
                num: 1
            })
        });

        const data = await response.json();
        
        // Extract the first organic result URL
        if (data.organic_results && data.organic_results.length > 0) {
            return data.organic_results[0].link;
        }
        
        return null;
    } catch (error) {
        console.error('Error looking up company website:', error);
        return null;
    }
}

/**
 * Save job data to Supabase
 */
async function saveToSupabase(jobData) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const now = new Date().toISOString();
        
        const jobInsertQuery = `
            INSERT INTO culinary_jobs_google (
                title, company, parent_company, location, salary,
                contact_name, contact_title, email, url, job_details,
                linkedin, domain, company_size, date_added, last_updated,
                contacts_last_viewed, parent_url
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17
            ) RETURNING id
        `;

        const jobValues = [
            jobData.title,
            jobData.company,
            null, // parent_company
            jobData.location,
            jobData.salary,
            null, // contact_name
            null, // contact_title
            null, // email
            jobData.jobLink,
            jobData.description,
            null, // linkedin
            jobData.companyWebsite ? new URL(jobData.companyWebsite).hostname : null,
            null, // company_size
            now,
            now,
            null, // contacts_last_viewed
            jobData.companyWebsite
        ];

        const result = await client.query(jobInsertQuery, jobValues);
        await client.query('COMMIT');
        
        console.log(`✓ Saved job: "${jobData.title}" at "${jobData.company}"`);
        return result.rows[0].id;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving to Supabase:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function scrapeIndeedJobs() {
    console.log('🚀 Starting Indeed scraper with company website lookup...');
    
    const startUrls = [
        'https://www.indeed.com/jobs?q=restaurant%20manager&l=United%20States&from=searchOnHP%2Cwhatautocomplete%2CwhatautocompleteSourceStandard'
    ];
    
    const crawler = new PuppeteerCrawler({
        launchContext: {
            launchOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=VizDisplayCompositor'
                ]
            }
        },
        
        maxConcurrency: 1,
        
        async requestHandler({ page, request }) {
            console.log(`📄 Loading: ${request.url}`);
            
            try {
                // Set realistic user agent and headers
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                });
                
                // Navigate to page
                await page.goto(request.url, { 
                    waitUntil: 'networkidle2',
                    timeout: 60000 
                });
                
                // Wait for initial load
                await page.waitForTimeout(3000);
                
                // Handle Cloudflare if present
                const title = await page.title();
                if (title.includes('Just a moment') || title.includes('Cloudflare')) {
                    console.log('🛡️  Cloudflare challenge detected, waiting...');
                    await page.waitForTimeout(15000); // Wait for Cloudflare
                }
                
                // Extract job listings
                const jobs = await page.evaluate(() => {
                    const jobElements = document.querySelectorAll('.job_seen_beacon');
                    return Array.from(jobElements).map(job => {
                        const title = job.querySelector('[data-testid="job-title"] span')?.textContent.trim() || '';
                        const company = job.querySelector('[data-testid="company-name"]')?.textContent.trim() || '';
                        const location = job.querySelector('.css-1nzim0b.eu4oa1w0')?.textContent.trim() || '';
                        const salary = job.querySelector('.css-1oc7tea.eu4oa1w0')?.textContent.trim() || '';
                        const description = job.querySelector('.job-snippet')?.textContent.trim() || '';
                        const jobLink = job.querySelector('[data-testid="job-title"] a')?.href || '';
                            
                            return {
                                title,
                                company,
                                location,
                                salary,
                            description,
                            jobLink
                        };
                    });
                });
                
                console.log(`Found ${jobs.length} jobs`);
                
                // Process each job
                for (const job of jobs) {
                    try {
                        // Look up company website
                        console.log(`🔍 Looking up website for: ${job.company}`);
                        const companyWebsite = await lookupCompanyWebsite(job.company);
                        
                        // Add website to job data
                        const jobData = {
                            ...job,
                            companyWebsite
                        };
                        
                        // Save to Supabase
                        await saveToSupabase(jobData);
                        
                        // Add delay between jobs
                        await page.waitForTimeout(1000);
                    } catch (error) {
                        console.error(`Error processing job at ${job.company}:`, error);
                    }
                }
                
            } catch (error) {
                console.error('Error in request handler:', error);
            }
        },
        
        failedRequestHandler({ request, error }) {
            console.error(`Request ${request.url} failed:`, error);
        }
    });
    
    await crawler.run(startUrls);
}

// Run the scraper
scrapeIndeedJobs().catch(console.error);
