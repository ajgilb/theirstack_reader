#!/bin/bash

# Individual curl commands for testing each job title with TheirStack API
# Copy and paste these commands to test manually

API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA"

echo "=== Individual Curl Commands for TheirStack API Testing ==="
echo ""
echo "# Restaurant Manager"
cat << 'EOF'
curl -X POST 'https://api.theirstack.com/v1/jobs/search' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "page": 0,
    "include_total_results": true,
    "job_title_or": ["restaurant manager"],
    "job_title_not": ["server", "waiter", "waitress", "host", "hostess", "busser", "assistant", "associate", "crew member", "team member", "staff"],
    "job_country_code_or": ["US"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 55000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "# Executive Chef"
cat << 'EOF'
curl -X POST 'https://api.theirstack.com/v1/jobs/search' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "page": 0,
    "include_total_results": true,
    "job_title_or": ["executive chef"],
    "job_title_not": ["server", "waiter", "waitress", "host", "hostess", "busser", "assistant", "associate", "crew member", "team member", "staff"],
    "job_country_code_or": ["US"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 55000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "# Sous Chef"
cat << 'EOF'
curl -X POST 'https://api.theirstack.com/v1/jobs/search' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "page": 0,
    "include_total_results": true,
    "job_title_or": ["sous chef"],
    "job_title_not": ["server", "waiter", "waitress", "host", "hostess", "busser", "assistant", "associate", "crew member", "team member", "staff"],
    "job_country_code_or": ["US"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 55000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "# Kitchen Manager"
cat << 'EOF'
curl -X POST 'https://api.theirstack.com/v1/jobs/search' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "page": 0,
    "include_total_results": true,
    "job_title_or": ["kitchen manager"],
    "job_title_not": ["server", "waiter", "waitress", "host", "hostess", "busser", "assistant", "associate", "crew member", "team member", "staff"],
    "job_country_code_or": ["US"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 55000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "# Hotel Executive Chef"
cat << 'EOF'
curl -X POST 'https://api.theirstack.com/v1/jobs/search' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "page": 0,
    "include_total_results": true,
    "job_title_or": ["hotel executive chef"],
    "job_title_not": ["server", "waiter", "waitress", "host", "hostess", "busser", "assistant", "associate", "crew member", "team member", "staff"],
    "job_country_code_or": ["US"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 55000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "=== Usage Instructions ==="
echo "1. Copy and paste any curl command above"
echo "2. Look for the 'data' array length for job count"
echo "3. Check 'metadata.total_results' for total available"
echo "4. Each job returned = 1 API credit consumed"
echo ""
echo "Example response parsing:"
echo "curl ... | jq '.data | length'     # Count jobs returned"
echo "curl ... | jq '.metadata.total_results'  # Total available"
