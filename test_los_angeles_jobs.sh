#!/bin/bash

# TheirStack API Job Title Testing Script - Los Angeles Focus
# Tests individual job titles for Los Angeles area to compare with national results

API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA"
API_URL="https://api.theirstack.com/v1/jobs/search"

# Job titles to test
JOB_TITLES=(
  "restaurant manager"
  "executive chef"
  "sous chef"
  "kitchen manager"
  "culinary director"
  "food service manager"
  "private chef"
  "restaurant chef"
  "hotel executive chef"
  "hotel chef"
  "hotel executive"
  "private club manager"
  "country club manager"
)

# Los Angeles area patterns to test
LA_LOCATIONS=(
  "Los Angeles"
  "Los Angeles, CA"
  "Beverly Hills"
  "Santa Monica"
  "West Hollywood"
  "Hollywood"
  "Culver City"
  "Pasadena"
  "Long Beach"
  "Burbank"
)

# Excluded job titles (server-side filtering)
EXCLUDED_TITLES=(
  "server" "waiter" "waitress" "host" "hostess" "busser" "buser"
  "food runner" "runner" "barback" "bartender" "cashier"
  "counter server" "drive-thru" "drive thru" "takeout specialist"
  "takeout" "delivery driver" "delivery" "breakfast attendant"
  "line cook" "prep cook" "dishwasher" "expeditor" "expo"
  "kitchen porter" "pastry assistant" "fry cook" "pantry cook"
  "butcher" "commissary worker" "cook"
  "housekeeper" "room attendant" "laundry attendant" "houseman"
  "housekeeping aide" "maintenance technician" "janitor" "custodian"
  "steward" "banquet server" "event setup" "security officer" "security guard"
  "night auditor" "front desk" "clerk" "room service" "front office" "greeter"
  "prep" "agent" "loss prevention" "behavioral health"
  "assistant" "associate" "crew member" "team member" "staff"
)

# Excluded companies (partial matches)
EXCLUDED_COMPANIES=(
  "mcdonald" "burger king" "kfc" "taco bell" "subway" "pizza hut" "domino"
  "papa john" "little caesars" "wendy" "arby" "dairy queen" "sonic"
  "chipotle" "panera bread" "five guys" "in-n-out" "whataburger"
  "chick-fil-a" "popeyes" "dunkin" "starbucks" "tim hortons" "white castle"
  "jack in the box" "carl jr" "hardee" "qdoba" "moes" "panda express" "shake shack"
  "hampton" "holiday inn express" "comfort inn" "quality inn" "days inn" "super 8"
  "motel 6" "red roof" "la quinta" "best western"
)

# Convert arrays to JSON format
format_json_array() {
  local arr=("$@")
  printf '['
  for i in "${!arr[@]}"; do
    printf '"%s"' "${arr[$i]}"
    [ $i -lt $((${#arr[@]} - 1)) ] && printf ','
  done
  printf ']'
}

echo "=== TheirStack API Los Angeles Job Testing ==="
echo "Testing ${#JOB_TITLES[@]} job titles for Los Angeles area (1-day searches)"
echo "Location patterns: ${LA_LOCATIONS[*]}"
echo "Minimum salary: \$55,000 USD"
echo "Excluded titles: ${#EXCLUDED_TITLES[@]} patterns"
echo "Excluded companies: ${#EXCLUDED_COMPANIES[@]} patterns"
echo ""

# Test 1: Broad Los Angeles search
echo "=========================================="
echo "TEST 1: Broad Los Angeles area search"
echo "=========================================="

TOTAL_LA_JOBS=0
SUCCESSFUL_LA_TESTS=0

excluded_titles_json=$(format_json_array "${EXCLUDED_TITLES[@]}")
excluded_companies_json=$(format_json_array "${EXCLUDED_COMPANIES[@]}")
la_locations_json=$(format_json_array "${LA_LOCATIONS[@]}")

for job_title in "${JOB_TITLES[@]}"; do
  echo "----------------------------------------"
  echo "Testing: '$job_title' in Los Angeles area"
  
  # Build JSON payload with location patterns
  json_payload=$(cat <<EOF
{
  "limit": 100,
  "page": 0,
  "include_total_results": true,
  "job_title_or": ["$job_title"],
  "job_title_not": $excluded_titles_json,
  "job_country_code_or": ["US"],
  "job_location_pattern_or": $la_locations_json,
  "posted_at_max_age_days": 1,
  "min_salary_usd": 55000,
  "company_type": "direct_employer",
  "company_name_partial_match_not": $excluded_companies_json
}
EOF
)

  # Make API request
  response=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$json_payload")
  
  # Parse response
  if echo "$response" | jq -e . >/dev/null 2>&1; then
    job_count=$(echo "$response" | jq -r '.data | length // 0')
    total_results=$(echo "$response" | jq -r '.metadata.total_results // "unknown"')
    error_msg=$(echo "$response" | jq -r '.detail // empty')
    
    if [ -n "$error_msg" ]; then
      echo "  ❌ Error: $error_msg"
    else
      echo "  ✅ Jobs returned: $job_count"
      echo "  📊 Total available: $total_results"
      TOTAL_LA_JOBS=$((TOTAL_LA_JOBS + job_count))
      SUCCESSFUL_LA_TESTS=$((SUCCESSFUL_LA_TESTS + 1))
    fi
  else
    echo "  ❌ Invalid JSON response"
  fi
  
  # Rate limiting delay
  sleep 1
done

echo ""
echo "=========================================="
echo "TEST 2: Just 'Los Angeles' location"
echo "=========================================="

TOTAL_LA_SIMPLE_JOBS=0
SUCCESSFUL_LA_SIMPLE_TESTS=0

for job_title in "${JOB_TITLES[@]}"; do
  echo "----------------------------------------"
  echo "Testing: '$job_title' in 'Los Angeles' only"
  
  # Build JSON payload with single location
  json_payload=$(cat <<EOF
{
  "limit": 100,
  "page": 0,
  "include_total_results": true,
  "job_title_or": ["$job_title"],
  "job_title_not": $excluded_titles_json,
  "job_country_code_or": ["US"],
  "job_location_pattern_or": ["Los Angeles"],
  "posted_at_max_age_days": 1,
  "min_salary_usd": 55000,
  "company_type": "direct_employer",
  "company_name_partial_match_not": $excluded_companies_json
}
EOF
)

  # Make API request
  response=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$json_payload")
  
  # Parse response
  if echo "$response" | jq -e . >/dev/null 2>&1; then
    job_count=$(echo "$response" | jq -r '.data | length // 0')
    total_results=$(echo "$response" | jq -r '.metadata.total_results // "unknown"')
    error_msg=$(echo "$response" | jq -r '.detail // empty')
    
    if [ -n "$error_msg" ]; then
      echo "  ❌ Error: $error_msg"
    else
      echo "  ✅ Jobs returned: $job_count"
      echo "  📊 Total available: $total_results"
      TOTAL_LA_SIMPLE_JOBS=$((TOTAL_LA_SIMPLE_JOBS + job_count))
      SUCCESSFUL_LA_SIMPLE_TESTS=$((SUCCESSFUL_LA_SIMPLE_TESTS + 1))
    fi
  else
    echo "  ❌ Invalid JSON response"
  fi
  
  # Rate limiting delay
  sleep 1
done

echo ""
echo "=== COMPARISON SUMMARY ==="
echo "Los Angeles area (multiple patterns):"
echo "  Successful tests: $SUCCESSFUL_LA_TESTS/${#JOB_TITLES[@]}"
echo "  Total jobs found: $TOTAL_LA_JOBS"
echo "  Average per title: $((TOTAL_LA_JOBS / (SUCCESSFUL_LA_TESTS > 0 ? SUCCESSFUL_LA_TESTS : 1)))"
echo ""
echo "Los Angeles only (single pattern):"
echo "  Successful tests: $SUCCESSFUL_LA_SIMPLE_TESTS/${#JOB_TITLES[@]}"
echo "  Total jobs found: $TOTAL_LA_SIMPLE_JOBS"
echo "  Average per title: $((TOTAL_LA_SIMPLE_JOBS / (SUCCESSFUL_LA_SIMPLE_TESTS > 0 ? SUCCESSFUL_LA_SIMPLE_TESTS : 1)))"
echo ""
echo "💰 LA Area daily credit usage: $TOTAL_LA_JOBS credits"
echo "💰 LA Simple daily credit usage: $TOTAL_LA_SIMPLE_JOBS credits"
echo "📅 LA Area weekly: $((TOTAL_LA_JOBS * 7)) credits"
echo "📅 LA Area monthly: $((TOTAL_LA_JOBS * 30)) credits"
echo ""
echo "🏙️  Location targeting appears to $([ $TOTAL_LA_JOBS -lt 50 ] && echo "significantly reduce" || echo "moderately reduce") job counts vs national search"
