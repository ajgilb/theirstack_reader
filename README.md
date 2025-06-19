# Indeed Job Scraper

This Apify actor is a specialized job scraping tool focused on culinary positions from Indeed and other sources. It uses both Google Jobs API and Bing Search API via SearchAPI.io to find job listings, with enhanced filtering specifically designed for culinary industry positions.

## Features

- **Indeed-focused searches** with optimized queries for culinary positions
- **Dual search engines** - Google Jobs API and Bing Search API for comprehensive coverage
- **Enhanced filtering** - Excludes fast food chains, recruiters, and salary-related company names
- **McDonald's exclusion** - Specifically filters out McDonald's listings to focus on professional culinary roles
- Extract structured data including salary information, skills, and experience level
- Find company websites using SearchAPI.io
- Save results to Apify dataset
- Option to push results to an external database
- Deduplication of job listings
- Advanced filtering for fast food restaurants and recruiting agencies

## Input Parameters

- `queries` - List of search queries optimized for Indeed and culinary positions (e.g., "restaurant chef jobs site:indeed.com United States")
- `location` - Optional location filter (e.g., "New York")
- `maxPagesPerQuery` - Maximum number of pages to fetch per query (default: 40)
- `saveToDataset` - Whether to save results to Apify dataset
- `pushToDatabase` - Whether to push results to external database
- `databaseUrl` - URL of the external database
- `databaseTable` - Name of the database table to insert jobs into (default: "indeed_jobs")
- `deduplicateJobs` - Whether to check for and skip duplicate jobs when pushing to database
- `excludeFastFood` - Whether to exclude fast food restaurants (includes McDonald's filtering)
- `excludeRecruiters` - Whether to exclude recruiting agencies
- `includeWebsiteData` - Whether to collect company website URLs
- `testMode` - Run in test mode with fewer jobs processed
- `searchEngine` - Choose between "google", "bing", or "both" search engines

## Output

The actor outputs job listings with the following structure:

```json
{
  "title": "Executive Chef",
  "company": "Restaurant Group",
  "location": "New York, NY",
  "posted_at": "2 days ago",
  "schedule": "Full-time",
  "description": "Job description...",
  "salary_min": 75000,
  "salary_max": 90000,
  "salary_currency": "USD",
  "salary_period": "yearly",
  "skills": ["cooking", "menu planning", "kitchen management"],
  "experience_level": "senior",
  "apply_link": "https://example.com/apply",
  "source": "LinkedIn",
  "scraped_at": "2023-05-15T12:34:56.789Z",
  "company_website": "https://restaurantgroup.com",
  "company_domain": "restaurantgroup.com",
  "emails": [
    {
      "email": "chef@restaurantgroup.com",
      "firstName": "John",
      "lastName": "Doe",
      "position": "Executive Chef",
      "confidence": 80,
      "_originalCompany": "Restaurant Group",
      "_originalDomain": "restaurantgroup.com"
    }
  ]
}
```

## Usage

1. Set up your API keys in the environment variables:
   ```
   SEARCH_API_KEY=your_searchapi_key_here
   DATABASE_URL=your_database_url_here (optional)
   RESEND_API_KEY=your_resend_key_here (optional, for email notifications)
   ```

2. Configure the input parameters according to your needs. The default queries are optimized for Indeed culinary positions.

3. Run the actor and retrieve the results from the dataset.

## Key Differences from Google Jobs API Actor

- **Indeed-focused**: Default queries target Indeed specifically with `site:indeed.com` filters
- **Enhanced filtering**: Includes McDonald's exclusion and salary company name filtering
- **Increased limits**: Default `maxPagesPerQuery` is 40 (vs 20 in original)
- **Dual search engines**: Uses both Google Jobs API and Bing Search API by default
- **Culinary specialization**: All default queries focus on restaurant and culinary positions
- **Independent repository**: Completely separate from the original Google Jobs API Actor
