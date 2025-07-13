const axios = require('axios');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');

class JobsGeScraper {
  constructor() {
    this.baseUrl = 'https://jobs.ge';
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
  }

  getRandomUserAgent() {
    const userAgent = new UserAgent();
    return userAgent.toString();
  }

  mapLocation(location) {
    const locationMap = {
      'თბილისი': 'Tbilisi',
      'ბათუმი': 'Batumi',
      'ქუთაისი': 'Kutaisi',
      'რუსთავი': 'Rustavi',
      'ზუგდიდი': 'Zugdidi',
      'გორი': 'Gori',
      'ფოთი': 'Poti',
      'სამტრედია': 'Samtredia',
      'საქართველო': 'Georgia',
      'დისტანციური': 'Remote',
      'Remote': 'Remote',
      'ნებისმიერი': 'Anywhere'
    };

    const cleaned = location.trim().replace(/^-\s*/, '');
    
    if (/^[A-Za-z\s,]+$/.test(cleaned)) {
      return cleaned;
    }

    for (const [geo, eng] of Object.entries(locationMap)) {
      if (cleaned.includes(geo)) {
        return eng;
      }
    }

    return cleaned;
  }

  parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return '';
    
    const months = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'May': '05', 'June': '06', 'July': '07', 'August': '08',
      'September': '09', 'October': '10', 'November': '11', 'December': '12',
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
      'იანვარი': '01', 'თებერვალი': '02', 'მარტი': '03', 'აპრილი': '04',
      'მაისი': '05', 'ივნისი': '06', 'ივლისი': '07', 'აგვისტო': '08',
      'სექტემბერი': '09', 'ოქტომბერი': '10', 'ნოემბერი': '11', 'დეკემბერი': '12'
    };

    const cleaned = dateStr.trim();
    
    const dateMatch = cleaned.match(/(\d{1,2})\s+([A-Za-z\u10A0-\u10FF]+)(?:\s+(\d{4}))?/);
    
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const monthStr = dateMatch[2];
      const year = dateMatch[3] || new Date().getFullYear();
      
      let month = '01';
      for (const [key, value] of Object.entries(months)) {
        if (monthStr.toLowerCase() === key.toLowerCase() || 
            monthStr.toLowerCase() === key.substring(0, 3).toLowerCase()) {
          month = value;
          break;
        }
      }
      
      return `${day}/${month}/${year}`;
    }
    
    return '';
  }

  async scrapeJobs(query = '', location = '', page = 1) {
    const jobs = [];

    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (location) params.append('l', location);
      params.append('page', page);

      const url = `${this.baseUrl}/en/?${params.toString()}`;
      console.log(`Scraping jobs.ge: ${url}`);

      const response = await this.axiosInstance.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent()
        }
      });

      const $ = cheerio.load(response.data);

      $('tr').each((index, element) => {
        try {
          const $row = $(element);
          
          if ($row.find('th').length > 0 || $row.find('hr').length > 0) {
            return;
          }

          const $jobLink = $row.find('a[href*="view=jobs&id="]').first();
          if (!$jobLink.length) return;

          const title = $jobLink.text().trim();
          if (!title) return;

          const jobUrl = $jobLink.attr('href');
          const jobIdMatch = jobUrl.match(/id=(\d+)/);
          const jobId = jobIdMatch ? jobIdMatch[1] : null;

          const $companyLink = $row.find('a[href*="client="]').first();
          const company = $companyLink.length ? $companyLink.text().trim() : 'Unknown Company';

          const rowText = $row.text();
          let postedDate = '';
          let deadline = '';
          
          let dateMatch = rowText.match(/(\d{1,2}\s+[A-Za-z]{3,})\s*-\s*(\d{1,2}\s+[A-Za-z]{3,})/);
          
          if (!dateMatch) {
            dateMatch = rowText.match(/(\d{1,2}\s+[\u10A0-\u10FF]+)\s*-\s*(\d{1,2}\s+[\u10A0-\u10FF]+)/);
          }
          
          if (!dateMatch) {
            const allDates = rowText.match(/\d{1,2}\s+[A-Za-z]{3,}/g) || [];
            if (allDates.length >= 2) {
              postedDate = this.parseDate(allDates[0]);
              deadline = this.parseDate(allDates[1]);
            } else if (allDates.length === 1) {
              deadline = this.parseDate(allDates[0]);
            }
          } else {
            postedDate = this.parseDate(dateMatch[1]);
            deadline = this.parseDate(dateMatch[2]);
          }

          let location = '';
          const $imgs = $row.find('img');
          $imgs.each((i, img) => {
            const $img = $(img);
            if ($img.attr('src') && $img.attr('src').includes('location')) {
              const nextText = $img[0].nextSibling;
              if (nextText && nextText.nodeType === 3) {
                location = this.mapLocation(nextText.nodeValue);
              }
            }
          });

          const hasSalary = $row.find('img[src*="salary"]').length > 0;

          const isNew = $row.find('img[src*="new"]').length > 0;
          
          const emailMatch = rowText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          const contactEmail = emailMatch ? emailMatch[1] : null;

          const fullJobUrl = jobUrl.startsWith('http') ? jobUrl : `${this.baseUrl}${jobUrl}`;

          if (title && company) {
            jobs.push({
              id: jobId,
              title: title,
              company: company,
              location: location || 'Georgia',
              description: `Posted: ${postedDate}, Deadline: ${deadline}${hasSalary ? ', Salary indicated' : ''}`,
              url: fullJobUrl,
              source: 'jobs.ge',
              postedDate: postedDate,
              deadline: deadline,
              hasSalary: hasSalary,
              isNew: isNew,
              contactEmail: contactEmail,
              scrapedAt: new Date()
            });
          }
        } catch (err) {
          console.error('Error parsing job row:', err);
        }
      });

      console.log(`Found ${jobs.length} jobs on page ${page}`);

    } catch (error) {
      console.error('Error scraping jobs.ge:', error.message);
      throw error;
    }

    return jobs;
  }

  async scrapeJobDetails(jobId) {
    try {
      const url = `${this.baseUrl}/en/?view=jobs&id=${jobId}`;
      console.log(`Scraping job details: ${url}`);

      const response = await this.axiosInstance.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent()
        }
      });

      const $ = cheerio.load(response.data);

      const details = {
        fullDescription: '',
        requirements: [],
        responsibilities: [],
        additionalInfo: {}
      };

      const $mainContent = $('td').filter(function() {
        return $(this).text().length > 200;
      }).first();

      if ($mainContent.length) {
        details.fullDescription = $mainContent.text().trim();
      }

      const emailMatch = details.fullDescription.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        details.contactEmail = emailMatch[1];
      }
      
      const $mainTable = $('table').first();
      const tableText = $mainTable.text();
      const listingEmailMatch = tableText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (listingEmailMatch) {
        details.contactEmail = details.contactEmail || listingEmailMatch[1];
      }

      return details;

    } catch (error) {
      console.error('Error scraping job details:', error.message);
      return null;
    }
  }
}

module.exports = new JobsGeScraper();