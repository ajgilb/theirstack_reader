# Google Jobs API Actor

This Apify actor uses the SearchAPI.io Google Jobs API to search for job listings and save them to a dataset or push them to a database.

## Features

- Search for job listings using custom queries
- Filter by location
- Extract structured data including salary information, skills, and experience level
- Save results to Apify dataset
- Option to push results to an external database
- Deduplication of job listings
- Filtering for fast food restaurants and recruiting agencies

## Input Parameters

- `queries` - List of search queries to run (e.g., "restaurant chef united states")
- `location` - Optional location filter (e.g., "New York")
- `maxPagesPerQuery` - Maximum number of pages to fetch per query
- `saveToDataset` - Whether to save results to Apify dataset
- `pushToDatabase` - Whether to push results to external database
- `databaseUrl` - URL of the external database
- `databaseTable` - Name of the database table to insert jobs into
- `deduplicateJobs` - Whether to check for and skip duplicate jobs when pushing to database
- `fullTimeOnly` - Whether to filter for full-time positions only
- `excludeFastFood` - Whether to exclude fast food restaurants
- `excludeRecruiters` - Whether to exclude recruiting agencies

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
  "scraped_at": "2023-05-15T12:34:56.789Z"
}
```

## Usage

1. Set up your SearchAPI.io API key in the environment variables:
   ```
   SEARCH_API_KEY=your_api_key_here
   ```

2. Configure the input parameters according to your needs.

3. Run the actor and retrieve the results from the dataset.
