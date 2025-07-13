const { Worker } = require('bullmq');
const emailService = require('../services/email.service');
const { db } = require('../database/db');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

const emailWorker = new Worker('email-sending', async (job) => {
  console.log(`Processing email job ${job.id}`);
  
  const { resumeId, jobId, coverLetter, emailTo } = job.data;
  
  try {
    const existing = await db('applications')
      .where({ resume_id: resumeId, job_id: jobId, status: 'sent' })
      .first();
      
    if (existing) {
      console.log(`Application already sent for resume ${resumeId} to job ${jobId}`);
      return { success: true, skipped: true, reason: 'Already sent' };
    }
    
    await job.updateProgress(20);
    
    const result = await emailService.sendApplication({
      resumeId,
      jobId,
      coverLetter,
      emailTo
    });
    
    await job.updateProgress(90);
    
    console.log(`Email sent successfully for job ${job.id}`);
    await job.updateProgress(100);
    
    const dateUtils = require('../utils/dateUtils');
    return {
      success: true,
      messageId: result.messageId,
      applicationId: result.applicationId,
      sentAt: dateUtils.formatDateTime(new Date())
    };
    
  } catch (error) {
    console.error(`Email sending failed for job ${job.id}:`, error);
    
    if (error.message.includes('rate limit')) {
      await job.moveToDelayed(Date.now() + 60 * 60 * 1000);
      throw new Error('Rate limited - will retry in 1 hour');
    }
    
    if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
      throw new Error('Temporary network error - will retry');
    }
    
    if (job.attemptsMade >= 3) {
      await db('applications')
        .where({ resume_id: resumeId, job_id: jobId })
        .update({ 
          status: 'failed',
          error_message: error.message 
        });
    }
    
    throw error;
  }
}, {
  connection,
  concurrency: 1,
  
  stalledInterval: 30000,
  
  limiter: {
    max: 5,
    duration: 60000
  }
});

emailWorker.on('completed', (job, result) => {
  console.log(`Email job ${job.id} completed:`, result);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);
  
  if (job.attemptsMade >= job.opts.attempts) {
    console.error(`CRITICAL: Email job ${job.id} permanently failed`);
  }
});

emailWorker.on('stalled', (jobId) => {
  console.warn(`Email job ${jobId} stalled and will be retried`);
});

module.exports = emailWorker;