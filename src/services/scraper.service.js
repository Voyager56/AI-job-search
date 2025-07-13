const axios = require('axios');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');
const { default: axiosRetry } = require('axios-retry');
const jobsGeScraper = require('./jobsge.scraper');
const linkedInScraper = require('./linkedin.scraper');

class ScraperService {
  constructor() {
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return error.code === 'ECONNABORTED' || 
               error.response?.status >= 500 ||
               error.response?.status === 429;
      }
    });
  }
  
  getRandomUserAgent() {
    const userAgent = new UserAgent();
    return userAgent.toString();
  }
  
  async scrapeIndeed(query, location = '', numPages = 1) {
    const jobs = [];
    
    for (let page = 0; page < numPages; page++) {
      try {
        const start = page * 10;
        const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&start=${start}`;
        
        console.log(`Scraping Indeed page ${page + 1}: ${url}`);
        
        const response = await this.axiosInstance.get(url, {
          headers: {
            'User-Agent': this.getRandomUserAgent()
          }
        });
        
        const $ = cheerio.load(response.data);
        
        $('.jobsearch-ResultsList .result, .jobsearch-ResultsList .slider_container .slider_item').each((index, element) => {
          try {
            const $job = $(element);
            
            const title = $job.find('.jobTitle a span, .jobTitle span[title]').text().trim();
            const company = $job.find('.companyName').text().trim();
            const location = $job.find('.locationsContainer div, .companyLocation').text().trim();
            const summary = $job.find('.job-snippet').text().trim();
            const jobLink = $job.find('.jobTitle a').attr('href');
            const jobId = $job.attr('data-jk');
            
            if (title && company) {
              jobs.push({
                title,
                company,
                location,
                description: summary,
                url: jobLink ? `https://www.indeed.com${jobLink}` : `https://www.indeed.com/viewjob?jk=${jobId}`,
                source: 'Indeed',
                scrapedAt: new Date()
              });
            }
          } catch (err) {
            console.error('Error parsing job:', err);
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
        
      } catch (error) {
        console.error(`Error scraping Indeed page ${page + 1}:`, error.message);
      }
    }
    
    return jobs;
  }
  
  async scrapeLinkedIn(query, location = '') {
    const useAdvanced = this.tempUseAdvanced !== undefined ? 
                       this.tempUseAdvanced : 
                       process.env.USE_ADVANCED_LINKEDIN_SCRAPER === 'true';
    
    this.tempUseAdvanced = undefined;
    
    if (useAdvanced) {
      try {
        console.log(`Using advanced LinkedIn scraper for: "${query}" in "${location}"`);
        console.log('Note: This requires Chromium and may use significant resources');
        
        const jobs = await linkedInScraper.scrapeJobs(query, location, 10);
        
        if (jobs.length === 0) {
          console.log('Advanced scraper returned no results, trying basic scraper...');
          return this.scrapeLinkedInBasic(query, location);
        }
        
        return jobs;
      } catch (error) {
        console.error('LinkedIn scraper error:', error.message);
        console.log('Falling back to basic LinkedIn scraper...');
        return this.scrapeLinkedInBasic(query, location);
      }
    } else {
      return this.scrapeLinkedInBasic(query, location);
    }
  }
  
  async scrapeLinkedInBasic(query, location = '') {
    const jobs = [];
    
    try {
      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`;
      
      console.log(`Basic LinkedIn scrape: ${url}`);
      
      const response = await this.axiosInstance.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent()
        }
      });
      
      const $ = cheerio.load(response.data);
      
      $('.jobs-search__results-list li').each((index, element) => {
        try {
          const $job = $(element);
          
          const title = $job.find('.base-search-card__title').text().trim();
          const company = $job.find('.base-search-card__subtitle').text().trim();
          const location = $job.find('.job-search-card__location').text().trim();
          const jobLink = $job.find('.base-card__full-link').attr('href');
          
          if (title && company) {
            jobs.push({
              title,
              company,
              location,
              description: 'Click to view full description on LinkedIn',
              url: jobLink || url,
              source: 'LinkedIn',
              scrapedAt: new Date()
            });
          }
        } catch (err) {
          console.error('Error parsing LinkedIn job:', err);
        }
      });
      
    } catch (error) {
      console.error('Basic LinkedIn scraper error:', error.message);
    }
    
    return jobs;
  }
  
  async scrapeSimplyHired(query, location = '') {
    const jobs = [];
    
    try {
      const url = `https://www.simplyhired.com/search?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}`;
      
      console.log(`Scraping SimplyHired: ${url}`);
      
      const response = await this.axiosInstance.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent()
        }
      });
      
      const $ = cheerio.load(response.data);
      
      $('.SerpJob').each((index, element) => {
        try {
          const $job = $(element);
          
          const title = $job.find('.jobposting-title a').text().trim();
          const company = $job.find('.jobposting-company').text().trim();
          const location = $job.find('.jobposting-location').text().trim();
          const summary = $job.find('.jobposting-snippet').text().trim();
          const jobLink = $job.find('.jobposting-title a').attr('href');
          
          if (title && company) {
            jobs.push({
              title,
              company,
              location,
              description: summary,
              url: jobLink ? `https://www.simplyhired.com${jobLink}` : url,
              source: 'SimplyHired',
              scrapedAt: new Date()
            });
          }
        } catch (err) {
          console.error('Error parsing SimplyHired job:', err);
        }
      });
      
    } catch (error) {
      console.error('Error scraping SimplyHired:', error.message);
    }
    
    return jobs;
  }
  
  async scrapeJobsGe(query, location = '') {
    try {
      const jobs = await jobsGeScraper.scrapeJobs(query, location);
      return jobs;
    } catch (error) {
      console.error('Error scraping jobs.ge:', error.message);
      return [];
    }
  }

  async scrapeMultipleSites(query, location = '', options = {}) {
    console.log(`Starting multi-site scrape for: "${query}" in "${location}"`);
    
    if (options.useAdvancedLinkedIn !== undefined) {
      this.tempUseAdvanced = options.useAdvancedLinkedIn;
    }
    
    const isGeorgia = location.toLowerCase().includes('georgia') || 
                     location.toLowerCase().includes('tbilisi') ||
                     location.toLowerCase().includes('batumi') ||
                     location.toLowerCase().includes('ge');
    
    const scrapers = [
      this.scrapeIndeed(query, location, 2),
      this.scrapeLinkedIn(query, location),
      this.scrapeSimplyHired(query, location)
    ];
    
    if (isGeorgia) {
      scrapers.push(this.scrapeJobsGe(query, location));
    }
    
    const results = await Promise.allSettled(scrapers);
    
    const allJobs = [];
    const sources = ['Indeed', 'LinkedIn', 'SimplyHired'];
    if (isGeorgia) sources.push('jobs.ge');
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`${sources[index]}: Found ${result.value.length} jobs`);
        allJobs.push(...result.value);
      } else {
        console.log(`${sources[index]}: Failed - ${result.reason}`);
      }
    });
    
    const uniqueJobs = Array.from(
      new Map(allJobs.map(job => [`${job.title}-${job.company}`, job])).values()
    );
    
    console.log(`Total unique jobs found: ${uniqueJobs.length}`);
    return uniqueJobs;
  }
}

module.exports = new ScraperService();