const { Queue, Worker } = require('bullmq');
const Redis = require('redis');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

const queues = {
  resumeParsing: new Queue('resume-parsing', { connection }),
  jobScraping: new Queue('job-scraping', { connection }),
  coverLetterGeneration: new Queue('cover-letter-generation', { connection }),
  emailSending: new Queue('email-sending', { connection }),
  applicationPipeline: new Queue('application-pipeline', { connection })
};

class QueueService {
  constructor() {
    this.queues = queues;
    
    this.queueNameMap = {
      'resume-parsing': 'resumeParsing',
      'job-scraping': 'jobScraping',
      'cover-letter-generation': 'coverLetterGeneration',
      'email-sending': 'emailSending',
      'application-pipeline': 'applicationPipeline'
    };
  }
  
  getQueue(name) {
    const queueName = this.queueNameMap[name] || name;
    return this.queues[queueName];
  }

  async addResumeParsingJob(resumeData) {
    const job = await this.queues.resumeParsing.add('parse-resume', {
      resumeId: resumeData.id,
      filePath: resumeData.filePath,
      fileName: resumeData.fileName
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: {
        age: 3600,
        count: 100
      },
      removeOnFail: {
        age: 24 * 3600
      }
    });

    console.log(`Resume parsing job added: ${job.id}`);
    return job;
  }

  async scheduleJobScraping(keywords, location) {
    const job = await this.queues.jobScraping.add('scrape-jobs', {
      keywords,
      location,
      timestamp: new Date()
    }, {
      repeat: {
        pattern: '0 * * * *'
      },
      jobId: `scrape-${keywords}-${location}`
    });

    console.log(`Scheduled job scraping: ${job.id}`);
    return job;
  }

  async addEmailJob(applicationData, priority = 0) {
    const job = await this.queues.emailSending.add('send-application', {
      resumeId: applicationData.resumeId,
      jobId: applicationData.jobId,
      coverLetter: applicationData.coverLetter,
      emailTo: applicationData.emailTo,
      userId: applicationData.userId
    }, {
      priority: priority,
      delay: 5000,
      attempts: 5,
      backoff: {
        type: 'fixed',
        delay: 60000
      }
    });

    console.log(`Email job added with priority ${priority}: ${job.id}`);
    return job;
  }

  async createApplicationPipeline(resumeId, jobIds, userId) {
    const pipelineJob = await this.queues.applicationPipeline.add('process-applications', {
      resumeId,
      jobIds,
      userId,
      status: 'started',
      steps: [
        { name: 'parse-resume', completed: false },
        { name: 'match-jobs', completed: false },
        { name: 'generate-cover-letters', completed: false },
        { name: 'send-applications', completed: false }
      ]
    }, {
      attempts: 1,
      timeout: 30 * 60 * 1000
    });

    console.log(`Application pipeline created: ${pipelineJob.id}`);
    return pipelineJob;
  }

  async addBatchJobs(jobs, queueName = 'jobScraping') {
    const queue = this.queues[queueName];
    const batchJobs = jobs.map(jobData => ({
      name: 'batch-process',
      data: jobData,
      opts: {
        removeOnComplete: true,
        removeOnFail: false
      }
    }));

    const results = await queue.addBulk(batchJobs);
    console.log(`Added ${results.length} jobs to ${queueName} queue`);
    return results;
  }

  async addRateLimitedJob(data, queueName = 'jobScraping') {
    const job = await this.queues[queueName].add('rate-limited', data, {
      rateLimiterKey: 'scraping',
      limiter: {
        max: 10,
        duration: 60000
      }
    });

    console.log(`Rate limited job added: ${job.id}`);
    return job;
  }


  async getQueueStats(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    const counts = await queue.getJobCounts();
    return {
      active: counts.active,
      waiting: counts.waiting,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
      paused: counts.paused
    };
  }

  async pauseQueue(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    await queue.pause();
    console.log(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    await queue.resume();
    console.log(`Queue ${queueName} resumed`);
  }

  async cleanQueue(queueName, grace = 0) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    const jobs = await queue.clean(grace, 100, 'completed');
    console.log(`Cleaned ${jobs.length} completed jobs from ${queueName}`);
  }

  async getJob(queueName, jobId) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    
    const job = await queue.getJob(jobId);
    if (job) {
      return {
        id: job.id,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    }
    return null;
  }

  async updateJobProgress(queueName, jobId, progress) {
    const job = await this.queues[queueName].getJob(jobId);
    if (job) {
      await job.updateProgress(progress);
    }
  }
}

module.exports = new QueueService();