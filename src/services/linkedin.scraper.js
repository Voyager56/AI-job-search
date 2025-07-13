const { 
  LinkedinScraper, 
  events,
  timeFilter,
  experienceLevelFilter,
  relevanceFilter,
  typeFilter
} = require('linkedin-jobs-scraper');

class LinkedInScraperService {
  constructor() {
    this.scraper = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.scraper = new LinkedinScraper({
        headless: true,
        slowMo: 200,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize LinkedIn scraper:', error.message);
      throw error;
    }
  }

  async scrapeJobs(keyword, location = '', limit = 20) {
    try {
      await this.initialize();
    } catch (error) {
      console.error('LinkedIn scraper initialization failed, returning empty results');
      return [];
    }
    
    const jobs = [];
    
    return new Promise((resolve, reject) => {
      this.scraper.on(events.scraper.data, (data) => {
        try {
          const job = {
            id: data.jobId || data.link,
            title: data.title,
            company: data.company,
            location: data.location || location,
            description: data.description || 'Click to view full description on LinkedIn',
            url: data.link,
            source: 'LinkedIn',
            postedDate: this.parseLinkedInDate(data.date),
            salary: data.salary || null,
            benefits: data.benefits || [],
            jobType: data.jobType || null,
            experienceLevel: data.seniorityLevel || null,
            applicants: data.applicants || null,
            scrapedAt: new Date()
          };
          
          if (data.description) {
            const emailMatch = data.description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
              job.hr_email = emailMatch[1];
            }
          }
          
          jobs.push(job);
          console.log(`Found LinkedIn job: ${job.title} at ${job.company}`);
        } catch (error) {
          console.error('Error parsing LinkedIn job:', error);
        }
      });

      this.scraper.on(events.scraper.error, (err) => {
        console.error('LinkedIn scraper error:', err);
      });

      this.scraper.on(events.scraper.end, () => {
        console.log(`LinkedIn scraping completed. Found ${jobs.length} jobs`);
        resolve(jobs);
      });

      const queries = [{
        query: keyword,
        options: {
          locations: location ? [location] : [],
          limit: limit,
          filters: {
            time: timeFilter.MONTH,
            experienceLevel: [
              experienceLevelFilter.ENTRY_LEVEL,
              experienceLevelFilter.MID_SENIOR,
              experienceLevelFilter.ASSOCIATE
            ]
          }
        }
      }];

      this.scraper.run(queries)
        .then(() => {
        })
        .catch((error) => {
          console.error('LinkedIn scraper failed:', error);
          reject(error);
        });
    });
  }

  parseLinkedInDate(dateStr) {
    if (!dateStr) return '';
    
    const now = new Date();
    
    if (dateStr.includes('hour') || dateStr.includes('minute')) {
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    const match = dateStr.match(/(\d+)\s*(day|week|month)/i);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      const postedDate = new Date(now);
      
      switch (unit) {
        case 'day':
          postedDate.setDate(now.getDate() - amount);
          break;
        case 'week':
          postedDate.setDate(now.getDate() - (amount * 7));
          break;
        case 'month':
          postedDate.setMonth(now.getMonth() - amount);
          break;
      }
      
      const day = String(postedDate.getDate()).padStart(2, '0');
      const month = String(postedDate.getMonth() + 1).padStart(2, '0');
      const year = postedDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    return '';
  }

  async close() {
    await this.scraper.close();
  }
}

module.exports = new LinkedInScraperService();