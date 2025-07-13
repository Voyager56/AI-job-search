const { Worker } = require('bullmq');
const { FlowProducer } = require('bullmq');
const resumeService = require('../services/resume.service');
const jobService = require('../services/job.service');
const geminiService = require('../services/gemini.service');
const queueService = require('../services/queue.service');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

const pipelineWorker = new Worker('application-pipeline', async (job) => {
  console.log(`Starting application pipeline ${job.id}`);
  
  const { resumeId, jobIds, userId } = job.data;
  const results = {
    resumeParsed: false,
    jobsMatched: 0,
    coverLettersGenerated: 0,
    applicationsSent: 0,
    errors: []
  };
  
  try {
    await job.updateProgress(10);
    console.log('Step 1: Fetching resume...');
    
    const resume = await resumeService.getResume(resumeId);
    if (!resume) {
      throw new Error('Resume not found');
    }
    results.resumeParsed = true;
    
    await job.updateProgress(30);
    console.log('Step 2: Finding matching jobs...');
    
    let targetJobs = [];
    if (!jobIds || jobIds.length === 0) {
      targetJobs = await jobService.matchJobsToResume(resumeId);
      targetJobs = targetJobs
        .filter(job => job.relevance_score > 70)
        .slice(0, 5);
    } else {
      targetJobs = await Promise.all(
        jobIds.map(id => jobService.getJob(id))
      );
    }
    
    results.jobsMatched = targetJobs.length;
    console.log(`Found ${targetJobs.length} matching jobs`);
    
    await job.updateProgress(50);
    console.log('Step 3: Generating cover letters...');
    
    const applications = [];
    for (let i = 0; i < targetJobs.length; i++) {
      try {
        const targetJob = targetJobs[i];
        const progress = 50 + (20 * (i / targetJobs.length));
        await job.updateProgress(progress);
        
        console.log(`Generating cover letter for ${targetJob.title} at ${targetJob.company}`);
        
        const parsedResumeData = typeof resume.parsed_data === 'string' 
          ? JSON.parse(resume.parsed_data) 
          : resume.parsed_data;
          
        const coverLetter = await geminiService.generateCoverLetter(
          parsedResumeData,
          targetJob
        );
        
        applications.push({
          jobId: targetJob.id,
          coverLetter,
          emailTo: targetJob.hr_email || 'hr@company.com'
        });
        
        results.coverLettersGenerated++;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to generate cover letter: ${error.message}`);
        results.errors.push({
          step: 'cover_letter_generation',
          job: targetJobs[i].id,
          error: error.message
        });
      }
    }
    
    await job.updateProgress(80);
    console.log('Step 4: Queueing email jobs...');
    
    for (const app of applications) {
      try {
        await queueService.addEmailJob({
          resumeId,
          jobId: app.jobId,
          coverLetter: app.coverLetter,
          emailTo: app.emailTo,
          userId
        }, 0);
        
        results.applicationsSent++;
        
      } catch (error) {
        console.error(`Failed to queue email job: ${error.message}`);
        results.errors.push({
          step: 'email_queueing',
          job: app.jobId,
          error: error.message
        });
      }
    }
    
    await job.updateProgress(100);
    
    console.log(`Pipeline completed: ${results.applicationsSent} applications queued`);
    
    const dateUtils = require('../utils/dateUtils');
    return {
      success: true,
      summary: results,
      completedAt: dateUtils.formatDateTime(new Date())
    };
    
  } catch (error) {
    console.error(`Pipeline failed: ${error.message}`);
    results.errors.push({
      step: 'pipeline',
      error: error.message
    });
    
    throw error;
  }
}, {
  connection,
  concurrency: 2,
  
  timeout: 10 * 60 * 1000,
});

pipelineWorker.on('completed', (job, result) => {
  console.log(`Pipeline ${job.id} completed successfully:`, result.summary);
});

pipelineWorker.on('failed', (job, err) => {
  console.error(`Pipeline ${job.id} failed:`, err.message);
});

pipelineWorker.on('progress', (job, progress) => {
  console.log(`Pipeline ${job.id} progress: ${progress}%`);
});

module.exports = pipelineWorker;