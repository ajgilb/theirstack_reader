// Updated filter lists for indeed_scraper_api.js

// Job titles to add to excludedTitles array:
const newJobTitles = [
    // Hotel Operations
    'night auditor', 'night audit', 'front desk', 'clerk', 'room service',
    
    // Security and Loss Prevention
    'loss prevention',
    
    // Healthcare/Behavioral
    'behavioral health',
    
    // Already existing: 'housekeeping'
];

// Companies to add to excludedCompanies array:
const newCompanies = [
    // Fast food/chains
    'shake shack',
    
    // Grocery/retail
    "smith's food and drug",
    
    // Hotel chains
    'renaissance hotels',
    'sheraton',
    
    // Major hospitality companies
    'marriott international', // Already added
];

// For job_search_api.js - add to shouldExcludeCompany function:
const additionalExclusions = [
    'shake shack',
    "smith's food and drug", 
    'renaissance hotels',
    'sheraton'
];

console.log('Filter updates ready to apply');
