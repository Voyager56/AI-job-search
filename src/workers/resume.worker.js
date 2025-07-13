const { Worker } = require('bullmq');
const resumeService = require('../services/resume.service');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

const resumeWorker = new Worker('resume-parsing', async (job) => {
  console.log(`Processing resume parsing job ${job.id}`);
  
  try {
    await job.updateProgress(10);
    
    const { resumeId, filePath, fileName } = job.data;
    console.log(`Parsing resume: ${fileName}`);
    
    await job.updateProgress(30);
    
    const result = await resumeService.uploadResume(filePath, fileName);
    
    await job.updateProgress(100);
    
    const dateUtils = require('../utils/dateUtils');
    return {
      success: true,
      resumeId: result.id,
      parsedData: result.parsedData,
      processedAt: dateUtils.formatDateTime(new Date())
    };
    
  } catch (error) {
    console.error(`Resume parsing failed for job ${job.id}:`, error);
    throw error;
  }
}, {
  connection,
  concurrency: 2,
  
  autorun: true,
  
  limiter: {
    max: 10,
    duration: 60000
  }
});

resumeWorker.on('completed', (job, result) => {
  console.log(`Resume parsing completed for job ${job.id}:`, result);
});

resumeWorker.on('failed', (job, err) => {
  console.error(`Resume parsing failed for job ${job.id}:`, err);
});

resumeWorker.on('progress', (job, progress) => {
  console.log(`Resume parsing progress for job ${job.id}: ${progress}%`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down resume worker...');
  await resumeWorker.close();
});

module.exports = resumeWorker;