import fetch from 'node-fetch';
// Import pg for database access
import pg from 'pg';
const { Pool } = pg;

// Cache for excluded companies from database
let excludedCompaniesCache = null;
let cacheLastUpdated = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch excluded companies from the database
 */
async function fetchExcludedCompanies() {
  // Check cache first
  if (excludedCompaniesCache && cacheLastUpdated && 
      (Date.now() - cacheLastUpdated) < CACHE_DURATION_MS) {
    return excludedCompaniesCache;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT company_name, parent_company, domain 
        FROM excluded_companies 
        WHERE is_active = true
      `);
      
      const companies = result.rows.map(row => ({
        name: row.company_name,
        parent: row.parent_company,
        domain: row.domain
      }));
      
      // Update cache
      excludedCompaniesCache = companies;
      cacheLastUpdated = Date.now();
      
      console.log(`[TheirStack] Loaded ${companies.length} excluded companies from database`);
      return companies;
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.warn(`[TheirStack] Failed to load excluded companies from database: ${error.message}`);
    return [];
  }
}

/**
 * Build company exclusion filters for TheirStack API
 */
async function buildCompanyExclusions() {
  const dbExcluded = await fetchExcludedCompanies();
  
  // Static fast food and budget hotel exclusions
  const staticExclusions = [
    // Fast food chains
    'mcdonald', 'burger king', 'kfc', 'taco bell', 'subway', 'pizza hut', 'domino',
    'papa john', 'little caesars', 'wendy', 'arby', 'dairy queen', 'sonic',
    'chipotle', 'panera bread', 'five guys', 'in-n-out', 'whataburger',
    'chick-fil-a', 'popeyes', 'dunkin', 'starbucks', 'tim hortons', 'white castle',
    'jack in the box', 'carl jr', 'hardee', 'qdoba', 'moes', 'panda express', 'shake shack',
    // Budget hotels
    'embassy suites', 'courtyard by marriott', 'springhill suites', 'fairfield inn',
    'towneplace suites', 'residence inn', 'moxy hotels', 'ac hotels', 'hampton', 'tru by hilton',
    'home2 suites', 'homewood suites', 'hilton garden inn', 'holiday inn express', 'avid hotels',
    'candlewood suites', 'staybridge suites', 'comfort inn', 'comfort suites', 'sleep inn',
    'quality inn', 'clarion', 'mainstay suites', 'suburban studios', 'woodspring suites',
    'econo lodge', 'rodeway inn', 'la quinta', 'microtel', 'days inn', 'super 8', 'travelodge',
    'baymont inn', 'howard johnson', 'americinn', 'best western', 'surestay', 'motel 6', 'studio 6',
    'red roof', 'hometowne studios', 'my place hotels', 'cobblestone inn', 'boarders inn',
    // Healthcare/senior living
    'senior living', 'brookdale senior living', 'atria senior living', 'sunrise senior living',
    'benchmark senior living', 'holiday retirement', 'genesis healthcare', 'encompass health',
    'kindred healthcare', 'life care', 'assisted living', 'nursing home'
  ];
  
  // Combine database and static exclusions
  const allExclusions = [
    ...staticExclusions,
    ...dbExcluded.map(c => c.name.toLowerCase()),
    ...dbExcluded.filter(c => c.parent).map(c => c.parent.toLowerCase())
  ];
  
  return [...new Set(allExclusions)]; // Remove duplicates
}

/**
 * TheirStack Jobs API integration
 * - Paginates through /v1/jobs/search
 * - Applies server-side filtering via API parameters (exclude fast food, low-level titles, recruiters)
 * - Normalizes to the schema expected by database insertion (culinary_jobs_google)
 */

function daysAgoIsoDate(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function extractDomainFromUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `http://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

function isExcludedByTitle(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  const excluded = [
    'server', 'waiter', 'waitress', 'host', 'hostess', 'busser', 'buser',
    'food runner', 'runner', 'barback', 'bartender', 'cashier',
    'counter server', 'drive-thru', 'drive thru', 'takeout specialist',
    'takeout', 'delivery driver', 'delivery', 'breakfast attendant',
    'line cook', 'prep cook', 'dishwasher', 'expeditor', 'expo',
    'kitchen porter', 'pastry assistant', 'fry cook', 'pantry cook',
    'butcher', 'commissary worker', 'cook',
    'housekeeper', 'room attendant', 'laundry attendant', 'houseman',
    'housekeeping aide', 'maintenance technician', 'janitor', 'custodian',
    'steward', 'banquet server', 'event setup', 'security officer', 'security guard',
    'night auditor', 'front desk', 'clerk', 'room service', 'front office', 'greeter',
    'prep', 'agent', 'loss prevention', 'behavioral health',
    'assistant', 'associate', 'crew member', 'team member', 'staff'
  ];
  return excluded.some(x => lower.includes(x));
}

function isExcludedByCompany(company) {
  if (!company) return false;
  const lower = company.toLowerCase();
  const excludedCompanies = [
    // Fast food
    'mcdonald', 'burger king', 'kfc', 'taco bell', 'subway', 'pizza hut', 'domino',
    'papa john', 'little caesars', 'wendy', 'arby', 'dairy queen', 'sonic',
    'chipotle', 'panera bread', 'five guys', 'in-n-out', 'whataburger',
    'chick-fil-a', 'popeyes', 'dunkin', 'starbucks', 'tim hortons', 'white castle',
    'jack in the box', 'carl jr', 'hardee', 'qdoba', 'moes', 'panda express', 'shake shack',
    // Budget hotels and general exclusions
    'embassy suites', 'courtyard by marriott', 'springhill suites', 'fairfield inn',
    'towneplace suites', 'residence inn', 'moxy hotels', 'ac hotels', 'hampton', 'tru by hilton',
    'home2 suites', 'homewood suites', 'hilton garden inn', 'holiday inn express', 'avid hotels',
    'candlewood suites', 'staybridge suites', 'comfort inn', 'comfort suites', 'sleep inn',
    'quality inn', 'clarion', 'mainstay suites', 'suburban studios', 'woodspring suites',
    'econo lodge', 'rodeway inn', 'la quinta', 'microtel', 'days inn', 'super 8', 'travelodge',
    'baymont inn', 'howard johnson', 'americinn', 'best western', 'surestay', 'motel 6', 'studio 6',
    'red roof', 'hometowne studios', 'my place hotels', 'cobblestone inn', 'boarders inn',
    'centerstone hotels', "america's best value inn", 'canadas best value inn', 'budget inn',
    'scottish inns', 'knights inn', 'signature inn', 'americas best inns', 'greentree inn', 'stayable',
    // Healthcare/senior living
    'senior living', 'brookdale senior living', 'atria senior living', 'sunrise senior living',
    'benchmark senior living', 'holiday retirement', 'genesis healthcare', 'encompass health',
    'kindred healthcare', 'life care', 'assisted living', 'nursing home'
  ];
  return excludedCompanies.some(x => lower.includes(x));
}

function isHourlySalaryText(salaryText) {
  if (!salaryText) return false;
  const lower = String(salaryText).toLowerCase();
  return lower.includes('hour') || lower.includes('/hr') || lower.includes('an hour');
}

function normalizeTheirStackJob(raw) {
  const title = raw.title || raw.job_title || '';
  const company = raw.company_name || raw.company || '';
  const location = raw.location || raw.job_location || raw.city || '';
  const url = raw.apply_url || raw.url || raw.job_url || '';
  const description = raw.description || raw.job_description || raw.summary || '';
  const postedAt = raw.posted_at || raw.date_posted || raw.published_at || null;
  const companyUrl = raw.company_url || raw.company_website || raw.company_domain || '';

  // Salary handling (TheirStack often returns annual USD min/max fields)
  const salaryMin = raw.compensation_annual_min_usd || raw.salary_min_usd || null;
  const salaryMax = raw.compensation_annual_max_usd || raw.salary_max_usd || null;
  const salaryPeriod = (salaryMin || salaryMax) ? 'year' : null;

  return {
    title: title || 'No title',
    company: company || 'Unknown Company',
    location: location || 'Location not specified',
    description,
    salary: raw.salary_text || raw.compensation_text || '',
    salary_min: Number.isFinite(salaryMin) ? Math.round(salaryMin) : null,
    salary_max: Number.isFinite(salaryMax) ? Math.round(salaryMax) : null,
    salary_period: salaryPeriod,
    salary_currency: 'USD',
    apply_link: url,
    job_id: raw.id || raw.job_id || '',
    source: 'their_stack',
    scraped_at: new Date().toISOString(),
    company_website: companyUrl || '',
    company_domain: extractDomainFromUrl(companyUrl),
    schedule: raw.job_type || raw.schedule || '',
    experience_level: raw.seniority || raw.experience_level || '',
    posted_at: postedAt,
    skills: Array.isArray(raw.skills) ? raw.skills : []
  };
}

async function fetchJobsPage({
  apiKey,
  jobTitles,
  location,
  postedDays,
  minSalary,
  countryCodes = ['US'],
  excludedTitles = [],
  excludedCompanies = [],
  page,
  limit
}) {
  const url = 'https://api.theirstack.com/v1/jobs/search';

  const body = {
    limit,
    page,
    include_total_results: false,
    // Common job filters supported by TheirStack
    job_title_or: jobTitles,
    job_title_not: excludedTitles.length > 0 ? excludedTitles : undefined,
    job_country_code_or: Array.isArray(countryCodes) && countryCodes.length > 0 ? countryCodes : undefined,
    job_location_pattern_or: (location && location !== 'United States') ? [location] : [],
    posted_at_max_age_days: Number.isFinite(postedDays) ? postedDays : undefined,
    min_salary_usd: Number.isFinite(minSalary) ? minSalary : undefined,
    company_type: 'direct_employer',
    company_name_partial_match_not: excludedCompanies.length > 0 ? excludedCompanies : undefined
  };

  // Remove undefined/empty arrays to avoid 422s
  Object.keys(body).forEach(key => {
    const value = body[key];
    if (value === undefined) delete body[key];
    if (Array.isArray(value) && value.length === 0) delete body[key];
  });

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  // Structured request log
  console.log(`[TheirStack] Request page=${page} limit=${limit} countries=${(countryCodes||[]).join(',')} location="${location}" titles=${Array.isArray(jobTitles) ? jobTitles.length : 0} excludedTitles=${excludedTitles.length} excludedCompanies=${excludedCompanies.length} postedDays=${postedDays} minSalary=${minSalary}`);
  const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = { data: [], metadata: {}, raw: text };
  }
  if (!resp.ok) {
    const message = json?.detail || json?.message || resp.statusText;
    console.error(`[TheirStack] Error ${resp.status}: ${message}`);
    throw new Error(`TheirStack API ${resp.status}: ${message}`);
  }
  const items = Array.isArray(json?.data) ? json.data : (Array.isArray(json?.jobs) ? json.jobs : []);
  console.log(`[TheirStack] Response page=${page}: items=${items.length}`);
  return items;
}

export async function searchTheirStackJobs(options = {}) {
  const {
    jobTypes = ['restaurant manager', 'executive chef', 'sous chef', 'kitchen manager'],
    location = 'United States',
    jobAgeDays = 7,
    minSalary = 55000,
    maxPages = 10,
    testMode = false,
    excludeFastFood = true
  } = options;

  const apiKey = process.env.THEIRSTACK_API_KEY || process.env.THEIRSTACK_TOKEN || '';
  const fallback = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhakBjaGVmc2hlZXQuY29tIiwicGVybWlzc2lvbnMiOiJ1c2VyIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDgtMTJUMjA6MTI6MjYuNDk5MDk3KzAwOjAwIn0.a96aOpALIg4AvoqeKUPOl4IttEqqgRga3ETvXubswTA';
  const resolvedKey = apiKey || fallback;
  if (!resolvedKey) {
    throw new Error('Missing TheirStack API key. Set THEIRSTACK_API_KEY in environment.');
  }

  // Build exclusion lists
  const excludedTitles = [
    'server', 'waiter', 'waitress', 'host', 'hostess', 'busser', 'buser',
    'food runner', 'runner', 'barback', 'bartender', 'cashier',
    'counter server', 'drive-thru', 'drive thru', 'takeout specialist',
    'takeout', 'delivery driver', 'delivery', 'breakfast attendant',
    'line cook', 'prep cook', 'dishwasher', 'expeditor', 'expo',
    'kitchen porter', 'pastry assistant', 'fry cook', 'pantry cook',
    'butcher', 'commissary worker', 'cook',
    'housekeeper', 'room attendant', 'laundry attendant', 'houseman',
    'housekeeping aide', 'maintenance technician', 'janitor', 'custodian',
    'steward', 'banquet server', 'event setup', 'security officer', 'security guard',
    'night auditor', 'front desk', 'clerk', 'room service', 'front office', 'greeter',
    'prep', 'agent', 'loss prevention', 'behavioral health',
    'assistant', 'associate', 'crew member', 'team member', 'staff'
  ];
  
  const excludedCompanies = await buildCompanyExclusions();
  console.log(`[TheirStack] Using ${excludedTitles.length} excluded titles and ${excludedCompanies.length} excluded companies for server-side filtering`);

  const perPage = testMode ? 25 : 100;
  const pagesToFetch = testMode ? Math.min(1, maxPages) : maxPages;

  const all = [];
  for (let page = 0; page < pagesToFetch; page++) {
    const items = await fetchJobsPage({
      apiKey: resolvedKey,
      jobTitles: jobTypes,
      location,
      postedDays: jobAgeDays,
      minSalary,
      countryCodes: ['US'],
      page,
      limit: perPage
    });

    if (!items || items.length === 0) break;
    all.push(...items);
    if (items.length < perPage) break;

    // Rate limit friendly delay
    if (page < pagesToFetch - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const normalized = all.map(normalizeTheirStackJob);

  // Minimal client-side filtering (most filtering now done server-side)
  const beforeFilter = normalized.length;
  let excludedHourly = 0, excludedSalary = 0;
  const filtered = normalized.filter(job => {
    if (job.salary && isHourlySalaryText(job.salary)) { excludedHourly++; return false; }
    if (minSalary && job.salary_min && job.salary_min < minSalary) { excludedSalary++; return false; }
    return true;
  });

  // Deduplicate by company+title
  const unique = [];
  const seen = new Set();
  for (const job of filtered) {
    const key = `${(job.company || '').toLowerCase().trim()}|${(job.title || '').toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(job);
    }
  }

  console.log(`[TheirStack] Collected=${all.length} normalized=${beforeFilter} filtered=${filtered.length} unique=${unique.length} ` +
              `(client-side excluded: hourly=${excludedHourly}, salary=${excludedSalary})`);

  return unique;
}

export default { searchTheirStackJobs };


