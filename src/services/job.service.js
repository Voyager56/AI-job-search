const axios = require('axios');
const cheerio = require('cheerio');
const { db } = require('../database/db');
const geminiService = require('./gemini.service');
const scraperService = require('./scraper.service');

class JobService {
  async searchJobs(keywords, location = '', options = {}) {
    try {
      const scraperOptions = options || this.searchOptions || {};
      const jobs = await scraperService.scrapeMultipleSites(keywords, location, scraperOptions);
      return jobs;
    } catch (error) {
      console.error('Error searching jobs:', error);
      const mockJobs = [
        {
          title: 'Software Engineer',
          company: 'Tech Corp',
          location: location || 'Remote',
          description: 'Looking for a software engineer with experience in Node.js and React',
          url: 'https://example.com/job1'
        },
        {
          title: 'Full Stack Developer',
          company: 'Startup Inc',
          location: location || 'San Francisco, CA',
          description: 'Full stack developer needed with JavaScript expertise',
          url: 'https://example.com/job2'
        }
      ];
      return mockJobs;
    }
  }
  
  async scrapeIndeedJobs(query, location = '') {
    try {
      const jobs = await scraperService.scrapeIndeed(query, location, 2);
      return jobs;
    } catch (error) {
      console.error('Scraping error:', error);
      return [];
    }
  }
  
  async saveJob(jobData, userId = null) {
    try {
      const [jobId] = await db('jobs').insert({
        title: jobData.title,
        company: jobData.company,
        location: jobData.location,
        description: jobData.description || '',
        url: jobData.url,
        source: jobData.source || 'manual',
        relevance_score: jobData.relevance_score || 0,
        hr_email: jobData.contactEmail || jobData.hr_email || null,
        user_id: userId
      });
      
      console.log(`Saved job ${jobData.title} with ID ${jobId}`);
      return jobId;
    } catch (error) {
      console.error('Error saving job:', error.message);
      console.error('Job data:', jobData);
      throw error;
    }
  }
  
  async matchJobsToResume(resumeId, options = {}) {
    const resume = await db('resumes')
      .where('id', resumeId)
      .first();
      
    if (!resume) {
      throw new Error('Resume not found');
    }
    
    const parsedData = JSON.parse(resume.parsed_data);
    const keywords = parsedData.topKeywords || [];
    
    console.log(`Matching jobs for resume ${resumeId} with keywords:`, keywords);
    
    this.searchOptions = options;
    
    const primaryKeyword = keywords[0] || 'developer';
    const skills = parsedData.skills || [];
    
    const searchQueries = [
      primaryKeyword.split(' ')[0],
      'developer',
      skills[0] || 'software',
    ].filter(q => q && q.trim());
    
    console.log(`Searching with queries:`, searchQueries);
    
    const allSearchPromises = [];
    for (const query of searchQueries.slice(0, 2)) {
      allSearchPromises.push(this.searchJobs(query, 'Georgia', options));
    }
    
    const searchResults = await Promise.all(allSearchPromises);
    const allJobs = searchResults.flat();
    
    const uniqueJobs = Array.from(
      new Map(allJobs.map(job => [`${job.title}-${job.company}`, job])).values()
    );
    
    const jobs = uniqueJobs;
    
    console.log(`Found ${jobs.length} jobs to match`);
    
    const filteredJobs = jobs.filter(job => {
      const locationLower = job.location.toLowerCase();
      
      if (locationLower.includes('georgia') && 
          (locationLower.includes('united states') || 
           locationLower.includes('usa') || 
           locationLower.includes('u.s.') ||
           locationLower.includes(', ga'))) {
        return false;
      }
      
      return locationLower.includes('georgia') || 
             locationLower.includes('tbilisi') ||
             locationLower.includes('batumi') ||
             locationLower.includes('kutaisi') ||
             locationLower.includes('rustavi') ||
             locationLower.includes('remote') ||
             locationLower.includes('anywhere') ||
             locationLower.includes('worldwide') ||
             locationLower === 'ge' ||
             locationLower.includes('საქართველო') ||
             job.source === 'jobs.ge';
    });
    
    console.log(`Filtered to ${filteredJobs.length} jobs in Georgia or Remote`);
    
    if (filteredJobs.length === 0) {
      return [];
    }
    
    const scoredJobs = await Promise.all(
      filteredJobs.map(async (job) => {
        try {
          const allKeywords = [...new Set([...keywords, ...(parsedData.skills || [])])];
          const jobInfo = `${job.title} ${job.company} ${job.description}`;
          const match = await geminiService.matchJobRelevance(
            allKeywords,
            jobInfo
          );
          
          return {
            ...job,
            relevance_score: match.score,
            recommendation: match.recommendation,
            matchingSkills: match.matchingSkills,
            missingSkills: match.missingSkills
          };
        } catch (error) {
          console.error(`Error scoring job ${job.title}:`, error.message);
          return {
            ...job,
            relevance_score: 50,
            recommendation: 'Unable to analyze match',
            matchingSkills: [],
            missingSkills: []
          };
        }
      })
    );
    
    for (let i = 0; i < scoredJobs.length; i++) {
      try {
        const dbId = await this.saveJob(scoredJobs[i], resume.user_id);
        scoredJobs[i].dbId = dbId;
      } catch (error) {
        console.error('Error saving job:', error.message);
      }
    }
    
    return scoredJobs.sort((a, b) => b.relevance_score - a.relevance_score);
  }
  
  async getJobsByResumeMatch(resumeId, minScore = 50, userId = null) {
    const query = db('jobs')
      .where('relevance_score', '>=', minScore);
    
    if (userId) {
      query.where('user_id', userId);
    }
      
    return query.orderBy('relevance_score', 'desc');
  }
  
  async getJob(jobId) {
    const job = await db('jobs')
      .where('id', jobId)
      .first();
      
    return job;
  }
}

module.exports = new JobService();