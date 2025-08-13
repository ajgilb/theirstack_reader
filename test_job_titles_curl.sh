#!/bin/bash

# TheirStack API Job Title Testing Script
# Tests individual job titles to estimate credit usage for 1-day searches

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

echo "=== TheirStack API Job Title Testing ==="
echo "Testing ${#JOB_TITLES[@]} job titles for 1-day US searches with filters"
echo "Minimum salary: \$55,000 USD"
echo "Excluded titles: ${#EXCLUDED_TITLES[@]} patterns"
echo "Excluded companies: ${#EXCLUDED_COMPANIES[@]} patterns"
echo ""

TOTAL_JOBS=0
SUCCESSFUL_TESTS=0

for job_title in "${JOB_TITLES[@]}"; do
  echo "----------------------------------------"
  echo "Testing: '$job_title'"
  
  # Build JSON payload
  excluded_titles_json=$(format_json_array "${EXCLUDED_TITLES[@]}")
  excluded_companies_json=$(format_json_array "${EXCLUDED_COMPANIES[@]}")
  
  json_payload=$(cat <<EOF
{
  "limit": 100,
  "page": 0,
  "include_total_results": true,
  "job_title_or": ["$job_title"],
  "job_title_not": $excluded_titles_json,
  "job_country_code_or": ["US"],
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
      TOTAL_JOBS=$((TOTAL_JOBS + job_count))
      SUCCESSFUL_TESTS=$((SUCCESSFUL_TESTS + 1))
    fi
  else
    echo "  ❌ Invalid JSON response"
    echo "  Raw response: $response"
  fi
  
  # Rate limiting delay
  sleep 1
done

echo ""
echo "=== SUMMARY ==="
echo "Successful tests: $SUCCESSFUL_TESTS/${#JOB_TITLES[@]}"
echo "Total jobs found: $TOTAL_JOBS"
echo "Average per title: $((TOTAL_JOBS / (SUCCESSFUL_TESTS > 0 ? SUCCESSFUL_TESTS : 1)))"
echo ""
echo "💰 Estimated daily credit usage: $TOTAL_JOBS credits"
echo "📅 Estimated weekly credit usage: $((TOTAL_JOBS * 7)) credits"
echo "📅 Estimated monthly credit usage: $((TOTAL_JOBS * 30)) credits"
