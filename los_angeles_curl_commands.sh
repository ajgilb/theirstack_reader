#!/bin/bash

# Individual curl commands for testing Los Angeles job searches
# Compare location targeting strategies

echo "=== Los Angeles TheirStack API Testing Commands ==="
echo ""

echo "# Test 1: Restaurant Manager in Los Angeles area (multiple location patterns)"
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
    "job_location_pattern_or": ["Los Angeles", "Beverly Hills", "Santa Monica", "West Hollywood", "Hollywood", "Culver City", "Pasadena"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 55000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "# Test 2: Restaurant Manager in just 'Los Angeles'"
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
    "job_location_pattern_or": ["Los Angeles"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 55000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "# Test 3: Executive Chef in Beverly Hills (high-end area)"
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
    "job_location_pattern_or": ["Beverly Hills"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 75000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "# Test 4: Hotel Executive Chef in Los Angeles (hotel focus)"
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
    "job_location_pattern_or": ["Los Angeles", "Beverly Hills", "West Hollywood"],
    "posted_at_max_age_days": 1,
    "min_salary_usd": 80000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut", "hampton", "holiday inn express"]
  }'
EOF

echo ""
echo "# Test 5: Private Chef in Los Angeles (high salary)"
cat << 'EOF'
curl -X POST 'https://api.theirstack.com/v1/jobs/search' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "page": 0,
    "include_total_results": true,
    "job_title_or": ["private chef"],
    "job_title_not": ["server", "waiter", "waitress", "host", "hostess", "busser", "assistant", "associate", "crew member", "team member", "staff"],
    "job_country_code_or": ["US"],
    "job_location_pattern_or": ["Los Angeles", "Beverly Hills", "Malibu", "Manhattan Beach"],
    "posted_at_max_age_days": 7,
    "min_salary_usd": 100000,
    "company_type": "direct_employer",
    "company_name_partial_match_not": ["mcdonald", "burger king", "kfc", "taco bell", "subway", "pizza hut"]
  }'
EOF

echo ""
echo "=== Comparison Test: No Location Filter ==="
echo "# Test 6: Restaurant Manager nationwide (no location filter)"
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
echo "=== Analysis Tips ==="
echo "1. Compare job counts: LA vs nationwide"
echo "2. Check location specificity: broad LA area vs specific cities"
echo "3. Higher salary thresholds in expensive areas (Beverly Hills, etc.)"
echo "4. Note total_results vs returned count (pagination may be needed)"
echo ""
echo "Parse results:"
echo "curl ... | jq '.data | length'              # Jobs returned"
echo "curl ... | jq '.metadata.total_results'     # Total available"
echo "curl ... | jq '.data[].location'            # Check locations"
echo "curl ... | jq '.data[].salary_string'       # Check salary ranges"
